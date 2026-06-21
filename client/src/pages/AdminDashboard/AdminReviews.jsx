import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch.js";
import "./AdminReviews.css";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(value) {
  if (!value) return "Never";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_err) {
    return String(value);
  }
}

function SummaryCard({ label, value, helper }) {
  return (
    <div className="admin-google-review-summary-card border rounded-4 p-3 h-100">
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold fs-4 text-main">{value}</div>
      {helper ? <div className="small text-muted mt-1">{helper}</div> : null}
    </div>
  );
}

function StarRow({ rating = 0, center = false }) {
  const rounded = Math.round(Number(rating || 0));

  return (
    <div className={`d-flex align-items-center gap-1 ${center ? "justify-content-center" : ""}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={`bi ${star <= rounded ? "bi-star-fill" : "bi-star"} text-warning`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="admin-google-review-card border rounded-4 p-3 h-100 bg-white">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
        <div>
          <div className="fw-semibold text-main">{review.authorName || "Google User"}</div>
          <div className="small text-muted">{review.dateLabel || "Google review"}</div>
        </div>

        <span className="badge rounded-pill text-bg-light border">Google</span>
      </div>

      <StarRow rating={review.rating} />

      <div className="mt-3 text-main admin-google-review-copy">
        {review.text || "No review text returned by Google."}
      </div>

      {review.authorUrl ? (
        <a
          href={review.authorUrl}
          className="small d-inline-flex align-items-center gap-1 mt-3"
          target="_blank"
          rel="noreferrer"
        >
          View reviewer profile <i className="bi bi-box-arrow-up-right" />
        </a>
      ) : null}
    </div>
  );
}

export default function AdminReviews() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reviews = useMemo(() => safeArray(data?.reviews), [data]);
  const snapshot = data?.snapshot || null;
  const summary = data?.summary || {};

  async function loadGoogleReviews() {
    try {
      setLoading(true);
      setError("");
      const response = await apiFetch("/api/reviews/admin/google");
      setData(response);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load Google reviews");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError("");
      setSuccess("");

      const response = await apiFetch("/api/reviews/admin/google/sync", {
        method: "POST",
      });

      setData(response);
      setSuccess("Google reviews synced successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to sync Google reviews");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadGoogleReviews();
  }, []);

  return (
    <div className="admin-google-reviews-page container-fluid px-0">
      <div className="d-flex flex-column gap-4">
        <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-start gap-3">
          <div>
            <div className="text-main text-uppercase mb-2 fs-4">Google Reviews</div>
            <div className="text-muted">
              Sync and display the latest Google review snapshot on the website. Google returns a limited review sample, while the rating and total review count come from your Google Business listing.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 justify-content-xl-end">
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3"
              onClick={loadGoogleReviews}
              disabled={loading || syncing}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-dark rounded-3"
              onClick={handleSync}
              disabled={loading || syncing}
            >
              {syncing ? "Syncing…" : "Sync Google Reviews"}
            </button>
          </div>
        </div>

        {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
        {success ? <div className="alert alert-success mb-0">{success}</div> : null}

        {!data?.configured ? (
          <div className="alert alert-warning rounded-4 mb-0">
            Add <code>GOOGLE_PLACE_ID</code> to the server environment before syncing Google reviews.
          </div>
        ) : null}

        {data?.configured && !data?.hasApiKey ? (
          <div className="alert alert-warning rounded-4 mb-0">
            Add <code>GOOGLE_PLACES_API_KEY</code> to the server environment before syncing Google reviews.
          </div>
        ) : null}

        <div className="card shadow-sm rounded-4 border-0">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-6 col-lg-3">
                <SummaryCard
                  label="Google Rating"
                  value={loading ? "…" : Number(summary.rating || 0).toFixed(1)}
                  helper="Average rating"
                />
              </div>
              <div className="col-6 col-lg-3">
                <SummaryCard
                  label="Review Count"
                  value={loading ? "…" : Number(summary.reviewCount || 0).toLocaleString()}
                  helper="Google total"
                />
              </div>
              <div className="col-6 col-lg-3">
                <SummaryCard
                  label="Cached Reviews"
                  value={loading ? "…" : reviews.length}
                  helper="Shown on website"
                />
              </div>
              <div className="col-6 col-lg-3">
                <SummaryCard
                  label="Last Synced"
                  value={loading ? "…" : formatDateTime(snapshot?.lastSyncedAt || summary.lastSyncedAt)}
                  helper={snapshot?.syncStatus ? `Status: ${snapshot.syncStatus}` : "Google cache"}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-4">
            <div className="card shadow-sm rounded-4 border-0 h-100">
              <div className="card-body">
                <div className="fw-semibold text-main fs-5 mb-3">Google Listing</div>

                {loading ? (
                  <div className="text-muted">Loading Google review cache…</div>
                ) : snapshot ? (
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <div className="small text-muted">Place Name</div>
                      <div className="fw-semibold">{snapshot.placeName || "Google Business Profile"}</div>
                    </div>

                    <div>
                      <div className="small text-muted">Place ID</div>
                      <div className="small text-break">{snapshot.placeId}</div>
                    </div>

                    <div>
                      <div className="small text-muted mb-1">Rating Preview</div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fs-4 fw-bold text-main">{Number(snapshot.rating || 0).toFixed(1)}</span>
                        <StarRow rating={snapshot.rating} />
                      </div>
                    </div>

                    {snapshot.syncError ? (
                      <div className="alert alert-warning py-2 mb-0">
                        <div className="fw-semibold">Last sync warning</div>
                        <div className="small">{snapshot.syncError}</div>
                      </div>
                    ) : null}

                    <div className="d-flex flex-column gap-2">
                      {snapshot.googleMapsUrl ? (
                        <a
                          href={snapshot.googleMapsUrl}
                          className="btn btn-outline-dark rounded-3"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Google
                        </a>
                      ) : null}

                      {snapshot.writeReviewUrl ? (
                        <a
                          href={snapshot.writeReviewUrl}
                          className="btn btn-outline-primary rounded-3"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Review Us on Google
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted">
                    No Google review snapshot has been synced yet. Click <strong>Sync Google Reviews</strong> to cache the current Google rating and reviews.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="card shadow-sm rounded-4 border-0">
              <div className="card-body">
                <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                  <div>
                    <div className="fw-semibold text-main fs-5">Website Review Preview</div>
                    <div className="text-muted small">
                      These are the cached Google review cards the public site can display.
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="text-muted">Loading reviews…</div>
                ) : reviews.length ? (
                  <div className="row g-3">
                    {reviews.map((review, index) => (
                      <div className="col-12 col-lg-6" key={review.id || review._id || index}>
                        <ReviewCard review={review} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-google-review-empty rounded-4 p-4 text-center text-muted">
                    No Google reviews are cached yet. Sync Google reviews to populate this area.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
