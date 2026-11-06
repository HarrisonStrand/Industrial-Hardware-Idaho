// Run: npm --prefix server run test:draft-preview   (node --test, no database needed)
import test from "node:test";
import assert from "node:assert/strict";

import {
	buildReviewerInfo,
	familyGroup,
	isDraftPreview,
	isOverlayDraft,
	isVisibleDraft,
	matchesQuery,
	overlayDraft,
	parseVerifiedStandardReferences,
	widenToDrafts,
} from "../draftPreview.js";

const VERIFIED = new Set(["SAE J429 Grade 5"]);

function stagedEnrichment(draftOverrides = {}, liveOverrides = {}) {
	return {
		_id: "e1",
		productId: "p1",
		title: "Old title",
		shortTitle: "Old short",
		description: "Old description",
		category: "uncategorized",
		subcategory: "needs classification",
		attributes: {
			familyKey: "live-family",
			familySlug: "live-family",
			familyTitle: "Live Family",
			fastenerType: "hex cap screw",
			sku: "LIVE-SKU",
			fishbowlPartNum: "CC125SS",
			grade: "2",
		},
		images: [{ url: "https://live/manual.jpg", source: "manual", isPrimary: true, sortOrder: 0 }],
		seo: { slug: "old-slug", metaTitle: "Old meta" },
		...liveOverrides,
		agentDraft: {
			status: "ready-review",
			batchId: "B-001",
			title: "Zinc Steel Hex Cap Screw – 1/4\"-20 x 1\"",
			shortTitle: "New short",
			description: "New description",
			category: "bolts",
			subcategory: "hex cap screws",
			attributes: {
				grade: "5",
				material: "steel",
				sku: "DRAFT-SKU",
				familySlug: "draft-slug-ignored",
				"bad.key": "x",
				empty: "",
			},
			images: [{ url: "https://s3/maker.webp", origin: "manufacturer", sha256: "abc" }],
			specs: [
				{ name: "Tensile", value: "120 ksi", basis: "derived_from_standard", reference: "SAE J429 Grade 5" },
				{ name: "Unverified", value: "1", basis: "derived_from_standard", reference: "Unknown std" },
				{ name: "No source", value: "1", basis: "manufacturer" },
				{ name: "Thread", value: "UNC", basis: "manufacturer", sourceUrl: "https://maker" },
				{ name: "Guess", value: "1", basis: "generated" },
			],
			seo: { slug: "new-slug-123", metaTitle: "New meta" },
			manufacturer: { brand: "Brighton-Best", mfrPartNumber: "495013", matchConfidence: "high" },
			pricing: { basePrice: 0 },
			sku: "SHOULD-NOT-APPEAR",
			...draftOverrides,
		},
	};
}

// ── isDraftPreview ─────────────────────────────────────────────────────

test("isDraftPreview is on only with CATALOG_PREVIEW=drafts on a local, non-production server", () => {
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "drafts", NODE_ENV: "development" }), true);
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "drafts" }), true);
});

test("isDraftPreview is off without the flag or with another value", () => {
	assert.equal(isDraftPreview({}), false);
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "" }), false);
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "true" }), false);
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "DRAFTS" }), false);
});

test("isDraftPreview is off in production", () => {
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "drafts", NODE_ENV: "production" }), false);
});

test("isDraftPreview is off on Render", () => {
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "drafts", RENDER: "true" }), false);
	assert.equal(isDraftPreview({ CATALOG_PREVIEW: "drafts", RENDER_SERVICE_ID: "srv-123" }), false);
	assert.equal(
		isDraftPreview({ CATALOG_PREVIEW: "drafts", NODE_ENV: "development", RENDER: "1", RENDER_SERVICE_ID: "x" }),
		false,
	);
});

test("isDraftPreview reads process.env by default", () => {
	const saved = { ...process.env };
	try {
		delete process.env.RENDER;
		delete process.env.RENDER_SERVICE_ID;
		process.env.NODE_ENV = "development";
		process.env.CATALOG_PREVIEW = "drafts";
		assert.equal(isDraftPreview(), true);
		process.env.NODE_ENV = "production";
		assert.equal(isDraftPreview(), false);
	} finally {
		for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
		Object.assign(process.env, saved);
	}
});

// ── which drafts count ─────────────────────────────────────────────────

