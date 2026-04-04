import dotenv from "dotenv";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

dotenv.config();

async function run() {
  try {
    const result = await fishbowlClient.request({
      method: "GET",
      path: "/api/parts",
    });

    console.log("PARTS RESULT:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

run();