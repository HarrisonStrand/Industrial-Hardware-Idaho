import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch.js";

const REVIEW_BUCKETS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function SummaryCard({ label, value }) {
  return (
    <div className="border rounded-4 p-3 h-100">
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold fs-5">{value}</div>
    </div>
  );
}

function StarRow({ rating = 0 }) {
  const rounded = Math.round(Number(rating || 0));

  return (
    <div className="d-flex align-items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={`bi ${star <= rounded ? "bi-star-fill" : "bi-star"} text-warning`}
        />
      ))}
    </div>
  );
}

export default function AdminReviews() {
  const [bucket, setBucket] = useState("pending");
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedReview, setSelectedReview] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadSummary() {
    try {
      setLoadingSummary(true);
      const data = await apiFetch("/api/reviews/admin/summary");
      setSummary(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load review summary");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadList(nextBucket = bucket) {
    try {
      setLoadingList(true);
      setError("");

      const data = await apiFetch(`/api/reviews/admin?status=${nextBucket}`);
      const items = safeArray(data?.items);

      setRows(items);

      if (!items.find((item) => String(item._id) === String(selectedId))) {
        setSelectedId(items[0]?._id ? String(items[0]._id) : "");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load reviews");
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(id) {
    if (!id) {
      setSelectedReview(null);
      return;
    }

    try {
      setLoadingDetail(true);
      setError("");
      const data = await apiFetch(`/api/reviews/admin/${id}`);
      setSelectedReview(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load review detail");
      setSelectedReview(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleAction(action) {
    if (!selectedId) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/reviews/admin/${selectedId}/${action}`, {
        method: "POST",
      });

      await loadSummary();
      await loadList(bucket);
      await loadDetail(selectedId);
    } catch (err) {
      console.error(err);
      setError(err.message || `Failed to ${action} review`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadList(bucket);
  }, [bucket]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId]);

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-column gap-4">
        <div>
          <div className="text-main text-uppercase mb-2 fs-4">Reviews Moderation</div>
          <div className="text-muted">
            Approve, reject, and manage customer-submitted reviews for the homepage.
          </div>
        </div>

        {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

        <div className="card shadow-sm rounded-4 border-0">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <SummaryCard
                  label="Pending"
                  value={loadingSummary ? "…" : summary?.byStatus?.pending ?? 0}
                />
              </div>
              <div className="col-6 col-md-3">
                <SummaryCard
                  label="Approved"
                  value={loadingSummary ? "…" : summary?.byStatus?.approved ?? 0}
                />
              </div>
              <div className="col-6 col-md-3">
                <SummaryCard
                  label="Rejected"
                  value={loadingSummary ? "…" : summary?.byStatus?.rejected ?? 0}
                />
              </div>
              <div className="col-6 col-md-3">
                <SummaryCard
                  label="Featured"
                  value={loadingSummary ? "…" : summary?.featuredApproved ?? 0}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {REVIEW_BUCKETS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`btn ${bucket === item.key ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setBucket(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-4">
            <div className="card shadow-sm rounded-4 border-0">
              <div className="card-body d-flex flex-column" style={{ height: "70vh" }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="fw-semibold text-capitalize">{bucket} Reviews</div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => loadList(bucket)}
                    disabled={loadingList}
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex-grow-1 overflow-auto pe-1">
                  {loadingList ? (
                    <div className="text-muted">Loading reviews…</div>
                  ) : rows.length === 0 ? (
                    <div className="text-muted">No reviews found in this bucket.</div>
                  ) : (
                    <div className="list-group">
                      {rows.map((item) => {
                        const active = String(item._id) === String(selectedId);

                        return (
                          <button
                            key={item._id}
                            type="button"
                            className={`list-group-item list-group-item-action ${active ? "active" : ""}`}
                            onClick={() => setSelectedId(String(item._id))}
                          >
                            <div className="fw-semibold d-flex justify-content-between gap-2">
                              <span>{item.authorName || "Anonymous"}</span>
                              {item.isFeatured ? (
                                <span className={`badge ${active ? "text-bg-light" : "text-bg-warning"}`}>
                                  Featured
                                </span>
                              ) : null}
                            </div>

                            <div className={`small ${active ? "text-white-50" : "text-muted"}`}>
                              Rating: {item.rating || 0} / 5
                            </div>
                            <div className={`small ${active ? "text-white-50" : "text-muted"}`}>
                              Source: {item.source || "website"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="card shadow-sm rounded-4 border-0">
              <div className="card-body" style={{ minHeight: "70vh" }}>
                {loadingDetail ? (
                  <div className="text-muted">Loading review…</div>
                ) : !selectedReview ? (
                  <div className="text-muted">Select a review to moderate.</div>
                ) : (
                  <>
                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
                      <div>
                        <div className="fs-5 fw-semibold">
                          {selectedReview.authorName || "Anonymous"}
                        </div>
                        <div className="text-muted">
                          {selectedReview.email || "No email provided"}
                        </div>
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          disabled={saving}
                          onClick={() => handleAction("approve")}
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          className={`btn ${
                            selectedReview.isFeatured
                              ? "btn-warning"
                              : "btn-outline-warning"
                          }`}
                          disabled={saving || selectedReview.status !== "approved"}
                          onClick={() => handleAction("toggle-featured")}
                          title={
                            selectedReview.status !== "approved"
                              ? "Approve the review before featuring it"
                              : ""
                          }
                        >
                          {selectedReview.isFeatured ? "Unfeature" : "Feature"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          disabled={saving}
                          onClick={() => handleAction("reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    <div className="row g-3 mb-4">
                      <div className="col-md-4">
                        <div className="border rounded-4 p-3 h-100">
                          <div className="small text-muted mb-1">Rating</div>
                          <StarRow rating={selectedReview.rating} />
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="border rounded-4 p-3 h-100">
                          <div className="small text-muted mb-1">Status</div>
                          <div className="fw-semibold text-capitalize">
                            {selectedReview.status || "pending"}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="border rounded-4 p-3 h-100">
                          <div className="small text-muted mb-1">Featured</div>
                          <div className="fw-semibold">
                            {selectedReview.isFeatured ? "Yes" : "No"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="small text-muted mb-1">Source</div>
                      <div className="fw-semibold text-capitalize">
                        {selectedReview.source || "website"}
                      </div>
                    </div>

                    <div>
                      <div className="small text-muted mb-2">Review</div>
                      <div className="border rounded-4 p-3 bg-light">
                        {selectedReview.text || "No review text provided."}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}