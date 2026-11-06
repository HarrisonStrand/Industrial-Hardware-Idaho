import { runFishbowlPriceSync } from "./syncFishbowlPrices.js";
import { runFishbowlPricingRulesCopy } from "./syncFishbowlPricingRules.js";

// Runs the Fishbowl price sync once a day, then refreshes the copy of Fishbowl's pricing rules and costs. Off unless FISHBOWL_PRICE_SYNC_ENABLED=true (set it on the
// live server only, so a local copy never changes prices).
//   FISHBOWL_PRICE_SYNC_HOUR_UTC   hour of day to run, 0-23 (default 9 = 2-3 am Mountain time)

let timeoutId = null;
let schedulerState = {
	enabled: false,
	hourUtc: 9,
	nextRunAt: null,
	lastStartedAt: null,
	lastFinishedAt: null,
	lastError: "",
};

function boolEnv(name, fallback = false) {
	const raw = process.env[name];
	if (raw === undefined || raw === null || raw === "") return fallback;
	return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

export function getFishbowlPriceSyncScheduleConfig() {
	const hour = Number(process.env.FISHBOWL_PRICE_SYNC_HOUR_UTC);
	return {
		enabled: boolEnv("FISHBOWL_PRICE_SYNC_ENABLED", false),
		hourUtc: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9,
	};
}

// The next time the clock reads hourUtc:00 UTC.
export function nextRunTime(hourUtc, from = new Date()) {
	const next = new Date(from);
	next.setUTCHours(hourUtc, 0, 0, 0);
	if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
	return next;
}

function scheduleNext() {
	const config = getFishbowlPriceSyncScheduleConfig();
	const next = nextRunTime(config.hourUtc);
	schedulerState.nextRunAt = next;
	timeoutId = setTimeout(runScheduled, next.getTime() - Date.now());
}

async function runScheduled() {
	try {
		schedulerState.lastStartedAt = new Date();
		schedulerState.lastError = "";
		const result = await runFishbowlPriceSync({ dryRun: false, triggeredBy: "schedule" });
		if (result?.stopped) schedulerState.lastError = result.message;
		try {
			await runFishbowlPricingRulesCopy({ triggeredBy: "schedule" });
		} catch (err) {
			schedulerState.lastError = `Rules copy: ${err?.message || "failed"}`;
			console.error("❌ Scheduled Fishbowl rules copy failed:", err);
		}
		schedulerState.lastFinishedAt = new Date();
	} catch (err) {
		schedulerState.lastError = err?.message || "Scheduled Fishbowl price sync failed";
		console.error("❌ Scheduled Fishbowl price sync failed:", err);
	} finally {
		scheduleNext();
	}
}

export function startFishbowlPriceSyncScheduler() {
	if (timeoutId) return schedulerState;
	const config = getFishbowlPriceSyncScheduleConfig();
	schedulerState = { ...schedulerState, enabled: config.enabled, hourUtc: config.hourUtc };

	if (!config.enabled) {
		console.log("⏸️ Fishbowl price sync schedule disabled");
		return schedulerState;
	}

	scheduleNext();
	console.log(`✅ Fishbowl price sync scheduled daily at ${config.hourUtc}:00 UTC`);
	return schedulerState;
}

export function getFishbowlPriceSyncSchedulerState() {
	const config = getFishbowlPriceSyncScheduleConfig();
	return { ...schedulerState, enabled: config.enabled, hourUtc: config.hourUtc };
}
