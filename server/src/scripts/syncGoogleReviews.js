import "../config/env.js";
import mongoose from "mongoose";
import { syncGoogleReviews } from "../services/google/googleReviewsService.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const result = await syncGoogleReviews({ triggeredBy: "script" });
  const snapshot = result.snapshot || {};

  console.log("===== GOOGLE REVIEWS SYNC =====");
  console.log(
    JSON.stringify(
      {
        placeId: snapshot.placeId,
        placeName: snapshot.placeName,
        rating: snapshot.rating,
        reviewCount: snapshot.reviewCount,
        reviewsCached: snapshot.reviews?.length || 0,
        googleMapsUrl: snapshot.googleMapsUrl,
        writeReviewUrl: snapshot.writeReviewUrl,
        lastSyncedAt: snapshot.lastSyncedAt,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Google reviews sync failed:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_err) {
    // ignore disconnect errors during failed startup
  }
  process.exit(1);
});
