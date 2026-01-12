import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function Profile() {
	const { user, setUser } = useAuth();
	const { showToast } = useToast();

	const [form, setForm] = useState({
		firstName: "",
		lastName: "",
		company: { name: "", address: "", taxStatus: "", notes: "" },
	});

	const [avatarFile, setAvatarFile] = useState(null);
	const [saving, setSaving] = useState(false);

	const avatarSrc = user?.avatarUrl
		? `${user.avatarUrl}?v=${user.avatarUpdatedAt || "0"}`
		: "/img/avatar-placeholder.png";

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

	function setCompanyField(key, value) {
		setForm((prev) => ({
			...prev,
			company: { ...prev.company, [key]: value },
		}));
	}

	async function saveProfile() {
		setSaving(true);
		try {
			const res = await fetch("/api/users/me", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(form),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || "Failed to save profile");

			setUser(data.user);
			showToast({ variant: "success", message: "Profile updated" });
		} catch (e) {
			showToast({
				variant: "danger",
				message: `Profile update failed: ${e.message}`,
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

			const res = await fetch("/api/users/me/avatar", {
				method: "POST",
				credentials: "include",
				body: fd,
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || "Avatar upload failed");

			setUser(data.user);
			setAvatarFile(null);
			showToast({ variant: "success", message: "Avatar updated" });
		} catch (e) {
			showToast({
				variant: "danger",
				message: `Avatar upload failed: ${e.message}`,
			});
		} finally {
			setSaving(false);
		}
	}

	if (!user) return null;

	console.log("Profile user avatarUrl:", user?.avatarUrl);

	return (
		<div className='container py-4' style={{ maxWidth: 900 }}>
			<h2 className='mb-4'>Profile</h2>

			<div className='card rounded-4 border-0 shadow-sm mb-4'>
				<div className='card-body'>
					<div className='d-flex align-items-center gap-3'>
						<img
							src={avatarSrc}
							alt='Avatar'
							className='rounded-circle'
							style={{ width: 72, height: 72, objectFit: "cover" }}
						/>
						<div>
							<div className='fw-semibold'>
								{user.company?.name ||
									`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
									user.email}
							</div>
							<div className='text-muted small'>{user.email}</div>
						</div>
					</div>

					<hr />

					<label className='form-label'>Upload new avatar</label>
					<input
						type='file'
						className='form-control'
						accept='image/*'
						onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
					/>
					<button
						className='btn btn-outline-primary mt-2'
						onClick={uploadAvatar}
						disabled={!avatarFile || saving}>
						Upload Avatar
					</button>
				</div>
			</div>

			<div className='card rounded-4 border-0 shadow-sm'>
				<div className='card-body'>
					<h5 className='mb-3'>Account Details</h5>

					<div className='row g-3'>
						<div className='col-md-6'>
							<label className='form-label'>First name</label>
							<input
								className='form-control'
								value={form.firstName}
								onChange={(e) =>
									setForm((p) => ({ ...p, firstName: e.target.value }))
								}
							/>
						</div>

						<div className='col-md-6'>
							<label className='form-label'>Last name</label>
							<input
								className='form-control'
								value={form.lastName}
								onChange={(e) =>
									setForm((p) => ({ ...p, lastName: e.target.value }))
								}
							/>
						</div>

						<div className='col-12'>
							<label className='form-label'>Company name</label>
							<input
								className='form-control'
								value={form.company.name}
								onChange={(e) => setCompanyField("name", e.target.value)}
							/>
						</div>

						<div className='col-12'>
							<label className='form-label'>Company address</label>
							<input
								className='form-control'
								value={form.company.address}
								onChange={(e) => setCompanyField("address", e.target.value)}
							/>
						</div>

						<div className='col-12'>
							<label className='form-label'>Tax status</label>
							<input
								className='form-control'
								value={form.company.taxStatus}
								onChange={(e) => setCompanyField("taxStatus", e.target.value)}
							/>
						</div>

						<div className='col-12'>
							<label className='form-label'>Notes</label>
							<textarea
								className='form-control'
								rows={3}
								value={form.company.notes}
								onChange={(e) => setCompanyField("notes", e.target.value)}
							/>
						</div>
					</div>

					<button
						className='btn btn-primary mt-3'
						onClick={saveProfile}
						disabled={saving}>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	);
}
