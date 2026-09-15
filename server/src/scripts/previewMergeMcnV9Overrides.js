// server/src/scripts/previewMergeMcnV6Overrides.js
//
// Safely previews merging the validated v6 MCN additions into the
// permanent verified MCN override file.
//
// Existing:
//   tmp/manufacturer-matching-mcn-overrides.csv
//
// New validated additions:
//   tmp/IHI_MCN_v6_override_additions.csv
//
// Outputs:
//   tmp/manufacturer-matching-mcn-overrides-v6-preview.csv
//   tmp/manufacturer-matching-mcn-overrides-v6-merge-audit.csv
//   tmp/manufacturer-matching-mcn-overrides-v6-merge-summary.json
//
// IMPORTANT:
// This script DOES NOT modify manufacturer-matching-mcn-overrides.csv.

import fs from "fs";
import path from "path";

const MASTER_PATH = path.resolve(
	process.cwd(),
	"tmp",
	"manufacturer-matching-mcn-overrides.csv",
);

const ADDITIONS_PATH = path.resolve(
	process.cwd(),
	"tmp",
	"IHI_MCN_v9_override_additions.csv",
);

const PREVIEW_PATH = path.resolve(
	process.cwd(),
	"tmp",
	"manufacturer-matching-mcn-overrides-v9-preview.csv",
);

const AUDIT_PATH = path.resolve(
	process.cwd(),
	"tmp",
	"manufacturer-matching-mcn-overrides-v9-merge-audit.csv",
);

const SUMMARY_PATH = path.resolve(
	process.cwd(),
	"tmp",
	"manufacturer-matching-mcn-overrides-v9-merge-summary.json",
);

const REQUIRED_HEADERS = [
	"Internal ID",
	"IHI Part Number",
	"MCN",
	"Manufacturer / Match Hint",
	"MCN Match Status",
	"Rule",
	"IHI Description",
];

function clean(value = "") {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function normalize(value = "") {
	return clean(value).toUpperCase();
}

function parseCsv(text) {
	const rows = [];

	let row = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];

		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}

			continue;
		}

		if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			row.push(field);
			field = "";
		} else if (ch === "\n") {
			row.push(field.replace(/\r$/, ""));
			rows.push(row);

			row = [];
			field = "";
		} else {
			field += ch;
		}
	}

	if (field.length || row.length) {
		row.push(field.replace(/\r$/, ""));
		rows.push(row);
	}

	return rows.filter((row) => row.some((value) => clean(value) !== ""));
}

function rowsToObjects(parsedRows) {
	if (!parsedRows.length) {
		return {
			headers: [],
			rows: [],
		};
	}

	const headers = parsedRows[0].map(clean);

	const rows = parsedRows.slice(1).map((values) => {
		const obj = {};

		for (let i = 0; i < headers.length; i += 1) {
			obj[headers[i]] = values[i] ?? "";
		}

		return obj;
	});

	return {
		headers,
		rows,
	};
}

function csvEscape(value) {
	const text = String(value ?? "");

	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}

	return text;
}

function writeCsv(filePath, headers, rows) {
	const lines = [
		headers.map(csvEscape).join(","),

		...rows.map((row) =>
			headers.map((header) => csvEscape(row[header] ?? "")).join(","),
		),
	];

	fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function loadCsv(filePath, label) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`${label} file not found:\n${filePath}`);
	}

	const parsed = rowsToObjects(parseCsv(fs.readFileSync(filePath, "utf8")));

	if (!parsed.rows.length) {
		throw new Error(`${label} contains no data rows:\n${filePath}`);
	}

	const missingHeaders = REQUIRED_HEADERS.filter(
		(header) => !parsed.headers.includes(header),
	);

	if (missingHeaders.length) {
		throw new Error(
			`${label} is missing required columns: ${missingHeaders.join(", ")}`,
		);
	}

	return parsed;
}

function buildIndex(rows, field) {
	const map = new Map();

	for (let i = 0; i < rows.length; i += 1) {
		const key = normalize(rows[i][field]);

		if (!key) {
			continue;
		}

		if (!map.has(key)) {
			map.set(key, []);
		}

		map.get(key).push(i);
	}

	return map;
}