test("withdrawn, rejected and audit-excluded drafts are ignored", () => {
	for (const status of ["draft", "rejected", undefined]) {
		const enrichment = stagedEnrichment({ status });
		assert.equal(overlayDraft(enrichment, { verifiedRefs: VERIFIED }), enrichment, `status ${status}`);
		assert.equal(isVisibleDraft(enrichment.agentDraft), false);
	}
	const excluded = stagedEnrichment({ audit: { excluded: "duplicate row" } });
	assert.equal(overlayDraft(excluded, { verifiedRefs: VERIFIED }), excluded);
	assert.equal(isVisibleDraft(excluded.agentDraft), false);
	// A withdrawn draft is status "draft" with audit.excluded set.
	const withdrawn = stagedEnrichment({ status: "draft", audit: { excluded: "not stocked" } });
	assert.equal(overlayDraft(withdrawn, { verifiedRefs: VERIFIED }).title, "Old title");
});

test("ready-review and approved drafts overlay; promoted drafts show but are not laid over again", () => {
	assert.equal(isOverlayDraft({ status: "ready-review" }), true);
	assert.equal(isOverlayDraft({ status: "approved" }), true);
	assert.equal(isOverlayDraft({ status: "promoted" }), false);
	assert.equal(isVisibleDraft({ status: "promoted" }), true);
	assert.equal(isOverlayDraft({ status: "approved", audit: { excluded: false } }), true);
	assert.equal(overlayDraft(stagedEnrichment({ status: "approved" }), { verifiedRefs: VERIFIED }).title.startsWith("Zinc"), true);
});

test("an enrichment without a draft, or no enrichment, comes back unchanged", () => {
	const plain = { _id: "e", title: "Live" };
	assert.equal(overlayDraft(plain), plain);
	assert.equal(overlayDraft(null), null);
});

// ── the overlay ───────────────────────────────────────────────────────

test("text, placement, images, documents and manufacturer come from the draft", () => {
	const out = overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED });
	assert.equal(out.title, "Zinc Steel Hex Cap Screw – 1/4\"-20 x 1\"");
	assert.equal(out.shortTitle, "New short");
	assert.equal(out.description, "New description");
	assert.equal(out.category, "bolts");
	assert.equal(out.subcategory, "hex cap screws");
	assert.equal(out.manufacturer.mfrPartNumber, "495013");
	assert.equal(out.websiteBrand, "Brighton-Best");
	// staged image first and primary, the manual live image kept after it
	assert.equal(out.images[0].url, "https://s3/maker.webp");
	assert.equal(out.images[0].isPrimary, true);
	assert.equal(out.images[0].source, "vendor");
	assert.equal(out.images[1].url, "https://live/manual.jpg");
	assert.equal(out.images[1].isPrimary, false);
	assert.equal(out.images[1].sortOrder, 1);
});

test("AI and site images are always marked representative", () => {
	const out = overlayDraft(
		stagedEnrichment({ images: [{ url: "u", origin: "ai_generated", representative: false }, { url: "v", origin: "bogus" }] }),
		{ verifiedRefs: VERIFIED },
	);
	assert.equal(out.images[0].representative, true);
	assert.equal(out.images.some((image) => image.url === "v"), false);
});

test("attributes are merged key by key over the live attributes, never replaced", () => {
	const out = overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED });
	assert.equal(out.attributes.grade, "5", "draft value wins");
	assert.equal(out.attributes.material, "steel", "new key added");
	assert.equal(out.attributes.fastenerType, "hex cap screw", "live key the draft lacks is kept");
	assert.equal(out.attributes.sku, "LIVE-SKU", "never-write key keeps the live value");
	assert.equal(out.attributes.fishbowlPartNum, "CC125SS");
	assert.equal("bad.key" in out.attributes, false);
	assert.equal("empty" in out.attributes, false);
});

test("the storefront family follows the promoted title (regroup)", () => {
	const out = overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED });
	assert.equal(out.attributes.familyKey, "bolts|hex cap screws|zinc steel hex cap screw");
	assert.equal(out.attributes.familySlug, "zinc-steel-hex-cap-screw");
	assert.equal(out.attributes.familyTitle, "Zinc Steel Hex Cap Screw");

	const metric = familyGroup({ title: "Fully Threaded Hex Cap Screw – M8", category: "bolts", subcategory: "x", attributes: { measurementSystem: "metric" } });
	assert.equal(metric.familyTitle, "Metric Hex Cap Screw");
	assert.deepEqual(familyGroup({ title: "No size", category: "a", subcategory: "b" }), {});
});

test("without a sized title the curator familyKey fills only an empty live family", () => {
	const noTitle = stagedEnrichment({ title: "Collar", familyKey: "draft-family" });
	assert.equal(overlayDraft(noTitle, { verifiedRefs: VERIFIED }).attributes.familyKey, "live-family");
	const noLive = stagedEnrichment({ title: "Collar", familyKey: "draft-family" }, { attributes: {} });
	assert.equal(overlayDraft(noLive, { verifiedRefs: VERIFIED }).attributes.familyKey, "draft-family");
});

