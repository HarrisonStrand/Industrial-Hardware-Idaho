import { runFishbowlProductIntakeScan } from "./syncFishbowlProductIntake.js";

let schedulerState = {
	enabled: false,
	intervalMinutes: 0,
	mode: "all",
	activeOnly: true,
	skipCleanupCandidates: true,
	runOnStartup: false,
	startupDelaySeconds: 0,
	startedAt: null,
	lastRunAt: null,
	nextRunAt: null,
	lastError: null,
};

let intervalHandle = null;
let startupHandle = null;

function boolEnv(name, fallback = false) {
	const value = process.env[name];
	if (value === undefined || value === null || value === "") return fallback;
	return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function intEnv(name, fallback = 0) {
	const num = Number(process.env[name]);
	return Number.isFinite(num) ? num : fallback;
}

function resolveConfig() {
	const requestedInterval = intEnv("FISHBOWL_PRODUCT_INTAKE_SYNC_INTERVAL_MINUTES", 1440);
	const intervalMinutes = Math.max(60, requestedInterval);
	const mode = ["new", "changed", "all"].includes(String(process.env.FISHBOWL_PRODUCT_INTAKE_SYNC_MODE || "all").toLowerCase())
		? String(process.env.FISHBOWL_PRODUCT_INTAKE_SYNC_MODE || "all").toLowerCase()
		: "all";

	return {
		enabled: boolEnv("FISHBOWL_PRODUCT_INTAKE_SYNC_ENABLED", false),
		intervalMinutes,
		mode,
		activeOnly: boolEnv("FISHBOWL_PRODUCT_INTAKE_ACTIVE_ONLY", true),
		skipCleanupCandidates: boolEnv("FISHBOWL_PRODUCT_INTAKE_SKIP_CLEANUP", true),
		runOnStartup: boolEnv("FISHBOWL_PRODUCT_INTAKE_SYNC_RUN_ON_STARTUP", false),
		startupDelaySeconds: Math.max(0, intEnv("FISHBOWL_PRODUCT_INTAKE_SYNC_STARTUP_DELAY_SECONDS", 90)),
	};
}

function setNextRunFromNow(intervalMinutes) {
	return new Date(Date.now() + intervalMinutes * 60 * 1000);
}

async function runScheduledProductIntakeScan() {
	const config = resolveConfig();
	try {
		schedulerState.lastRunAt = new Date();
		schedulerState.lastError = null;
		await runFishbowlProductIntakeScan({
			mode: config.mode,
			activeOnly: config.activeOnly,
			skipCleanupCandidates: config.skipCleanupCandidates,
			samples: true,
			triggeredBy: "product-intake-scheduler",
			persistRun: true,
		});
	} catch (err) {
		schedulerState.lastError = err?.message || "Product intake scan failed";
		console.error("❌ Scheduled Fishbowl product intake scan failed:", err);
	} finally {
		schedulerState.nextRunAt = setNextRunFromNow(config.intervalMinutes);
	}
}

export function startFishbowlProductIntakeScheduler() {
	const config = resolveConfig();

	if (!config.enabled) {
		schedulerState = {
			...schedulerState,
			...config,
			enabled: false,
			startedAt: null,
			nextRunAt: null,
		};
		return schedulerState;
	}

	if (intervalHandle) return schedulerState;

	schedulerState = {
		...schedulerState,
		...config,
		enabled: true,
		startedAt: new Date(),
		nextRunAt: setNextRunFromNow(config.intervalMinutes),
		lastError: null,
	};

	intervalHandle = setInterval(
		runScheduledProductIntakeScan,
		config.intervalMinutes * 60 * 1000,
	);

	if (config.runOnStartup) {
		startupHandle = setTimeout(
			runScheduledProductIntakeScan,
			config.startupDelaySeconds * 1000,
		);
	}

	console.log(
		`🧭 Fishbowl product intake scheduler enabled: every ${config.intervalMinutes} minutes, mode=${config.mode}, activeOnly=${config.activeOnly}, skipCleanup=${config.skipCleanupCandidates}`,
	);

	return schedulerState;
}

export function stopFishbowlProductIntakeScheduler() {
	if (intervalHandle) clearInterval(intervalHandle);
	if (startupHandle) clearTimeout(startupHandle);
	intervalHandle = null;
	startupHandle = null;
	schedulerState = {
		...schedulerState,
		enabled: false,
		nextRunAt: null,
	};
	return schedulerState;
}

export function getFishbowlProductIntakeSchedulerState() {
	return { ...schedulerState };
}
