import Review from "../models/Review.js";

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
    const approvedWebsiteReviews = await Review.find({
      status: "approved",
      source: "website",
    })
      .sort({ isFeatured: -1, approvedAt: -1, createdAt: -1 })
      .limit(12)
      .lean();

    const approvedGoogleReviews = await Review.find({
      status: "approved",
      source: "google",
    })
      .sort({ isFeatured: -1, approvedAt: -1, createdAt: -1 })
      .limit(12)
      .lean();

    const merged = [...approvedGoogleReviews, ...approvedWebsiteReviews]
      .sort((a, b) => {
        const aFeatured = a.isFeatured ? 1 : 0;
        const bFeatured = b.isFeatured ? 1 : 0;
        if (aFeatured !== bFeatured) return bFeatured - aFeatured;

        const aDate = new Date(a.approvedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.approvedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 10);

    const websiteApprovedCount = await Review.countDocuments({
      status: "approved",
      source: "website",
    });

    const googleApprovedCount = await Review.countDocuments({
      status: "approved",
      source: "google",
    });

    const allApproved = [...approvedGoogleReviews, ...approvedWebsiteReviews];
    const ratingAverage = allApproved.length
      ? allApproved.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
        allApproved.length
      : 0;

    return res.json({
      summary: {
        rating: Number(ratingAverage.toFixed(1)),
        reviewCount: websiteApprovedCount + googleApprovedCount,
        sourceLabel: "Customer Reviews",
      },
      reviews: merged.map(mapReviewRow),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load home reviews" });
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