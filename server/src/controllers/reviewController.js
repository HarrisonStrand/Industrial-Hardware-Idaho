import Review from "../models/Review.js";
import {
  getGoogleReviewSnapshot,
  mapGoogleReviewSnapshotForPublic,
  syncGoogleReviews,
} from "../services/google/googleReviewsService.js";

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeStatus(value = "") {
  const status = clean(value).toLowerCase();
  if (["pending", "approved", "rejected"].includes(status)) return status;
  return "pending";
}

function mapReviewRow(review) {
  return {
    _id: review._id,
    authorName: review.authorName || "",
    email: review.email || "",
    rating: Number(review.rating || 0),
    text: review.text || "",
    source: review.source || "website",
    status: review.status || "pending",
    isFeatured: !!review.isFeatured,
    submittedAt: review.submittedAt || review.createdAt || null,
    dateLabel: review.dateLabel || "",
    externalUrl: review.externalUrl || "",
  };
}

export async function getHomeReviews(req, res) {
  try {
    const snapshot = await getGoogleReviewSnapshot();
    const googlePayload = mapGoogleReviewSnapshotForPublic(snapshot);

    // Keep the old website-review data as a soft fallback only.
    // Once Google reviews have been synced, the public site uses the Google snapshot.
    if (googlePayload.reviews.length || googlePayload.summary.reviewCount) {
      return res.json(googlePayload);
    }

    const approvedWebsiteReviews = await Review.find({
      status: "approved",
      source: "website",
    })
      .sort({ isFeatured: -1, approvedAt: -1, createdAt: -1 })
      .limit(10)
      .lean();

    const ratingAverage = approvedWebsiteReviews.length
      ? approvedWebsiteReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
        approvedWebsiteReviews.length
      : 0;

    return res.json({
      summary: {
        rating: Number(ratingAverage.toFixed(1)),
        reviewCount: approvedWebsiteReviews.length,
        sourceLabel: "Customer Reviews",
        googleMapsUrl: "",
        writeReviewUrl: "",
        lastSyncedAt: null,
        syncStatus: "never",
      },
      reviews: approvedWebsiteReviews.map(mapReviewRow),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load home reviews" });
  }
}

export async function getGoogleReviewsPublic(req, res) {
  try {
    const snapshot = await getGoogleReviewSnapshot();
    return res.json(mapGoogleReviewSnapshotForPublic(snapshot));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load Google reviews" });
  }
}

export async function createWebsiteReview(req, res) {
  try {
    const authorName = clean(req.body?.authorName);
    const email = clean(req.body?.email);
    const text = clean(req.body?.text);
    const rating = Number(req.body?.rating || 0);

    if (!authorName) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!text) {
      return res.status(400).json({ message: "Review text is required" });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const review = await Review.create({
      authorName,
      email,
      text,
      rating,
      source: "website",
      status: "pending",
      submittedAt: new Date(),
      dateLabel: "Submitted just now",
      isFeatured: false,
    });

    return res.status(201).json({
      success: true,
      review: mapReviewRow(review),
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || "Failed to submit review" });
  }
}

export async function getAdminReviewSummary(req, res) {
  try {
    const summary = {
      byStatus: {
        pending: await Review.countDocuments({ status: "pending" }),
        approved: await Review.countDocuments({ status: "approved" }),
        rejected: await Review.countDocuments({ status: "rejected" }),
      },
      featuredApproved: await Review.countDocuments({
        status: "approved",
        isFeatured: true,
      }),
    };

    return res.json(summary);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load review summary" });
  }
}

export async function listAdminReviews(req, res) {
  try {
    const status = normalizeStatus(req.query?.status || "pending");

    const items = await Review.find({ status })
      .sort({ isFeatured: -1, submittedAt: -1, createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      items: items.map(mapReviewRow),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load admin reviews" });
  }
}

export async function getAdminReviewDetail(req, res) {
  try {
    const review = await Review.findById(req.params.id).lean();

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    return res.json(mapReviewRow(review));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load review detail" });
  }
}

export async function approveAdminReview(req, res) {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.status = "approved";
    review.approvedAt = new Date();
    review.approvedBy = req.user?.id || null;
    review.rejectedAt = null;
    review.rejectedBy = null;

    await review.save();

    return res.json({
      success: true,
      review: mapReviewRow(review),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to approve review" });
  }
}

export async function rejectAdminReview(req, res) {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.status = "rejected";
    review.rejectedAt = new Date();
    review.rejectedBy = req.user?.id || null;
    review.isFeatured = false;

    await review.save();

    return res.json({
      success: true,
      review: mapReviewRow(review),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to reject review" });
  }
}

export async function toggleFeaturedAdminReview(req, res) {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.status !== "approved") {
      return res.status(400).json({
        message: "Only approved reviews can be featured",
      });
    }

    review.isFeatured = !review.isFeatured;
    await review.save();

    return res.json({
      success: true,
      review: mapReviewRow(review),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update featured status" });
  }
}

export async function getAdminGoogleReviews(req, res) {
  try {
    const snapshot = await getGoogleReviewSnapshot();
    const publicPayload = mapGoogleReviewSnapshotForPublic(snapshot);

    return res.json({
      configured: Boolean(process.env.GOOGLE_PLACE_ID || process.env.GOOGLE_REVIEWS_PLACE_ID),
      hasApiKey: Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      snapshot: snapshot
        ? {
            placeId: snapshot.placeId,
            placeName: snapshot.placeName,
            rating: snapshot.rating,
            reviewCount: snapshot.reviewCount,
            googleMapsUrl: snapshot.googleMapsUrl,
            writeReviewUrl: snapshot.writeReviewUrl,
            lastSyncedAt: snapshot.lastSyncedAt,
            syncStatus: snapshot.syncStatus,
            syncError: snapshot.syncError,
          }
        : null,
      summary: publicPayload.summary,
      reviews: publicPayload.reviews,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load Google review admin data" });
  }
}

export async function syncAdminGoogleReviews(req, res) {
  try {
    const result = await syncGoogleReviews({ triggeredBy: req.user?.id || "admin" });
    const publicPayload = mapGoogleReviewSnapshotForPublic(result.snapshot);

    return res.json({
      success: true,
      message: "Google reviews synced successfully",
      snapshot: {
        placeId: result.snapshot.placeId,
        placeName: result.snapshot.placeName,
        rating: result.snapshot.rating,
        reviewCount: result.snapshot.reviewCount,
        googleMapsUrl: result.snapshot.googleMapsUrl,
        writeReviewUrl: result.snapshot.writeReviewUrl,
        lastSyncedAt: result.snapshot.lastSyncedAt,
        syncStatus: result.snapshot.syncStatus,
        syncError: result.snapshot.syncError,
      },
      summary: publicPayload.summary,
      reviews: publicPayload.reviews,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: err.message || "Failed to sync Google reviews",
    });
  }
}
