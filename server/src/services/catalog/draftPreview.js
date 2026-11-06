// Local-only "draft preview" of the catalog.
//
// When CATALOG_PREVIEW=drafts on a local, non-production server, the public read paths show every
// staged draft as promote would write it, and the server refuses every write. With the flag off,
// nothing in this file changes any behaviour: every caller checks isDraftPreview() first.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional local file listing verified standard references (STANDARDS_REFERENCE_PATH). Without it none are verified.
const STANDARDS_REFERENCE_PATH = process.env.STANDARDS_REFERENCE_PATH || "";

// Drafts whose staged values are laid over the live fields: staged for review or approved, not yet promoted.
export const OVERLAY_DRAFT_STATUSES = ["ready-review", "approved"];
// Drafts that make an unpublished product show in preview. "promoted" rows already carry their values
// in the live fields; they show because they will be on the site once published.
// "draft" is a withdrawn draft and "rejected" is rejected: never shown.
export const VISIBLE_DRAFT_STATUSES = ["ready-review", "approved", "promoted"];

// Same lists as the promote step.
const ATTRIBUTE_KEYS_NEVER = new Set([
	"familySlug",
	"familyTitle",
	"familyTitleBase",
	"familyAttributeOptions",
	"sku",
	"internalPartNumber",
	"fishbowlPartNum",
	"fishbowlDescription",
	"fishbowlPartId",
]);
const IMAGE_SOURCE_BY_ORIGIN = {
	manufacturer: "vendor",
	existing_site: "website",
	rendered_3d: "generated",
	ai_generated: "generated",
};
const REPRESENTATIVE_ORIGINS = new Set(["existing_site", "rendered_3d", "ai_generated"]);
const SPEC_BASES = new Set(["manufacturer", "derived_from_standard"]);

export function isDraftPreview(env = process.env) {
	if (env.CATALOG_PREVIEW !== "drafts") return false;
	if (env.NODE_ENV === "production") return false;
	if (env.RENDER || env.RENDER_SERVICE_ID) return false;
	return true;
}

function isEmpty(value) {
	if (value === null || value === undefined || value === "") return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === "object" && !(value instanceof Date)) {
		return Object.keys(value).length === 0;
	}
	return false;
}

function get(object, dottedPath) {
	let current = object;
	for (const part of String(dottedPath).split(".")) {
		if (current === null || current === undefined || typeof current !== "object") return undefined;
		current = current[part];
	}
	return current;
}

function isExcluded(draft = {}) {
	const excluded = draft?.audit?.excluded;
	return !(excluded === undefined || excluded === null || excluded === "" || excluded === false);
}

// A draft staged for review or approved, and not withdrawn or excluded by the audit.
export function isOverlayDraft(draft) {
	return !!draft && OVERLAY_DRAFT_STATUSES.includes(draft.status) && !isExcluded(draft);
}

// A draft that makes its (active) product show in preview.
export function isVisibleDraft(draft) {
	return !!draft && VISIBLE_DRAFT_STATUSES.includes(draft.status) && !isExcluded(draft);
}

// Mongo filter for enrichments whose draft makes the product show in preview.
// `$in: [null, ...]` also matches a missing audit.excluded.
export function visibleDraftFilter() {
	return {
		"agentDraft.status": { $in: VISIBLE_DRAFT_STATUSES },
		"agentDraft.audit.excluded": { $in: [null, "", false] },
	};
}

let cachedVerifiedRefs = null;

// References in the standards reference file whose row says verified: yes.
export function parseVerifiedStandardReferences(text = "") {
	const verified = new Set();
	let header = [];
	for (const line of String(text).split(/\r?\n/)) {
		if (!line.startsWith("|")) {
			header = [];
			continue;
		}
		const cells = line
			.trim()
			.replace(/^\|/, "")
			.replace(/\|$/, "")
			.split("|")
			.map((cell) => cell.trim());
		if (!header.length) {
			header = cells.map((cell) => cell.toLowerCase());
			continue;
		}
		if (/^[-:\s]*$/.test(cells.join(""))) continue;
		if (header.includes("reference") && header.includes("verified") && cells.length === header.length) {
			const row = Object.fromEntries(header.map((key, index) => [key, cells[index]]));
			if (String(row.verified).toLowerCase() === "yes") {
				verified.add(String(row.reference).replace(/^`+|`+$/g, ""));
			}
		}
	}
	return verified;
}

