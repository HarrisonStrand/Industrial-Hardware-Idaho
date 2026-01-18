import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiFetch } from "../../utils/apiFetch";
import "./Profile.css";

export default function Profile() {
	const navigate = useNavigate();
	const { user, setUser, logout } = useAuth();
	const { showToast } = useToast();

	const [isEditing, setIsEditing] = useState(false);

	const [form, setForm] = useState({
		firstName: "",
		lastName: "",
		company: { name: "", address: "", taxStatus: "", notes: "" },
	});

	// Avatar modal state
	const [showAvatarModal, setShowAvatarModal] = useState(false);
	const [avatarFile, setAvatarFile] = useState(null);
	const [avatarPreview, setAvatarPreview] = useState("");
	const fileInputRef = useRef(null);

	const [saving, setSaving] = useState(false);

	const avatarSrc = useMemo(() => {
		return user?.avatarUrl
			? `${user.avatarUrl}?v=${encodeURIComponent(user.avatarUpdatedAt || "0")}`
			: "/img/avatar-placeholder.png";
	}, [user?.avatarUrl, user?.avatarUpdatedAt]);

	useEffect(() => {
		if (!user) return;

		setForm({
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			company: {
				name: user.company?.name || user.company?.companyName || "",
				address: user.company?.address || "",
				taxStatus: user.company?.taxStatus || "",
				notes: user.company?.notes || "",
			},
		});
	}, [user]);

	useEffect(() => {
		if (!avatarFile) {
			setAvatarPreview("");
			return;
		}
		const url = URL.createObjectURL(avatarFile);
		setAvatarPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [avatarFile]);

	function setCompanyField(key, value) {
		setForm((prev) => ({
			...prev,
			company: { ...prev.company, [key]: value },
		}));
	}

	function resetFormToUser() {
		if (!user) return;
		setForm({
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			company: {
				name: user.company?.name || user.company?.companyName || "",
				address: user.company?.address || "",
				taxStatus: user.company?.taxStatus || "",
				notes: user.company?.notes || "",
			},
		});
	}

	async function handleSignOut() {
		try {
			await logout();
		} finally {
			navigate("/signed-out", { replace: true, state: { fromLogout: true } });
		}
	}

async function saveProfile() {
  setSaving(true);
  try {
    const data = await apiFetch(
      "/api/users/me",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      },
      { onUnauthorized: () => window.location.replace("/signed-out") }
    );

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


async function uploadAvatar() {
  if (!avatarFile) return;

  setSaving(true);
  try {
    const fd = new FormData();
    fd.append("avatar", avatarFile);

    const data = await apiFetch(
      "/api/users/me/avatar",
      {
        method: "POST",
        body: fd
      },
      { onUnauthorized: () => window.location.replace("/signed-out") }
    );

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

	if (!user) return null;

	const displayCompanyName =
		user.company?.name ||
		user.company?.companyName ||
		`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
		user.email;

	// Static display values (read-only view)
	const display = {
		firstName: user.firstName || "—",
		lastName: user.lastName || "—",
		companyName: user.company?.name || user.company?.companyName || "—",
		companyAddress: user.company?.address || "—",
		taxStatus: user.company?.taxStatus || "—",
		notes: user.company?.notes || "—",
	};

	return (
		<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
			<div className='profile-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
				<div className='d-flex align-items-center justify-content-between px-0 ps-4'>
					<div className='text-main text-uppercase mb-1 fs-2'>Account</div>

					{/* Top-right actions */}
					{!isEditing ? (
						<button
							className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
							onClick={() => setIsEditing(true)}>
							Edit
						</button>
					) : (
						<div className='d-flex gap-2'>
							<button
								className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
								onClick={saveProfile}
								disabled={saving}>
								Save
							</button>
							<button
								className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
								onClick={() => {
									resetFormToUser();
									setIsEditing(false);
								}}
								disabled={saving}>
								Cancel
							</button>
						</div>
					)}
				</div>

				<div className='contact-detail-container py-3 rounded-4 px-3 px-sm-5'>
					<div className='d-flex align-items-top gap-3 pb-3'>
						<div className='col d-flex align-items-center'>
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
								<img
									key={avatarSrc}
									src={avatarSrc}
									alt='Avatar'
									className='rounded-circle avatar-image border border-main border-3'
									style={{
										width: 72,
										height: 72,
										objectFit: "cover",
										display: "block",
									}}
								/>
								{/* Hover overlay (bottom third only) */}
								<div className='avatar-overlay'>
									<i className='bi bi-camera-fill avatar-overlay-icon' />
								</div>
							</div>

							<div className='ps-3'>
								<div className='company-name-display fw-semibold text-secondary'>
									{displayCompanyName}
								</div>
								<div className='email-display text-muted small'>{user.email}</div>
							</div>
						</div>

						<div className='signout-btn col-1 text-end'>
							<button
								className='btn-main-cta text-center rounded-3 text-uppercase py-2 text-main-light'
								onClick={handleSignOut}
								disabled={saving}>
								Sign Out
							</button>
						</div>
					</div>

					<div className='profile-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold g-0'>
						<div className='fs-4 contact-form-title text-main text-uppercase text-start'>
							Account Details
						</div>
						<div className='main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block'></div>

						{/* READ-ONLY VIEW */}
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
											Company address
										</div>
										<div className='profile-static-value text-dark ps-0 ps-sm-2'>
											{display.companyAddress}
										</div>
									</div>

									<div className='col-12 col-md-6'>
										<div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
											Tax status
										</div>
										<div className='profile-static-value text-dark ps-0 ps-sm-2'>
											{display.taxStatus}
										</div>
									</div>

									<div className='col-12'>
										<div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-0'>
											Notes
										</div>
										<div className='profile-static-value text-dark ps-0 ps-sm-2'>
											{display.notes}
										</div>
									</div>
								</div>
							</div>
						)}

						{/* EDIT MODE (FORM) */}
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
											onChange={(e) =>
												setForm((p) => ({ ...p, firstName: e.target.value }))
											}
										/>
									</div>

									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
											Last name
										</label>
										<input
											className='form-input form-control rounded-3 text-dark'
											value={form.lastName}
											onChange={(e) =>
												setForm((p) => ({ ...p, lastName: e.target.value }))
											}
										/>
									</div>

									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
											Company name
										</label>
										<input
											className='form-input form-control rounded-3 text-dark'
											value={form.company.name}
											onChange={(e) => setCompanyField("name", e.target.value)}
										/>
									</div>

									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
											Company address
										</label>
										<input
											className='form-input form-control rounded-3 text-dark'
											value={form.company.address}
											onChange={(e) => setCompanyField("address", e.target.value)}
										/>
									</div>

									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
											Tax status
										</label>
										<input
											className='form-input form-control rounded-3 text-dark'
											value={form.company.taxStatus}
											onChange={(e) =>
												setCompanyField("taxStatus", e.target.value)
											}
										/>
									</div>

									<div className='col-12'>
										<label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
											Notes
										</label>
										<textarea
											className='form-control form-input rounded-3 text-dark'
											rows={3}
											value={form.company.notes}
											onChange={(e) => setCompanyField("notes", e.target.value)}
										/>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Keep your bottom action row if you still want it (optional) */}
					{/* If you keep it, it should match editing state */}
					<div className='row justify-content-end align-items-end pt-3'>
						<div className='col-12 text-end'>
							{!isEditing ? null : (
								<button
									className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
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
				<div
					className='avatar-modal-backdrop'
					role='presentation'
					onClick={closeAvatarModal}>
					<div
						className='avatar-modal-content rounded-4'
						role='dialog'
						aria-modal='true'
						aria-label='Avatar'
						onClick={(e) => e.stopPropagation()}>
						<div className='d-flex justify-content-between align-items-center mb-3'>
							<div className='text-main text-uppercase fw-semibold'>Avatar</div>
							<button
								type='button'
								className='btn-close'
								aria-label='Close'
								onClick={closeAvatarModal}
							/>
						</div>

						<div className='d-flex flex-column align-items-center'>
							<img
								src={avatarPreview || avatarSrc}
								alt='Avatar preview'
								className='rounded-circle border border-main border-3'
								style={{ width: 160, height: 160, objectFit: "cover" }}
							/>

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
								{avatarFile
									? avatarFile.name
									: "Choose an image to update your avatar."}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
