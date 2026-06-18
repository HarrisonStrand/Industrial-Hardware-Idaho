import "../config/env.js";
import mongoose from "mongoose";

import { runFishbowlProductIntakeScan } from "../services/fishbowl/syncFishbowlProductIntake.js";

function parseArgs(argv = []) {
	const args = {
		mode: "all",
		dryRun: false,
		samples: false,
		limit: 0,
		pageLimit: 0,
		activeOnly: process.env.FISHBOWL_PRODUCT_INTAKE_ACTIVE_ONLY !== "false",
		skipCleanupCandidates: process.env.FISHBOWL_PRODUCT_INTAKE_SKIP_CLEANUP !== "false",
	};

	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else if (arg === "--samples") args.samples = true;
		else if (arg.startsWith("--mode=")) args.mode = arg.split("=").slice(1).join("=") || "all";
		else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=").slice(1).join("=")) || 0;
		else if (arg.startsWith("--page-limit=")) args.pageLimit = Number(arg.split("=").slice(1).join("=")) || 0;
		else if (arg === "--include-inactive") args.activeOnly = false;
		else if (arg === "--active-only") args.activeOnly = true;
		else if (arg.startsWith("--active-only=")) args.activeOnly = arg.split("=").slice(1).join("=") !== "false";
		else if (arg === "--include-cleanup") args.skipCleanupCandidates = false;
		else if (arg === "--skip-cleanup") args.skipCleanupCandidates = true;
		else if (arg.startsWith("--skip-cleanup=")) args.skipCleanupCandidates = arg.split("=").slice(1).join("=") !== "false";
	}

	return args;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	if (args.dryRun) console.log("🔎 Dry run only");

	const result = await runFishbowlProductIntakeScan({
		...args,
		triggeredBy: "terminal-script",
		persistRun: true,
	});

	console.log("===== FISHBOWL PRODUCT INTAKE SUMMARY =====");
	console.log(JSON.stringify(result.stats, null, 2));
	if (args.samples) {
		console.log("===== SAMPLES =====");
		console.log(JSON.stringify(result.samples, null, 2));
	}

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Product intake scan failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
