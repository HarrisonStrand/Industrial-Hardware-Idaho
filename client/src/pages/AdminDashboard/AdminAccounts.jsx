import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useToast } from "../../context/ToastContext";
import "./AdminAccounts.css";

// Same conversions as Admin > Pricing: margin % of the selling price <-> price multiplier.
function multiplierToMarginPercent(multiplier) {
  const m = Number(multiplier || 1);
  if (m <= 0) return 0;
  return Math.round(((m - 1) / m) * 10000) / 100;
}

function marginPercentToMultiplier(marginPercent) {
  const margin = Math.max(0, Number(marginPercent || 0));
  if (margin >= 100) return null;
  return Math.round((1 / (1 - margin / 100)) * 10000) / 10000;
}

export default function AdminAccounts() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [typeRules, setTypeRules] = useState({});

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
    apiFetch("/api/admin/pricing-settings")
      .then((data) => setTypeRules(data?.accountRules || {}))
      .catch(() => setTypeRules({}));
  }, []);

  async function updatePriceMultiplier(userId, value) {
    try {
      setSavingId(userId);
      await apiFetch(`/api/admin/users/${userId}/price-multiplier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceMultiplier: value === "" ? null : value }),
      });
      showToast({ variant: "success", message: value === "" ? "Account uses its type's price again" : "Account price updated" });
      await loadUsers();
    } catch (e) {
      showToast({ variant: "danger", message: e.message });
    } finally {
      setSavingId(null);
    }
  }

  async function updateApproval(userId, updates) {
    try {
      setSavingId(userId);
      await apiFetch(`/api/admin/users/${userId}/account-approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
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
    <div>
      <div className='text-main text-uppercase mb-2 fs-4'>Accounts</div>

      {loading && <div className='text-muted'>Loading users...</div>}

      {!loading && users.length === 0 && (
        <div className='text-muted'>No users found.</div>
      )}

      {!loading &&
        users.map((u) => {
          const account = u.account || {};
          const requestedType = account.requestedType || "RETAIL";
          const approvedType = account.approvedType || "RETAIL";
          const approvalStatus = account.approvalStatus || "NONE";
          // Same rule as the server: a non-retail type counts only once approved.
          const pricingType = approvedType !== "RETAIL" && approvalStatus === "APPROVED" ? approvedType : "RETAIL";
          const typeRule = typeRules[pricingType] || {};
          const typeMultiplier = Number(typeRule.multiplier ?? 1);
          const hasOwn = account.priceMultiplier !== null && account.priceMultiplier !== undefined;
          const typeMargin = multiplierToMarginPercent(typeMultiplier);
          const ownMargin = hasOwn ? String(multiplierToMarginPercent(account.priceMultiplier)) : "";

          return (
            <div key={u._id} className='theme-sub-card-container mb-4 p-3 rounded-4 border'>
              <div className='d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2'>
                <div>
                  <div className='text-main fw-semibold'>
                    {u.firstName} {u.lastName}
                  </div>
                  <div className='text-muted small'>{u.email}</div>
                  {u.company?.name && (
                    <div className='text-muted small'>{u.company.name}</div>
                  )}
                </div>

                <div className='text-end'>
                  <div className='text-muted small'>
                    Requested: <span className='text-main'>{requestedType}</span>
                  </div>
                  <div className='text-muted small'>
                    Status: <span className='text-main'>{approvalStatus}</span>
                  </div>
                </div>
              </div>

              <div className='mt-3 row g-3'>
                <div className='col-12 col-md-4'>
                  <div className='form-input-label text-uppercase text-main mb-1'>
                    Approved Type
                  </div>
                  <select
                    className='form-input form-control rounded-3 text-dark'
                    value={approvedType}
                    onChange={(e) =>
                      updateApproval(u._id, {
                        approvedType: e.target.value,
                        approvalStatus,
                      })
                    }>
                    <option value='RETAIL'>Retail</option>
                    <option value='NET30'>Net 30</option>
                    <option value='HOUSE'>House Account</option>
                  </select>
                </div>

                <div className='col-12 col-md-4'>
                  <div className='form-input-label text-uppercase text-main mb-1'>
                    Approval Status
                  </div>
                  <select
                    className='form-input form-control rounded-3 text-dark'
                    value={approvalStatus}
                    onChange={(e) =>
                      updateApproval(u._id, {
                        approvedType,
                        approvalStatus: e.target.value,
                      })
                    }>
                    <option value='NONE'>None</option>
                    <option value='PENDING'>Pending</option>
                    <option value='APPROVED'>Approved</option>
                    <option value='REJECTED'>Rejected</option>
                  </select>
                </div>

                <div className='col-12 col-md-4'>
                  <div className='form-input-label text-uppercase text-main mb-1'>
                    Account Margin %
                  </div>
                  <input
                    key={`${u._id}-${ownMargin}`}
                    type='number'
                    min='0'
                    max='99.99'
                    step='0.01'
                    className='form-input form-control rounded-3 text-dark'
                    placeholder={`${typeMargin}% (${typeRule.label || pricingType})`}
                    defaultValue={ownMargin}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next === ownMargin) return;
                      if (next === "") return updatePriceMultiplier(u._id, "");
                      const multiplier = marginPercentToMultiplier(next);
                      if (multiplier === null) {
                        showToast({ variant: "danger", message: "Margin must be below 100%." });
                        return;
                      }
                      updatePriceMultiplier(u._id, multiplier);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <div className='text-muted small mt-1'>
                    {!hasOwn ? (
                      <>Uses the {typeRule.label || pricingType} margin ({typeMargin}%). Enter a margin to set this account's own.</>
                    ) : (
                      <>
                        Own margin {ownMargin}% (type is {typeMargin}%).{" "}
                        <button
                          type='button'
                          className='btn btn-link btn-sm p-0 align-baseline'
                          onClick={() => updatePriceMultiplier(u._id, "")}>
                          Use type margin
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {approvalStatus === "REJECTED" && (
                  <div className='col-12 col-md-4'>
                    <div className='form-input-label text-uppercase text-main mb-1'>
                      Rejection Reason
                    </div>
                    <input
                      type='text'
                      className='form-input form-control rounded-3 text-dark'
                      defaultValue={account.rejectionReason || ""}
                      onBlur={(e) =>
                        updateApproval(u._id, {
                          approvedType,
                          approvalStatus,
                          rejectionReason: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {savingId === u._id && (
                <div className='text-muted small mt-2'>Saving...</div>
              )}
            </div>
          );
        })}
    </div>
  );
}