function findDuplicateKeys(index) {
	return Array.from(index.entries())
		.filter(([, indexes]) => indexes.length > 1)
		.map(([key, indexes]) => ({
			key,
			count: indexes.length,
			indexes,
		}));
}

function sameMcn(a, b) {
	return normalize(a["MCN"]) === normalize(b["MCN"]);
}

function sameIdentity(a, b) {
	return (
		normalize(a["Internal ID"]) === normalize(b["Internal ID"]) &&
		normalize(a["IHI Part Number"]) === normalize(b["IHI Part Number"])
	);
}

function sameOverride(a, b) {
	return (
		sameIdentity(a, b) &&
		sameMcn(a, b) &&
		normalize(a["MCN Match Status"]) === normalize(b["MCN Match Status"]) &&
		normalize(a["Rule"]) === normalize(b["Rule"])
	);
}

function makeAuditRow({ addition, existing = {}, result, notes = "" }) {
	return {
		"Internal ID": clean(addition["Internal ID"]),

		"IHI Part Number": clean(addition["IHI Part Number"]),

		Result: result,

		"Existing MCN": clean(existing["MCN"]),

		"New MCN": clean(addition["MCN"]),

		"Existing Status": clean(existing["MCN Match Status"]),

		"New Status": clean(addition["MCN Match Status"]),

		"Existing Rule": clean(existing["Rule"]),

		"New Rule": clean(addition["Rule"]),

		"Manufacturer / Match Hint": clean(addition["Manufacturer / Match Hint"]),

		Notes: notes,
	};
}