export function verifiedStandardReferences() {
	if (cachedVerifiedRefs) return cachedVerifiedRefs;
	try {
		cachedVerifiedRefs = parseVerifiedStandardReferences(
			fs.readFileSync(STANDARDS_REFERENCE_PATH, "utf8"),
		);
	} catch {
		cachedVerifiedRefs = new Set();
	}
	return cachedVerifiedRefs;
}

function liveImage(image = {}, order = 0) {
	const url = image?.url;
	const origin = image?.origin;
	if (!url || !IMAGE_SOURCE_BY_ORIGIN[origin]) return null;
	return {
		url,
		alt: image.alt || "",
		sortOrder: order,
		source: IMAGE_SOURCE_BY_ORIGIN[origin],
		isPrimary: order === 0,
		needsReview: false,
		checksum: image.sha256 || "",
		width: image.width ?? null,
		height: image.height ?? null,
		s3Key: image.s3Key || "",
		origin,
		representative: REPRESENTATIVE_ORIGINS.has(origin) ? true : Boolean(image.representative),
		sourceUrl: image.sourceUrl || "",
		sha256: image.sha256 || "",
		retrievedAt: image.retrievedAt ?? null,
	};
}

function slugify(text = "") {
	return String(text || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

// The storefront family a row joins after promote + regroup.
export function familyGroup(draft = {}) {
	const title = String(draft.title || "");
	const attributes = draft.attributes || {};
	const category = String(draft.category || "").trim().toLowerCase();
	const subcategory = String(draft.subcategory || "").trim().toLowerCase();
	if (!title.includes(" – ") || !category || !subcategory) return {};
	let heading = title.split(" – ")[0].replace(/\bFully Threaded /g, "").trim();
	if (attributes.measurementSystem === "metric" && !heading.toLowerCase().startsWith("metric ")) {
		heading = `Metric ${heading}`;
	}
	return {
		familyKey: `${category}|${subcategory}|${heading.toLowerCase()}`,
		familySlug: slugify(heading),
		familyTitle: heading,
	};
}

function lockedKeys(humanLocked = []) {
	const whole = new Set();
	const partial = new Map();
	for (const entry of humanLocked || []) {
		const [top, ...rest] = String(entry).split(".");
		if (rest.length) {
			if (!partial.has(top)) partial.set(top, new Set());
			partial.get(top).add(rest[0]);
		} else {
			whole.add(top);
		}
	}
	return { whole, partial };
}

/**
 * The enrichment as promote would leave it. Returns a new object; the input is never changed.
 * Only ProductEnrichment fields are touched. Product fields (sku, pricing, inventory, ...) never pass
 * through here. An enrichment without a staged draft comes back unchanged (same object).
 *
 * options.published: the product is live, so a live URL slug is kept (promote does the same).
 * options.slugTaken: another enrichment already uses the draft slug, so the live slug is kept.
 * options.verifiedRefs: Set of verified standard references (defaults to docs/standards-reference.md).
 */
export function overlayDraft(enrichment, options = {}) {
	if (!enrichment || !isOverlayDraft(enrichment.agentDraft)) return enrichment;

	const draft = enrichment.agentDraft;
	const locks = enrichment.overrideFlags || {};
	const verifiedRefs = options.verifiedRefs || verifiedStandardReferences();
	const out = { ...enrichment };

	const copy = (keys, lock = "") => {
		if (lock && locks[lock]) return;
		for (const key of keys) {
			if (!isEmpty(draft[key])) out[key] = draft[key];
		}
	};

	copy(["title", "shortTitle"], "lockTitle");
	copy(["description", "shortDescription", "bulletPoints"], "lockDescription");
	copy(["uses", "tags"]);
	copy(["category", "subcategory"], "lockCategory");
	copy(["manufacturer", "documents", "packaging"]);

	// Attributes: key by key over the live object, never replaced wholesale.
	const attributes = { ...(enrichment.attributes || {}) };
	if (!locks.lockAttributes) {
		for (const [key, value] of Object.entries(draft.attributes || {})) {
			if (ATTRIBUTE_KEYS_NEVER.has(key) || key.includes(".") || key.startsWith("$")) continue;
			if (value === null || value === undefined || value === "") continue;
			attributes[key] = value;
		}

		// Storefront family, as `regroup` sets it after promotion. When the title gives no family,
		// the curator's familyKey is used, but only where the live row has none.
		const { whole, partial } = lockedKeys(draft.humanLocked);
		const familyLocked =
			whole.has("attributes") ||
			["familyKey", "familySlug", "familyTitle"].some((key) => partial.get("attributes")?.has(key));
		if (!familyLocked) {
			const group = familyGroup({ ...draft, category: out.category, subcategory: out.subcategory, title: out.title, attributes });
			if (group.familyKey) {
				Object.assign(attributes, group);
			} else if (draft.familyKey && !attributes.familyKey) {
				attributes.familyKey = draft.familyKey;
			}
		}
	}
	out.attributes = attributes;

	if (!locks.lockImages) {
		const images = (draft.images || []).map((image, order) => liveImage(image, order)).filter(Boolean);
		if (images.length) {
			const urls = new Set(images.map((image) => image.url));
			const manual = (enrichment.images || []).filter(
				(image) => image?.source === "manual" && !urls.has(image.url),
			);
			const staged = images.length;
			manual.forEach((image, offset) => {
				images.push({ ...image, isPrimary: false, sortOrder: staged + offset });
			});
			out.images = images;
			out.imageStatus = "approved";
		}
	}

	if (!locks.lockSpecs) {
		const specs = (draft.specs || []).filter((spec) => {
			const basis = spec?.basis;
			if (!SPEC_BASES.has(basis)) return false;
			if (basis === "derived_from_standard") return !!spec.reference && verifiedRefs.has(spec.reference);
			if (basis === "manufacturer") return !!spec.sourceUrl;
			return false;
		});
		if (specs.length) out.specs = specs;
	}

	if (!locks.lockSeo) {
		const draftSeo = draft.seo || {};
		const seo = { ...(enrichment.seo || {}) };
		for (const key of ["metaTitle", "metaDescription", "keywords"]) {
			if (!isEmpty(draftSeo[key])) seo[key] = draftSeo[key];
		}
		if (draftSeo.slug) {
			const keepLive = (options.published && get(enrichment, "seo.slug")) || options.slugTaken;
			if (!keepLive) seo.slug = draftSeo.slug;
		}
		out.seo = seo;
	}

	const brand = get(draft, "manufacturer.brand") || get(draft, "manufacturer.name");
	if (brand) out.websiteBrand = brand;
	if (get(draft, "audit.vendorCanonical")) out.websiteVendor = get(draft, "audit.vendorCanonical");
	out.contentStatus = "approved";

	return out;
}

// What the reviewer strip shows for one row. Only called in preview.
export function buildReviewerInfo(product = {}, enrichment = {}) {
	const draft = enrichment?.agentDraft || {};
	const maker = draft.manufacturer || enrichment?.manufacturer || {};
	let status = "live";
	if (isVisibleDraft(draft)) status = draft.status;
	if (status === "promoted" && !product?.isPublished) status = "promoted (not published)";
	return {
		partId: String(product?.fishbowl?.partId || ""),
		ihiPartNumber: product?.fishbowl?.partNum || product?.sku || "",
		batch: draft.batchId || "",
		maker: maker.brand || maker.name || "",
		makerNumber: maker.mfrPartNumber || "",
		confidence: maker.matchConfidence || "",
		status,
		qa: draft?.qa?.status || "",
		published: !!product?.isPublished,
	};
}

// ── query helpers ──────────────────────────────────────────────────────

// Widens an enrichment filter so a condition matches the live field OR the staged agentDraft field.
// The result is a superset: callers overlay the rows and re-check them with matchesQuery.
export function widenToDrafts(query = {}) {
	const clauses = [];
	for (const [key, condition] of Object.entries(query)) {
		if (key === "$or") {
			clauses.push({ $or: condition.map((part) => widenToDrafts(part)) });
		} else if (key === "$and") {
			clauses.push({ $and: condition.map((part) => widenToDrafts(part)) });
		} else if (key.startsWith("$") || key === "productId" || key === "_id") {
			clauses.push({ [key]: condition });
		} else {
			clauses.push({ $or: [{ [key]: condition }, { [`agentDraft.${key}`]: condition }] });
		}
	}
	if (!clauses.length) return {};
	return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

function valuesAt(object, dottedPath) {
	let values = [object];
	for (const part of String(dottedPath).split(".")) {
		values = values
			.flatMap((value) => (Array.isArray(value) ? value : [value]))
			.map((value) => (value && typeof value === "object" ? value[part] : undefined));
	}
	return values.flatMap((value) => (Array.isArray(value) ? value : [value]));
}

function matchesCondition(values, condition) {
	if (condition instanceof RegExp) {
		return values.some((value) => typeof value === "string" && new RegExp(condition.source, condition.flags).test(value));
	}
	if (condition && typeof condition === "object" && !Array.isArray(condition)) {
		if ("$in" in condition) {
			return condition.$in.some((wanted) => matchesCondition(values, wanted));
		}
		if ("$ne" in condition) {
			return !values.some((value) => value === condition.$ne);
		}
		return false;
	}
	return values.some((value) => value === condition || String(value) === String(condition));
}

// In-memory check of the simple filter shapes the catalog read paths use (RegExp, $in, $ne, $or, $and, equality).
export function matchesQuery(doc, query = {}) {
	return Object.entries(query).every(([key, condition]) => {
		if (key === "$or") return condition.some((part) => matchesQuery(doc, part));
		if (key === "$and") return condition.every((part) => matchesQuery(doc, part));
		return matchesCondition(valuesAt(doc, key), condition);
	});
}

// Product filter for preview: the site's own conditions, but "published" may also be "has a visible draft".
// `common` is the part every shown product must meet (isActive etc.); `published` is the live publish rule.
export function previewProductFilter(common = {}, published = {}, stagedProductIds = []) {
	return {
		...common,
		$or: [published, { _id: { $in: stagedProductIds } }],
	};
}

export function visibleDraftProductIds(enrichments = []) {
	return enrichments.filter((enrichment) => isVisibleDraft(enrichment?.agentDraft)).map((e) => e.productId);
}

/**
 * The preview version of "fetch enrichments matching `query`, keep those whose product is public".
 * Fetches with the query widened to the draft fields, finds the products (published, or active with a
 * visible draft), overlays each draft (knowing whether its product is live), and re-checks `query`
 * against the overlaid row. Returns { enrichments, productMap } in the database's order.
 */
export async function findPreviewRows({
	ProductEnrichment,
	Product,
	query = {},
	sort = null,
	productCommon = {},
	productPublished = {},
	productSelect = null,
}) {
	let enrichmentQuery = ProductEnrichment.find(widenToDrafts(query));
	if (sort) enrichmentQuery = enrichmentQuery.sort(sort);
	const candidates = await enrichmentQuery.lean();
	if (!candidates.length) return { enrichments: [], productMap: new Map() };

	let productQuery = Product.find(
		previewProductFilter(
			{ ...productCommon, _id: { $in: candidates.map((e) => e.productId) } },
			productPublished,
			visibleDraftProductIds(candidates),
		),
	);
	if (productSelect) productQuery = productQuery.select(productSelect);
	const products = await productQuery.lean();
	const productMap = new Map(products.map((product) => [String(product._id), product]));

	const enrichments = candidates
		.filter((enrichment) => productMap.has(String(enrichment.productId)))
		.map((enrichment) =>
			overlayDraft(enrichment, {
				published: !!productMap.get(String(enrichment.productId))?.isPublished,
			}),
		)
		.filter((enrichment) => matchesQuery(enrichment, query));

	return { enrichments, productMap };
}