test("specs follow promote: valid basis, verified standard, maker source URL", () => {
	const out = overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED });
	assert.deepEqual(out.specs.map((spec) => spec.name), ["Tensile", "Thread"]);
});

test("Product fields are untouched: draft pricing, sku and inventory never reach the result", () => {
	const enrichment = stagedEnrichment({ inventory: { qtyOnHand: 999 }, internalPartNumber: "X" });
	const out = overlayDraft(enrichment, { verifiedRefs: VERIFIED });
	for (const key of ["sku", "pricing", "inventory", "internalPartNumber", "fishbowl", "isPublished", "isActive"]) {
		assert.equal(key in out, false, `${key} must not be set by the overlay`);
	}
	assert.equal(out._id, "e1");
	assert.equal(out.productId, "p1");
});

test("the input enrichment is not changed", () => {
	const enrichment = stagedEnrichment();
	const before = JSON.stringify(enrichment);
	overlayDraft(enrichment, { verifiedRefs: VERIFIED });
	assert.equal(JSON.stringify(enrichment), before);
});

test("locks keep the live values", () => {
	const out = overlayDraft(
		stagedEnrichment({}, {
			overrideFlags: { lockTitle: true, lockCategory: true, lockAttributes: true, lockImages: true, lockSpecs: true, lockSeo: true },
		}),
		{ verifiedRefs: VERIFIED },
	);
	assert.equal(out.title, "Old title");
	assert.equal(out.category, "uncategorized");
	assert.equal(out.attributes.grade, "2");
	assert.equal(out.attributes.familyKey, "live-family");
	assert.equal(out.images[0].url, "https://live/manual.jpg");
	assert.equal(out.seo.slug, "old-slug");
	assert.equal(out.description, "New description", "description has its own lock");
});

test("slug: staged unless the product is published with a live slug, or the slug is taken", () => {
	assert.equal(overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED }).seo.slug, "new-slug-123");
	assert.equal(overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED, published: true }).seo.slug, "old-slug");
	assert.equal(overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED, slugTaken: true }).seo.slug, "old-slug");
	const out = overlayDraft(stagedEnrichment(), { verifiedRefs: VERIFIED, published: true });
	assert.equal(out.seo.metaTitle, "New meta");
});

// ── reviewer strip ────────────────────────────────────────────────────

test("reviewer info names the row", () => {
	const info = buildReviewerInfo(
		{ fishbowl: { partId: "44571", partNum: "CC125SS" }, sku: "CC125SS", isPublished: false },
		stagedEnrichment(),
	);
	assert.deepEqual(
		{ ...info },
		{
			partId: "44571",
			ihiPartNumber: "CC125SS",
			batch: "B-001",
			maker: "Brighton-Best",
			makerNumber: "495013",
			confidence: "high",
			status: "ready-review",
			qa: "",
			published: false,
		},
	);
	const promoted = buildReviewerInfo({ isPublished: false }, stagedEnrichment({ status: "promoted" }));
	assert.equal(promoted.status, "promoted (not published)");
});

// ── query helpers ─────────────────────────────────────────────────────

test("widenToDrafts matches the live or the staged field; matchesQuery re-checks the overlaid row", () => {
	const query = { category: /^wire hardware$/i, subcategory: /^shaft collars$/i };
	assert.deepEqual(widenToDrafts(query), {
		$and: [
			{ $or: [{ category: query.category }, { "agentDraft.category": query.category }] },
			{ $or: [{ subcategory: query.subcategory }, { "agentDraft.subcategory": query.subcategory }] },
		],
	});
	const row = overlayDraft(
		stagedEnrichment({ category: "wire hardware", subcategory: "shaft collars", title: "Collar" }),
		{ verifiedRefs: VERIFIED },
	);
	assert.equal(matchesQuery(row, query), true);
	assert.equal(matchesQuery(stagedEnrichment(), query), false);
	assert.equal(matchesQuery({ tags: ["a", "Zinc"] }, { $or: [{ title: /zinc/i }, { tags: /zinc/i }] }), true);
	assert.equal(matchesQuery({ category: "Bolts" }, { category: { $in: ["bolts", "Bolts"] } }), true);
});

test("verified standard references are read from the markdown table", () => {
	const text = [
		"| Reference | Tensile | verified |",
		"|---|---|---|",
		"| `SAE J429 Grade 5` | 120 ksi | yes |",
		"| ASTM A307 | 60 ksi | no |",
		"",
	].join("\n");
	assert.deepEqual([...parseVerifiedStandardReferences(text)], ["SAE J429 Grade 5"]);
});