function main() {
	console.log("");
	console.log("===== MCN V6 MERGE PREVIEW =====");
	console.log("");

	const master = loadCsv(MASTER_PATH, "Permanent MCN override");

	const additions = loadCsv(ADDITIONS_PATH, "V6 override additions");

	/*
	 * ------------------------------------------------------------
	 * INITIAL DUPLICATE CHECKS
	 * ------------------------------------------------------------
	 */

	const masterIdIndex = buildIndex(master.rows, "Internal ID");

	const masterPartIndex = buildIndex(master.rows, "IHI Part Number");

	const additionIdIndex = buildIndex(additions.rows, "Internal ID");

	const additionPartIndex = buildIndex(additions.rows, "IHI Part Number");

	const duplicateMasterIds = findDuplicateKeys(masterIdIndex);

	const duplicateMasterParts = findDuplicateKeys(masterPartIndex);

	const duplicateAdditionIds = findDuplicateKeys(additionIdIndex);

	const duplicateAdditionParts = findDuplicateKeys(additionPartIndex);

	if (duplicateMasterIds.length) {
		throw new Error(
			`Permanent MCN override file contains ${duplicateMasterIds.length} duplicate Internal ID(s).`,
		);
	}

	if (duplicateMasterParts.length) {
		throw new Error(
			`Permanent MCN override file contains ${duplicateMasterParts.length} duplicate IHI Part Number(s).`,
		);
	}

	if (duplicateAdditionIds.length) {
		throw new Error(
			`V6 additions contain ${duplicateAdditionIds.length} duplicate Internal ID(s).`,
		);
	}

	if (duplicateAdditionParts.length) {
		throw new Error(
			`V6 additions contain ${duplicateAdditionParts.length} duplicate IHI Part Number(s).`,
		);
	}

	/*
	 * ------------------------------------------------------------
	 * BUILD PREVIEW
	 * ------------------------------------------------------------
	 */

	const previewRows = master.rows.map((row) => ({
		...row,
	}));

	const previewById = new Map(
		Array.from(masterIdIndex.entries()).map(([key, indexes]) => [
			key,
			indexes[0],
		]),
	);

	const previewByPart = new Map(
		Array.from(masterPartIndex.entries()).map(([key, indexes]) => [
			key,
			indexes[0],
		]),
	);

	const auditRows = [];

	const summary = {
		existingOverrides: master.rows.length,

		newAdditions: additions.rows.length,

		added: 0,

		alreadySame: 0,

		conflicts: 0,

		identityConflicts: 0,

		mcnConflicts: 0,

		ambiguousMatches: 0,

		finalPreviewRows: 0,
	};

	for (const addition of additions.rows) {
		const idKey = normalize(addition["Internal ID"]);

		const partKey = normalize(addition["IHI Part Number"]);

		const idMatchIndex =
			idKey && previewById.has(idKey) ? previewById.get(idKey) : null;

		const partMatchIndex =
			partKey && previewByPart.has(partKey) ? previewByPart.get(partKey) : null;

		/*
		 * BOTH MATCH
		 */
		if (idMatchIndex !== null && partMatchIndex !== null) {
			if (idMatchIndex !== partMatchIndex) {
				summary.conflicts += 1;
				summary.ambiguousMatches += 1;

				auditRows.push(
					makeAuditRow({
						addition,

						result: "AMBIGUOUS",

						notes:
							"Internal ID and IHI Part Number point to different permanent override rows.",
					}),
				);

				continue;
			}

			const existing = previewRows[idMatchIndex];

			if (sameOverride(existing, addition)) {
				summary.alreadySame += 1;

				auditRows.push(
					makeAuditRow({
						addition,
						existing,

						result: "ALREADY-SAME",

						notes: "Exact verified override already exists.",
					}),
				);

				continue;
			}

			if (sameIdentity(existing, addition) && !sameMcn(existing, addition)) {
				summary.conflicts += 1;
				summary.mcnConflicts += 1;

				auditRows.push(
					makeAuditRow({
						addition,
						existing,

						result: "MCN-CONFLICT",

						notes:
							"Same identity already exists with a different verified MCN.",
					}),
				);

				continue;
			}

			summary.conflicts += 1;

			auditRows.push(
				makeAuditRow({
					addition,
					existing,

					result: "METADATA-CONFLICT",

					notes:
						"Existing identity and MCN agree, but rule/status metadata differs.",
				}),
			);

			continue;
		}

		/*
		 * INTERNAL ID MATCH ONLY
		 */
		if (idMatchIndex !== null) {
			const existing = previewRows[idMatchIndex];

			summary.conflicts += 1;
			summary.identityConflicts += 1;

			auditRows.push(
				makeAuditRow({
					addition,
					existing,

					result: "INTERNAL-ID-CONFLICT",

					notes: `Internal ID already belongs to part number "${clean(
						existing["IHI Part Number"],
					)}".`,
				}),
			);

			continue;
		}

		/*
		 * PART NUMBER MATCH ONLY
		 */
		if (partMatchIndex !== null) {
			const existing = previewRows[partMatchIndex];

			summary.conflicts += 1;
			summary.identityConflicts += 1;

			auditRows.push(
				makeAuditRow({
					addition,
					existing,

					result: "PART-NUMBER-CONFLICT",

					notes: `IHI Part Number already belongs to Internal ID "${clean(
						existing["Internal ID"],
					)}".`,
				}),
			);

			continue;
		}

		/*
		 * NEW VERIFIED OVERRIDE
		 */

		const newRow = {};

		for (const header of REQUIRED_HEADERS) {
			newRow[header] = clean(addition[header]);
		}

		const newIndex = previewRows.length;

		previewRows.push(newRow);

		if (idKey) {
			previewById.set(idKey, newIndex);
		}

		if (partKey) {
			previewByPart.set(partKey, newIndex);
		}

		summary.added += 1;

		auditRows.push(
			makeAuditRow({
				addition,

				result: "ADDED",

				notes: "New verified Hindley v6 MCN override added to preview.",
			}),
		);
	}

	summary.finalPreviewRows = previewRows.length;

	/*
	 * ------------------------------------------------------------
	 * FINAL DUPLICATE CHECK
	 * ------------------------------------------------------------
	 */

	const finalIdIndex = buildIndex(previewRows, "Internal ID");

	const finalPartIndex = buildIndex(previewRows, "IHI Part Number");

	const finalDuplicateIds = findDuplicateKeys(finalIdIndex);

	const finalDuplicateParts = findDuplicateKeys(finalPartIndex);

	if (finalDuplicateIds.length || finalDuplicateParts.length) {
		throw new Error(
			`Merged preview produced duplicate identities. ` +
				`Duplicate IDs: ${finalDuplicateIds.length}. ` +
				`Duplicate part numbers: ${finalDuplicateParts.length}.`,
		);
	}

	/*
	 * ------------------------------------------------------------
	 * WRITE FILES
	 * ------------------------------------------------------------
	 */

	writeCsv(PREVIEW_PATH, REQUIRED_HEADERS, previewRows);

	const auditHeaders = [
		"Internal ID",
		"IHI Part Number",
		"Result",
		"Existing MCN",
		"New MCN",
		"Existing Status",
		"New Status",
		"Existing Rule",
		"New Rule",
		"Manufacturer / Match Hint",
		"Notes",
	];

	writeCsv(AUDIT_PATH, auditHeaders, auditRows);

	const passed =
		summary.conflicts === 0 &&
		finalDuplicateIds.length === 0 &&
		finalDuplicateParts.length === 0;

	const fullSummary = {
		version: "MCN-v6-merge-preview",

		passed,

		...summary,

		expectedCheckpoint: {
			existingOverrides: 1156,
			newAdditions: 51,
			expectedFinal: 1207,
		},

		structuralChecks: {
			duplicateMasterInternalIds: duplicateMasterIds.length,

			duplicateMasterPartNumbers: duplicateMasterParts.length,

			duplicateAdditionInternalIds: duplicateAdditionIds.length,

			duplicateAdditionPartNumbers: duplicateAdditionParts.length,

			duplicateFinalInternalIds: finalDuplicateIds.length,

			duplicateFinalPartNumbers: finalDuplicateParts.length,
		},

		files: {
			permanentMaster: MASTER_PATH,

			additions: ADDITIONS_PATH,

			preview: PREVIEW_PATH,

			audit: AUDIT_PATH,
		},
	};

	fs.writeFileSync(
		SUMMARY_PATH,
		`${JSON.stringify(fullSummary, null, 2)}\n`,
		"utf8",
	);

	/*
	 * ------------------------------------------------------------
	 * TERMINAL
	 * ------------------------------------------------------------
	 */

	console.log("===== MCN V6 MERGE PREVIEW SUMMARY =====");

	console.log(`Existing verified overrides: ${summary.existingOverrides}`);

	console.log(`New v6 additions:            ${summary.newAdditions}`);

	console.log(`✅ Added:                     ${summary.added}`);

	console.log(`ℹ️ Already same:              ${summary.alreadySame}`);

	console.log(`⚠️ Conflicts:                 ${summary.conflicts}`);

	console.log(`   Identity conflicts:        ${summary.identityConflicts}`);

	console.log(`   MCN conflicts:             ${summary.mcnConflicts}`);

	console.log(`   Ambiguous matches:         ${summary.ambiguousMatches}`);

	console.log(`Final preview rows:           ${summary.finalPreviewRows}`);

	console.log("");

	console.log("Structural duplicate checks:");

	console.log(`Master duplicate IDs:         ${duplicateMasterIds.length}`);

	console.log(`Master duplicate parts:       ${duplicateMasterParts.length}`);

	console.log(`Addition duplicate IDs:       ${duplicateAdditionIds.length}`);

	console.log(`Addition duplicate parts:     ${duplicateAdditionParts.length}`);

	console.log(`Final duplicate IDs:          ${finalDuplicateIds.length}`);

	console.log(`Final duplicate parts:        ${finalDuplicateParts.length}`);

	console.log("");

	console.log(`Preview: ${PREVIEW_PATH}`);

	console.log(`Audit:   ${AUDIT_PATH}`);

	console.log(`Summary: ${SUMMARY_PATH}`);

	console.log("");

	if (
		passed &&
		summary.existingOverrides === 1156 &&
		summary.newAdditions === 51 &&
		summary.added === 51 &&
		summary.finalPreviewRows === 1207
	) {
		console.log("✅ V9 merge preview passed perfectly.");

		console.log("✅ 1,156 existing + 51 new = 1,207 verified MCN overrides.");

		console.log(
			"✅ No duplicate identities or contradictory MCNs were detected.",
		);

		console.log(
			"ℹ️ Permanent manufacturer-matching-mcn-overrides.csv has NOT been modified.",
		);
	}
}

try {
	main();
} catch (err) {
	console.error("❌ MCN v6 merge preview failed:", err);

	process.exit(1);
}
