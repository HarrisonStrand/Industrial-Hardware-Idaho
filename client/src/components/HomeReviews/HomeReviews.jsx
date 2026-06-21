import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import "./HomeReviews.css";

const FALLBACK_DATA = {
  summary: {
    rating: 4.9,
    reviewCount: 87,
    sourceLabel: "Google Reviews",
    googleMapsUrl: "",
    writeReviewUrl: "",
  },
  reviews: [
    {
      id: "1",
      authorName: "Google Reviewer",
      rating: 5,
      text: "Great service, knowledgeable staff, and they helped us find exactly what we needed fast.",
      dateLabel: "Recent Google review",
      source: "google",
    },
    {
      id: "2",
      authorName: "Google Reviewer",
      rating: 5,
      text: "Very easy to work with and the ordering process was smooth.",
      dateLabel: "Recent Google review",
      source: "google",
    },
    {
      id: "3",
      authorName: "Google Reviewer",
      rating: 5,
      text: "Fast response time and excellent customer service.",
      dateLabel: "Recent Google review",
      source: "google",
    },
  ],
};

function StarRow({ rating = 0 }) {
  const rounded = Math.round(Number(rating || 0));

  return (
    <div className="d-flex align-items-center justify-content-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={`bi ${star <= rounded ? "bi-star-fill" : "bi-star"} review-star`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="home-review-card rounded-4 h-100 p-4">
      <div className="review-author-row">
        <div>
          <div className="text-main text-uppercase fw-bold review-author">
            {review.authorName || "Google User"}
          </div>
          <div className="small text-muted">{review.dateLabel || "Google review"}</div>
        </div>

        <div className="review-source-badge text-uppercase">Google</div>
      </div>

      <div className="review-stars-row">
        <StarRow rating={review.rating} />
      </div>

      <div className="text-main review-copy">
        “{review.text || "Great experience."}”
      </div>
    </div>
  );
}

export default function HomeReviews() {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const response = await apiFetch("/api/reviews/home");
        if (!alive) return;

        const safeReviews = Array.isArray(response?.reviews) ? response.reviews : [];
        const safeSummary = response?.summary || FALLBACK_DATA.summary;

        setData({
          summary: safeSummary,
          reviews: safeReviews.length ? safeReviews : FALLBACK_DATA.reviews,
        });
      } catch (err) {
        console.error("Failed to load Google reviews:", err);
        if (alive) setData(FALLBACK_DATA);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  const reviews = useMemo(() => {
    return Array.isArray(data?.reviews) ? data.reviews : [];
  }, [data]);

  const extendedReviews = useMemo(() => {
    if (!reviews.length) return [];
    if (reviews.length === 1) return reviews;
    return [reviews[reviews.length - 1], ...reviews, reviews[0]];
  }, [reviews]);

  useEffect(() => {
    setActiveIndex(0);
    setIsTransitioning(true);
  }, [reviews.length]);

  useEffect(() => {
    if (reviews.length <= 1) return;

    const interval = window.setInterval(() => {
      setIsTransitioning(true);
      setActiveIndex((prev) => prev + 1);
    }, 5500);

    return () => window.clearInterval(interval);
  }, [reviews.length]);

  useEffect(() => {
    if (reviews.length <= 1) return;

    if (activeIndex === reviews.length) {
      const timeout = window.setTimeout(() => {
        setIsTransitioning(false);
        setActiveIndex(0);
      }, 500);

      return () => window.clearTimeout(timeout);
    }

    if (activeIndex < 0) {
      const timeout = window.setTimeout(() => {
        setIsTransitioning(false);
        setActiveIndex(reviews.length - 1);
      }, 500);

      return () => window.clearTimeout(timeout);
    }
  }, [activeIndex, reviews.length]);

  useEffect(() => {
    if (!isTransitioning) {
      const frame = window.requestAnimationFrame(() => {
        const frame2 = window.requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
        return () => window.cancelAnimationFrame(frame2);
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [isTransitioning]);

  const displayIndex = reviews.length > 1 ? activeIndex + 1 : activeIndex;
  const googleMapsUrl = data?.summary?.googleMapsUrl || "";
  const writeReviewUrl = data?.summary?.writeReviewUrl || googleMapsUrl;

  return (
    <section className="container-fluid px-3 px-sm-4 py-4 justify-content-center">
      <div className="theme-section-container home-reviews-shell rounded-4 p-3 p-md-2 mx-auto mb-5">
        <div className="row justify-content-center align-items-end pb-0 mb-0 mx-auto banner-title pt-3">
          <div className="col-12 col-xl-6">
            <div className="section-title text-main text-uppercase mb-0">Google Reviews</div>
          </div>
          <div className="col-12 col-xl-6">
            <div className="review-header-rating-wrap">
              <div className="review-header-rating-block">
                <div className="review-header-score-row">
                  <div className="home-review-rating-number fs-1 text-main fw-bold mb-0">
                    {Number(data?.summary?.rating || 0).toFixed(1)}
                  </div>
                  <StarRow rating={data?.summary?.rating || 0} />
                </div>

                <div className="section-copy text-main fw-light mb-0 review-header-count">
                  Based on {Number(data?.summary?.reviewCount || 0).toLocaleString()} Google reviews
                </div>
              </div>
            </div>
          </div>
          <div className="container-fluid text-center row justify-content-center">
            <hr className="w-100 my-1" />
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-12 col-xl-12">
            <div className="home-review-carousel-wrap position-relative">
              {loading ? (
                <div className="home-review-card rounded-4 p-4 text-center text-muted">
                  Loading Google reviews...
                </div>
              ) : reviews.length ? (
                <div className="home-review-viewport">
                  <div
                    className="home-review-track"
                    style={{
                      transform: `translateX(-${displayIndex * 100}%)`,
                      transition: isTransitioning ? "transform 500ms ease" : "none",
                    }}
                  >
                    {extendedReviews.map((review, index) => (
                      <div
                        className="home-review-slide"
                        key={`${review.id || review._id || "review"}-${index}`}
                      >
                        <div className="review-slide-inner">
                          <ReviewCard review={review} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="home-review-card rounded-4 p-4 text-center text-muted">
                  No Google reviews available yet.
                </div>
              )}
            </div>

            {reviews.length > 1 ? (
              <div className="d-flex justify-content-center gap-2 mt-3">
                {reviews.map((review, index) => (
                  <button
                    key={review.id || review._id || index}
                    type="button"
                    className={`review-dot ${index === activeIndex ? "active" : ""}`}
                    onClick={() => {
                      setIsTransitioning(true);
                      setActiveIndex(index);
                    }}
                    aria-label={`Go to review ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}

            <div className="d-flex flex-wrap justify-content-center gap-3 my-4">
              {writeReviewUrl ? (
                <a
                  href={writeReviewUrl}
                  className="btn-main-cta rounded-4 text-uppercase fw-regular fs-5 py-3 text-main-light text-decoration-none"
                  target="_blank"
                  rel="noreferrer"
                >
                  Review Us On Google
                </a>
              ) : null}

              {googleMapsUrl ? (
                <a
                  href={googleMapsUrl}
                  className="btn-secondary-cta rounded-4 text-uppercase fw-regular fs-5 py-3 text-main bg-white text-decoration-none"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read More Reviews
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
