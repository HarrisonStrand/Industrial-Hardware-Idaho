import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiFetch } from "../../utils/apiFetch";
import CardOnFile from "../../components/Billing/CardOnFile.jsx";
import CardModal from "../../components/Billing/CardModal.jsx";
import "./Profile.css";

function formatTaxStatus(status) {
  if (status === "exempt") return "Exempt (Approved)";
  if (status === "pending") return "Pending Approval";
  return "";
}

function formatAccountType(type) {
  if (type === "NET30") return "Net 30";
  if (type === "HOUSE") return "House Account (Card on File)";
  return "Retail";
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { showToast } = useToast();

  // ✅ Account capabilities / approval UX
  const [accountCaps, setAccountCaps] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [accountCapsError, setAccountCapsError] = useState("");
  const [requestedType, setRequestedType] = useState("NET30");

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    email: "",
    billingAddress: { address1: "", address2: "", city: "", state: "", zip: "" },
    deliveryAddress: { address1: "", address2: "", city: "", state: "", zip: "" }
  });

  // Avatar modal state
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const fileInputRef = useRef(null);

  // Card modal state
  const [showCardModal, setShowCardModal] = useState(false);

  const [cardSummary, setCardSummary] = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);

  const avatarSrc = useMemo(() => {
    if (!user?.avatarUrl) return null;

    return `${user.avatarUrl}?v=${encodeURIComponent(user.avatarUpdatedAt || "0")}`;
  }, [user?.avatarUrl, user?.avatarUpdatedAt]);

  const initials = useMemo(() => {
    if (!user) return "";

    const company = user.company?.name || user.company?.companyName;
    if (company) {
      return company
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("");
    }

    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName]
        .filter(Boolean)
        .map((name) => name[0].toUpperCase())
        .join("");
    }

    if (user.email) return user.email[0].toUpperCase();

    return "";
  }, [user]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatarSrc]);

  // Populate form from user
  useEffect(() => {
    if (!user) return;

    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      companyName: user.company?.name || user.company?.companyName || "",
      phone: user.phone || "",
      email: user.email || "",
      billingAddress: {
        address1: user.billingAddress?.address1 || "",
        address2: user.billingAddress?.address2 || "",
        city: user.billingAddress?.city || "",
        state: user.billingAddress?.state || "",
        zip: user.billingAddress?.zip || ""
      },
      deliveryAddress: {
        address1: user.deliveryAddress?.address1 || "",
        address2: user.deliveryAddress?.address2 || "",
        city: user.deliveryAddress?.city || "",
        state: user.deliveryAddress?.state || "",
        zip: user.deliveryAddress?.zip || ""
      }
    });
  }, [user]);

  // ✅ Load account capabilities (approval state, types, etc.)
  useEffect(() => {
    let mounted = true;
    if (!user) return;

    async function loadCaps() {
      setAccountCapsError("");
      try {
        const data = await apiFetch("/api/checkout/capabilities");
        if (!mounted) return;
        setAccountCaps(data || null);

        // Try to choose a sane default for the dropdown:
        // If server returns allowedRequestedTypes, pick first non-RETAIL
        const allowed = data?.allowedRequestedTypes || data?.allowedTypes || null;
        if (Array.isArray(allowed) && allowed.length) {
          const first = allowed.find((t) => t !== "RETAIL") || allowed[0];
          setRequestedType(first);
        }
      } catch (e) {
        if (!mounted) return;
        setAccountCaps(null);
        setAccountCapsError(e.message || "Failed to load account info");
      }
    }

    loadCaps();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Avatar preview
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function resetFormToUser() {
    if (!user) return;

    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      companyName: user.company?.name || user.company?.companyName || "",
      phone: user.phone || "",
      email: user.email || "",
      billingAddress: {
        address1: user.billingAddress?.address1 || "",
        address2: user.billingAddress?.address2 || "",
        city: user.billingAddress?.city || "",
        state: user.billingAddress?.state || "",
        zip: user.billingAddress?.zip || ""
      },
      deliveryAddress: {
        address1: user.deliveryAddress?.address1 || "",
        address2: user.deliveryAddress?.address2 || "",
        city: user.deliveryAddress?.city || "",
        state: user.deliveryAddress?.state || "",
        zip: user.deliveryAddress?.zip || ""
      }
    });
  }

  async function handleSignOut() {
    await logout({ redirectTo: "/signed-out" });
  }

  function setAddressField(which, key, value) {
    setForm((prev) => ({
      ...prev,
      [which]: { ...prev[which], [key]: value }
    }));
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const data = await apiFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      setUser(data.user);
      setIsEditing(false);
      showToast({ variant: "success", message: "Profile updated" });
    } catch (e) {
      showToast({
        variant: "danger",
        message: `Profile update failed: ${e.message}`
      });
    } finally {
      setSaving(false);
    }
  }

  async function requestTaxExempt() {
    setSaving(true);
    try {
      const data = await apiFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestTaxExempt: true })
      });

      setUser(data.user);
      showToast({
        variant: "success",
        message: "Tax exempt request submitted (Pending Approval)"
      });
    } catch (e) {
      showToast({ variant: "danger", message: `Request failed: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  // ✅ Request account type (NET30 / HOUSE)
  async function submitAccountTypeRequest() {
    setRequesting(true);
    try {
      const payload = { requestedType };
      const data = await apiFetch("/api/checkout/request-account-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Some implementations return updated capabilities, some return { user }, some return { ok }
      if (data?.user) setUser(data.user);

      // Re-load caps so UI instantly reflects pending/approved
      try {
        const fresh = await apiFetch("/api/checkout/capabilities");
        setAccountCaps(fresh || null);
      } catch {
        // ignore (we'll still toast success)
      }

      showToast({
        variant: "success",
        message: "Account request submitted for approval"
      });
    } catch (e) {
      showToast({
        variant: "danger",
        message: `Request failed: ${e.message}`
      });
    } finally {
      setRequesting(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("avatar", avatarFile);

      const data = await apiFetch("/api/users/me/avatar", {
        method: "POST",
        body: fd
      });

      setUser(data.user);
      setAvatarFile(null);
      setShowAvatarModal(false);
      showToast({ variant: "success", message: "Avatar updated" });
    } catch (e) {
      showToast({
        variant: "danger",
        message: `Avatar upload failed: ${e.message}`
      });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadCardSummary() {
      if (!user?.payment?.hasCardOnFile) {
        setCardSummary(null);
        return;
      }

      setLoadingCard(true);
      try {
        const data = await apiFetch("/api/billing/card-summary");
        if (!mounted) return;
        setCardSummary(data.card || null);
      } catch (e) {
        if (!mounted) return;
        setCardSummary(null);
      } finally {
        if (mounted) setLoadingCard(false);
      }
    }

    loadCardSummary();
    return () => {
      mounted = false;
    };
  }, [user?.payment?.hasCardOnFile]);

  async function removeCardOnFile() {
    setSaving(true);
    try {
      const data = await apiFetch("/api/billing/remove-card", {
        method: "POST"
      });

      setUser(data.user);
      setCardSummary(null);
      showToast({ variant: "success", message: "Card removed" });
    } catch (e) {
      showToast({ variant: "danger", message: `Remove failed: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  function openAvatarModal() {
    setShowAvatarModal(true);
  }

  function closeAvatarModal() {
    setShowAvatarModal(false);
    setAvatarFile(null);
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  function openCardModal() {
    setShowCardModal(true);
  }

  function closeCardModal() {
    setShowCardModal(false);
  }

  useEffect(() => {
    if (!showAvatarModal) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAvatarModal]);

  useEffect(() => {
    if (!showCardModal) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCardModal]);

  if (!user) return null;

  const displayName =
    user.company?.name ||
    user.company?.companyName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email;

  const taxStatus = user.tax?.status || "non_exempt";
  const taxLabel = formatTaxStatus(taxStatus);

  const hasCardOnFile = Boolean(user?.payment?.hasCardOnFile);

  // ✅ account approval info (from capabilities)
  const acct =
    accountCaps?.account ||
    accountCaps?.user?.account ||
    accountCaps?.accountInfo ||
    null;

  const approvalStatus = acct?.approvalStatus || "NONE";
  const approvedType = acct?.approvedType || "RETAIL";
  const requested = acct?.requestedType || "RETAIL";
  const rejectionReason = acct?.rejectionReason || "";

  const isPending = approvalStatus === "PENDING";
  const isApproved = approvalStatus === "APPROVED";
  const isRejected = approvalStatus === "REJECTED";

  // Read-only display values
  const display = {
    firstName: user.firstName || "—",
    lastName: user.lastName || "—",
    companyName: user.company?.name || user.company?.companyName || "—",
    phone: user.phone || "—",
    email: user.email || "—",
    billingAddress: user.billingAddress?.address1
      ? `${user.billingAddress.address1}${
          user.billingAddress.address2 ? `, ${user.billingAddress.address2}` : ""
        }, ${user.billingAddress.city || ""} ${user.billingAddress.state || ""} ${
          user.billingAddress.zip || ""
        }`
          .replace(/\s+/g, " ")
          .trim()
      : "—",
    deliveryAddress: user.deliveryAddress?.address1
      ? `${user.deliveryAddress.address1}${
          user.deliveryAddress.address2 ? `, ${user.deliveryAddress.address2}` : ""
        }, ${user.deliveryAddress.city || ""} ${user.deliveryAddress.state || ""} ${
          user.deliveryAddress.zip || ""
        }`
          .replace(/\s+/g, " ")
          .trim()
      : "—"
  };

  return (
    <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
      <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
        <div className='d-flex align-items-center justify-content-between px-0 px-sm-4'>
          <div className='text-main text-uppercase mb-1 fs-2'>Account</div>
        </div>

        <div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
          <div className='row d-flex align-items-center gap-3 pb-3'>
            <div className='col-12 col-sm d-flex align-items-center'>
              {/* Avatar clickable area */}
              <div
                className='avatar-clickable position-relative'
                role='button'
                tabIndex={0}
                onClick={openAvatarModal}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openAvatarModal();
                }}
                style={{ width: 72, height: 72 }}>
                {avatarSrc && !avatarError ? (
                  <img
                    key={avatarSrc}
                    src={avatarSrc}
                    alt='Account avatar'
                    className='rounded-circle avatar-image border border-main border-3'
                    onError={() => setAvatarError(true)}
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: "cover",
                      display: "block"
                    }}
                  />
                ) : (
                  <div
                    className='profile-avatar-initials rounded-circle border border-main border-3'
                    aria-label='Account avatar initials'>
                    {initials || "?"}
                  </div>
                )}
                <div className='avatar-overlay'>
                  <i className='bi bi-camera-fill avatar-overlay-icon' />
                </div>
              </div>

              <div className='ps-3'>
                <div className='company-name-display fw-semibold text-secondary'>
                  {displayName}
                </div>
                <div className='email-display text-muted small'>{user.email}</div>
              </div>
            </div>

            {/* Edit / Cancel */}
            <div className='col col-sm-2 edit-btn text-center text-sm-end'>
              {!isEditing ? (
                <button
                  className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main'
                  onClick={() => setIsEditing(true)}>
                  Edit
                </button>
              ) : (
                <button
                  className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
                  onClick={() => {
                    resetFormToUser();
                    setIsEditing(false);
                  }}
                  disabled={saving}>
                  Cancel
                </button>
              )}
            </div>

            {/* Sign out */}
            <div className='col col-sm-2 signout-btn text-center text-sm-end'>
              <button
                className='btn-main-cta text-center rounded-3 text-uppercase py-2 text-main-light'
                onClick={handleSignOut}
                disabled={saving}>
                Sign Out
              </button>
            </div>
          </div>

          {/* Account Details */}
          <div className='profile-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold g-0'>
            <div className='fs-4 contact-form-title text-main text-uppercase text-start'>
              Account Details
            </div>
            <div className='main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block'></div>

            {/* READ ONLY */}
            {!isEditing && (
              <div className='profile-static g-0 py-3'>
                <div className='row g-3'>
                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      First name
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.firstName}
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Last name
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.lastName}
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Company name
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.companyName}
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Phone number
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.phone}
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Email
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.email}
                    </div>
                  </div>

                  {/* ✅ Account Type (Approval UX) */}
                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Account type
                    </div>

                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {/* loading/error states */}
                      {!accountCaps && !accountCapsError && (
                        <span className='text-muted'>Loading account info…</span>
                      )}
                      {accountCapsError && (
                        <span className='text-danger'>{accountCapsError}</span>
                      )}

                      {/* main display */}
                      {acct && (
                        <>
                          <span className='me-2'>
                            {isApproved
                              ? formatAccountType(approvedType)
                              : formatAccountType("RETAIL")}
                          </span>

                          {isPending && (
                            <span className='text-muted'>
                              (Pending approval for {formatAccountType(requested)})
                            </span>
                          )}

                          {isRejected && (
                            <span className='text-danger'>
                              (Request rejected{rejectionReason ? `: ${rejectionReason}` : ""})
                            </span>
                          )}

                          {/* Request controls */}
                          {!isApproved && (
                            <div className='d-flex flex-wrap gap-2 mt-2'>
                              <select
                                className='account-type-dropdown form-select form-control rounded-3 text-secondary option-select form-input py-2'
                                style={{ maxWidth: 320 }}
                                value={requestedType}
                                onChange={(e) => setRequestedType(e.target.value)}
                                disabled={requesting || isPending}>
                                <option value='NET30'>Net 30</option>
                                <option value='HOUSE'>House Account (Card on File)</option>
                              </select>

                              <button
                                className='btn-main-cta rounded-3 text-uppercase fw-regular text-main-light'
                                onClick={submitAccountTypeRequest}
                                disabled={requesting || isPending}>
                                {isPending ? "Request Sent" : "Request Approval"}
                              </button>

                              <div className='text-muted small w-100 ps-0 ps-sm-2'>
                                Retail checkout is always available. Pay-later account types require admin approval.
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Tax status
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {taxLabel}
                      {taxStatus === "non_exempt" && (
                        <button
                          className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main ms-3'
                          onClick={requestTaxExempt}
                          disabled={saving}>
                          Request Exempt
                        </button>
                      )}
                    </div>
                  </div>

                  <div className='col-12'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Billing address
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.billingAddress}
                    </div>
                  </div>

                  <div className='col-12'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Delivery address
                    </div>
                    <div className='profile-static-value text-dark ps-0 ps-sm-2'>
                      {display.deliveryAddress}
                    </div>
                  </div>
                </div>

                {/* Card on File */}
                <div className='mt-4'>
                  <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                    Card on file
                  </div>

                  <div className='profile-static-value text-dark ps-0 ps-sm-2 d-flex align-items-center flex-wrap align-items-center'>
                    {hasCardOnFile && (
                      <span className='pe-0 pe-sm-3'>
                        {hasCardOnFile && loadingCard && "Card on file (loading...)"}
                        {hasCardOnFile && !loadingCard && cardSummary?.last4 && (
                          <>
                            {`${(cardSummary.brand || "card").toUpperCase()} •••• ${cardSummary.last4}`}
                            {cardSummary.expMonth && cardSummary.expYear
                              ? ` (exp ${String(cardSummary.expMonth).padStart(2, "0")}/${String(
                                  cardSummary.expYear
                                ).slice(-2)})`
                              : ""}
                          </>
                        )}
                        {hasCardOnFile && !loadingCard && !cardSummary?.last4 && "Card on file"}
                        {hasCardOnFile && (
                          <i
                            className='remove-card-icon bi bi-x text-danger text-uppercase fw-bold fs-3'
                            onClick={removeCardOnFile}
                            disabled={saving}></i>
                        )}
                      </span>
                    )}

                    <button
                      className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light me-0 me-sm-3'
                      onClick={openCardModal}
                      disabled={saving}>
                      {hasCardOnFile ? "Update Card" : "Add Card"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EDIT MODE */}
            {isEditing && (
              <div className='contact-form g-0 py-3'>
                <div className='row g-3'>
                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      First name
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.firstName}
                      onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Last name
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.lastName}
                      onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Company name
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.companyName}
                      onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                    />
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Phone number
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>

                  <div className='col-12'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Email (login)
                    </label>
                    <input
                      type='email'
                      className='form-input form-control rounded-3 text-dark'
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    />
                    <div className='text-muted small ps-0 ps-sm-2 mt-1'>
                      Changing your email will change the email you use to log in.
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className='col-12 mt-2'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Billing Address
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Address 1
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.billingAddress.address1}
                      onChange={(e) => setAddressField("billingAddress", "address1", e.target.value)}
                    />
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Address 2
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.billingAddress.address2}
                      onChange={(e) => setAddressField("billingAddress", "address2", e.target.value)}
                    />
                  </div>

                  <div className='col-12 col-md-4'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      City
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.billingAddress.city}
                      onChange={(e) => setAddressField("billingAddress", "city", e.target.value)}
                    />
                  </div>

                  <div className='col-12 col-md-4'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      State
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.billingAddress.state}
                      onChange={(e) => setAddressField("billingAddress", "state", e.target.value)}
                    />
                  </div>

                  <div className='col-12 col-md-4'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      ZIP
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.billingAddress.zip}
                      onChange={(e) => setAddressField("billingAddress", "zip", e.target.value)}
                    />
                  </div>

                  {/* Delivery Address */}
                  <div className='col-12 mt-3'>
                    <div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
                      Delivery Address
                    </div>
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Address 1
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.deliveryAddress.address1}
                      onChange={(e) =>
                        setAddressField("deliveryAddress", "address1", e.target.value)
                      }
                    />
                  </div>

                  <div className='col-12 col-md-6'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      Address 2
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.deliveryAddress.address2}
                      onChange={(e) =>
                        setAddressField("deliveryAddress", "address2", e.target.value)
                      }
                    />
                  </div>

                  <div className='col-12 col-md-4'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      City
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.deliveryAddress.city}
                      onChange={(e) => setAddressField("deliveryAddress", "city", e.target.value)}
                    />
                  </div>

                  <div className='col-12 col-md-4'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      State
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.deliveryAddress.state}
                      onChange={(e) => setAddressField("deliveryAddress", "state", e.target.value)}
                    />
                  </div>

                  <div className='col-12 col-md-4'>
                    <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                      ZIP
                    </label>
                    <input
                      className='form-input form-control rounded-3 text-dark'
                      value={form.deliveryAddress.zip}
                      onChange={(e) => setAddressField("deliveryAddress", "zip", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom save row */}
          <div className='d-flex justify-content-end align-items-end pt-3'>
            <div className='col-12 col-sm text-end'>
              {!isEditing ? null : (
                <button
                  className='btn-main-cta px-3 rounded-3 text-uppercase fw-regular py-2 text-main-light'
                  onClick={saveProfile}
                  disabled={saving}>
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className='avatar-modal-backdrop' role='presentation' onClick={closeAvatarModal}>
          <div
            className='avatar-modal-content rounded-4'
            role='dialog'
            aria-modal='true'
            aria-label='Avatar'
            onClick={(e) => e.stopPropagation()}>
            <div className='d-flex justify-content-between align-items-center mb-3'>
              <div className='text-main text-uppercase fw-semibold'>Avatar</div>
              <button type='button' className='btn-close' aria-label='Close' onClick={closeAvatarModal} />
            </div>

            <div className='d-flex flex-column align-items-center'>
              {avatarPreview || (avatarSrc && !avatarError) ? (
                <img
                  src={avatarPreview || avatarSrc}
                  alt='Avatar preview'
                  className='rounded-circle border border-main border-3'
                  onError={() => setAvatarError(true)}
                  style={{ width: 160, height: 160, objectFit: "cover" }}
                />
              ) : (
                <div
                  className='profile-avatar-initials profile-avatar-initials-lg rounded-circle border border-main border-3'
                  aria-label='Avatar preview initials'>
                  {initials || "?"}
                </div>
              )}

              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                className='d-none'
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              />

              <div className='d-flex gap-2 mt-3'>
                <button
                  className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
                  onClick={triggerFilePicker}
                  disabled={saving}>
                  Change
                </button>

                <button
                  className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
                  onClick={uploadAvatar}
                  disabled={!avatarFile || saving}>
                  Save
                </button>
              </div>

              <div className='text-muted small mt-2'>
                {avatarFile ? avatarFile.name : "Choose an image to update your avatar."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {showCardModal && (
        <CardModal
          open={showCardModal}
          onClose={closeCardModal}
          hasCardOnFile={hasCardOnFile}
          loadingCard={loadingCard}
          cardSummary={cardSummary}
          saving={saving}
          removeCardOnFile={removeCardOnFile}
          setCardSummary={setCardSummary}
        />
      )}
    </div>
  );
}
