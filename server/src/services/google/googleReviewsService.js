import GoogleReviewSnapshot from "../../models/GoogleReviewSnapshot.js";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1/places";

function clean(value = "") {
  return String(value || "").trim();
}

function getPlaceId() {
  return clean(process.env.GOOGLE_PLACE_ID || process.env.GOOGLE_REVIEWS_PLACE_ID);
}

function getApiKey() {
  return clean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY);
}

function buildWriteReviewUrl(placeId) {
  if (!placeId) return "";
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

function normalizeReview(review = {}) {
  const author = review.authorAttribution || review.author_attribution || {};
  const textObject = review.originalText || review.text || {};
  const text =
    typeof textObject === "string"
      ? textObject
      : clean(textObject.text || review.text?.text || review.originalText?.text);

  return {
    reviewId: clean(review.name || review.id || `${author.displayName || "review"}-${review.publishTime || ""}`),
    authorName: clean(author.displayName || review.authorName || review.author_name || "Google User"),
    authorUrl: clean(author.uri || review.authorUrl || review.author_url),
    profilePhotoUrl: clean(author.photoUri || review.profilePhotoUrl || review.profile_photo_url),
    rating: Number(review.rating || 0),
    text,
    dateLabel: clean(review.relativePublishTimeDescription || review.relative_time_description || "Google review"),
    publishTime: review.publishTime ? new Date(review.publishTime) : null,
    languageCode: clean(textObject.languageCode || review.text?.languageCode || review.languageCode),
  };
}

function normalizePlaceResponse(placeId, place = {}) {
  const displayName = place.displayName || {};
  const reviews = Array.isArray(place.reviews) ? place.reviews.map(normalizeReview) : [];

  return {
    placeId,
    placeName: clean(displayName.text || place.name || "Google Reviews"),
    rating: Number(place.rating || 0),
    reviewCount: Number(place.userRatingCount || place.user_ratings_total || 0),
    googleMapsUrl: clean(place.googleMapsUri || place.url || ""),
    writeReviewUrl: buildWriteReviewUrl(placeId),
    reviews: reviews.filter((item) => item.rating || item.text),
    lastSyncedAt: new Date(),
    syncStatus: "success",
    syncError: "",
    raw: place,
  };
}

export async function getGoogleReviewSnapshot({ includeRaw = false } = {}) {
  const placeId = getPlaceId();

  if (!placeId) {
    return null;
  }

  const query = GoogleReviewSnapshot.findOne({ placeId }).lean();
  if (!includeRaw) query.select("-raw");
  return query;
}

export async function syncGoogleReviews({ triggeredBy = "manual" } = {}) {
  const placeId = getPlaceId();
  const apiKey = getApiKey();

  if (!placeId) {
    throw new Error("Missing GOOGLE_PLACE_ID in server environment variables.");
  }

  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY in server environment variables.");
  }

  const fieldMask = [
    "id",
    "displayName",
    "rating",
    "userRatingCount",
    "googleMapsUri",
    "reviews",
  ].join(",");

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Google Places request failed (${response.status})`;

    await GoogleReviewSnapshot.findOneAndUpdate(
      { placeId },
      {
        $set: {
          placeId,
          writeReviewUrl: buildWriteReviewUrl(placeId),
          syncStatus: "failed",
          syncError: message,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    throw new Error(message);
  }

  const normalized = normalizePlaceResponse(placeId, data || {});

  const snapshot = await GoogleReviewSnapshot.findOneAndUpdate(
    { placeId },
    {
      $set: {
        ...normalized,
        raw: data,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true }
  ).lean();

  return {
    triggeredBy,
    snapshot: {
      ...snapshot,
      raw: undefined,
    },
  };
}

export function mapGoogleReviewSnapshotForPublic(snapshot) {
  if (!snapshot) {
    return {
      summary: {
        rating: 0,
        reviewCount: 0,
        sourceLabel: "Google Reviews",
        googleMapsUrl: "",
        writeReviewUrl: "",
        lastSyncedAt: null,
      },
      reviews: [],
    };
  }

  return {
    summary: {
      rating: Number(snapshot.rating || 0),
      reviewCount: Number(snapshot.reviewCount || 0),
      sourceLabel: "Google Reviews",
      googleMapsUrl: snapshot.googleMapsUrl || "",
      writeReviewUrl: snapshot.writeReviewUrl || buildWriteReviewUrl(snapshot.placeId),
      lastSyncedAt: snapshot.lastSyncedAt || null,
      syncStatus: snapshot.syncStatus || "never",
    },
    reviews: (Array.isArray(snapshot.reviews) ? snapshot.reviews : []).map((review, index) => ({
      id: review.reviewId || `google-review-${index}`,
      _id: review.reviewId || `google-review-${index}`,
      authorName: review.authorName || "Google User",
      authorUrl: review.authorUrl || "",
      profilePhotoUrl: review.profilePhotoUrl || "",
      rating: Number(review.rating || 0),
      text: review.text || "",
      dateLabel: review.dateLabel || "Google review",
      publishTime: review.publishTime || null,
      source: "google",
    })),
  };
}
