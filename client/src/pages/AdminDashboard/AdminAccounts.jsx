import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useToast } from "../../context/ToastContext";

export default function AdminAccounts() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await apiFetch("/api/admin/users");
      setUsers(data.users || []);
    } catch (e) {
      showToast({ variant: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateApproval(userId, updates) {
    try {
      setSavingId(userId);
      await apiFetch(`/api/admin/users/${userId}/account-approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      showToast({ variant: "success", message: "Account updated" });
      await loadUsers();
    } catch (e) {
      showToast({ variant: "danger", message: e.message });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
      <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">

        <div className="text-main text-uppercase mb-1 fs-2">
          Admin Panel
        </div>

        <div className="main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block" />

        <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">

          {loading && (
            <div className="text-muted">Loading users...</div>
          )}

          {!loading && users.length === 0 && (
            <div className="text-muted">No users found.</div>
          )}

          {!loading && users.map((u) => {
            const account = u.account || {};
            const requestedType = account.requestedType || "RETAIL";
            const approvedType = account.approvedType || "RETAIL";
            const approvalStatus = account.approvalStatus || "NONE";

            return (
              <div key={u._id} className="mb-4 p-3 rounded-3 border">

                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">

                  <div>
                    <div className="text-main fw-semibold">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="text-muted small">
                      {u.email}
                    </div>
                    {u.company?.name && (
                      <div className="text-muted small">
                        {u.company.name}
                      </div>
                    )}
                  </div>

                  <div className="text-end">
                    <div className="text-muted small">
                      Requested: <span className="text-main">{requestedType}</span>
                    </div>
                    <div className="text-muted small">
                      Status: <span className="text-main">{approvalStatus}</span>
                    </div>
                  </div>

                </div>

                <div className="mt-3 row g-3">

                  <div className="col-12 col-md-4">
                    <div className="form-input-label text-uppercase text-main mb-1">
                      Approved Type
                    </div>
                    <select
                      className="form-input form-control rounded-3 text-dark"
                      value={approvedType}
                      onChange={(e) =>
                        updateApproval(u._id, {
                          approvedType: e.target.value,
                          approvalStatus
                        })
                      }
                    >
                      <option value="RETAIL">Retail</option>
                      <option value="NET30">Net 30</option>
                      <option value="HOUSE">House Account</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="form-input-label text-uppercase text-main mb-1">
                      Approval Status
                    </div>
                    <select
                      className="form-input form-control rounded-3 text-dark"
                      value={approvalStatus}
                      onChange={(e) =>
                        updateApproval(u._id, {
                          approvedType,
                          approvalStatus: e.target.value
                        })
                      }
                    >
                      <option value="NONE">None</option>
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>

                  {approvalStatus === "REJECTED" && (
                    <div className="col-12 col-md-4">
                      <div className="form-input-label text-uppercase text-main mb-1">
                        Rejection Reason
                      </div>
                      <input
                        type="text"
                        className="form-input form-control rounded-3 text-dark"
                        defaultValue={account.rejectionReason || ""}
                        onBlur={(e) =>
                          updateApproval(u._id, {
                            approvedType,
                            approvalStatus,
                            rejectionReason: e.target.value
                          })
                        }
                      />
                    </div>
                  )}

                </div>

                {savingId === u._id && (
                  <div className="text-muted small mt-2">
                    Saving...
                  </div>
                )}

              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}
