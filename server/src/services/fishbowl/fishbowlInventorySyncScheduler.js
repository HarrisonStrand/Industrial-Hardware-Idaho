import { runFishbowlInventoryMapSync } from "./syncFishbowlInventoryMap.js";

let intervalId = null;
let startupTimeoutId = null;
let schedulerState = {
  enabled: false,
  intervalMinutes: 0,
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

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getFishbowlInventorySyncScheduleConfig() {
  const intervalMinutes = Math.max(
    15,
    numberEnv("FISHBOWL_INVENTORY_SYNC_INTERVAL_MINUTES", 240),
  );

  return {
    enabled: boolEnv("FISHBOWL_INVENTORY_SYNC_ENABLED", false),
    runOnStartup: boolEnv("FISHBOWL_INVENTORY_SYNC_RUN_ON_STARTUP", false),
    startupDelaySeconds: numberEnv("FISHBOWL_INVENTORY_SYNC_STARTUP_DELAY_SECONDS", 60),
    intervalMinutes,
    category: process.env.FISHBOWL_INVENTORY_SYNC_CATEGORY || "bolts",
    inventoryPageSize: numberEnv("FISHBOWL_INVENTORY_SYNC_PAGE_SIZE", 100),
  };
}

function setNextRun(intervalMinutes) {
  schedulerState.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
}

async function runScheduledInventorySync(triggeredBy = "schedule") {
  const config = getFishbowlInventorySyncScheduleConfig();

  try {
    schedulerState.lastStartedAt = new Date();
    schedulerState.lastError = "";

    await runFishbowlInventoryMapSync({
      dryRun: false,
      samples: false,
      category: config.category,
      inventoryPageSize: config.inventoryPageSize,
      triggeredBy,
      persistRun: true,
    });

    schedulerState.lastFinishedAt = new Date();
  } catch (err) {
    schedulerState.lastError = err?.message || "Scheduled Fishbowl inventory sync failed";
    console.error("❌ Scheduled Fishbowl inventory sync failed:", err);
  } finally {
    setNextRun(config.intervalMinutes);
  }
}

export function startFishbowlInventorySyncScheduler() {
  if (intervalId || startupTimeoutId) return schedulerState;

  const config = getFishbowlInventorySyncScheduleConfig();

  schedulerState = {
    enabled: config.enabled,
    intervalMinutes: config.intervalMinutes,
    nextRunAt: null,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastError: "",
  };

  if (!config.enabled) {
    console.log("⏸️ Fishbowl inventory sync schedule disabled");
    return schedulerState;
  }

  setNextRun(config.intervalMinutes);

  intervalId = setInterval(
    () => runScheduledInventorySync("schedule"),
    config.intervalMinutes * 60 * 1000,
  );

  if (config.runOnStartup) {
    schedulerState.nextRunAt = new Date(Date.now() + config.startupDelaySeconds * 1000);
    startupTimeoutId = setTimeout(() => {
      startupTimeoutId = null;
      runScheduledInventorySync("startup-schedule");
    }, config.startupDelaySeconds * 1000);
  }

  console.log(
    `✅ Fishbowl inventory sync schedule enabled every ${config.intervalMinutes} minutes`,
  );

  return schedulerState;
}

export function getFishbowlInventorySyncSchedulerState() {
  const config = getFishbowlInventorySyncScheduleConfig();

  return {
    ...schedulerState,
    enabled: config.enabled,
    intervalMinutes: config.intervalMinutes,
    category: config.category,
    inventoryPageSize: config.inventoryPageSize,
    runOnStartup: config.runOnStartup,
    startupDelaySeconds: config.startupDelaySeconds,
  };
}
