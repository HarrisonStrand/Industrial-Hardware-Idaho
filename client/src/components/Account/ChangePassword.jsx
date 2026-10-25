import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import { useToast } from "../../context/ToastContext";

const MIN_LENGTH = 8;
const EMPTY = { current: "", next: "", confirm: "" };

// Profile section: confirm the current password, then enter the new one twice.
export default function ChangePassword({ authProvider = "local" }) {
	const { showToast } = useToast();
	const [open, setOpen] = useState(false);
	const [fields, setFields] = useState(EMPTY);
	const [show, setShow] = useState(false);
	const [err, setErr] = useState("");
	const [saving, setSaving] = useState(false);

	const set = (key) => (e) => setFields((prev) => ({ ...prev, [key]: e.target.value }));
	const mismatch = fields.confirm.length > 0 && fields.next !== fields.confirm;

	function close() {
		setOpen(false);
		setFields(EMPTY);
		setErr("");
		setShow(false);
	}

	async function submit(e) {
		e.preventDefault();
		setErr("");
		if (fields.next.length < MIN_LENGTH) {
			setErr(`New password must be at least ${MIN_LENGTH} characters.`);
			return;
		}
		if (fields.next !== fields.confirm) {
			setErr("The new passwords don't match.");
			return;
		}

		setSaving(true);
		try {
			await apiFetch("/api/auth/change-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currentPassword: fields.current, newPassword: fields.next }),
			});
			showToast({ variant: "success", message: "Password changed" });
			close();
		} catch (ex) {
			setErr(ex?.message || "Could not change the password.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className='profile-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-xl-4 px-3 px-xl-5 fw-semibold g-0 mt-4'>
			<div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
				<div className='fs-4 contact-form-title text-main text-uppercase text-start'>Password</div>
				{!open && (
					<button
						type='button'
						className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 px-4 text-main'
						onClick={() => setOpen(true)}>
						Change Password
					</button>
				)}
			</div>

			{!open ? (
				authProvider === "google" && (
					<div className='text-muted small fw-normal mt-2'>
						You sign in with Google. If you never set a password here, use{" "}
						<Link to='/forgot-password'>Forgot password</Link> to create one.
					</div>
				)
			) : (
				<form className='contact-form g-0 pt-3' onSubmit={submit} noValidate>
					<div className='row g-3'>
						<div className='col-12 col-md-4'>
							<label htmlFor='pw-current' className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
								Current password
							</label>
							<input
								id='pw-current'
								type={show ? "text" : "password"}
								className='form-input form-control rounded-3 text-dark'
								value={fields.current}
								onChange={set("current")}
								autoComplete='current-password'
								required
								autoFocus
							/>
						</div>
						<div className='col-12 col-md-4'>
							<label htmlFor='pw-new' className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
								New password
							</label>
							<input
								id='pw-new'
								type={show ? "text" : "password"}
								className='form-input form-control rounded-3 text-dark'
								value={fields.next}
								onChange={set("next")}
								autoComplete='new-password'
								minLength={MIN_LENGTH}
								required
							/>
							<div className='text-muted small fw-normal mt-1 ps-0 ps-sm-2'>At least {MIN_LENGTH} characters</div>
						</div>
						<div className='col-12 col-md-4'>
							<label htmlFor='pw-confirm' className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
								Confirm new password
							</label>
							<input
								id='pw-confirm'
								type={show ? "text" : "password"}
								className={`form-input form-control rounded-3 text-dark ${mismatch ? "is-invalid" : ""}`}
								value={fields.confirm}
								onChange={set("confirm")}
								autoComplete='new-password'
								required
							/>
							{mismatch && <div className='small fw-normal mt-1 ps-0 ps-sm-2' style={{ color: "crimson" }}>Doesn't match</div>}
						</div>
					</div>

					<div className='form-check mt-3 fw-normal'>
						<input id='pw-show' className='form-check-input' type='checkbox' checked={show} onChange={(e) => setShow(e.target.checked)} />
						<label htmlFor='pw-show' className='form-check-label small'>Show passwords</label>
					</div>

					{err && (
						<div role='alert' className='small fw-normal mt-2' style={{ color: "crimson" }}>
							{err}
						</div>
					)}

					<div className='d-flex flex-wrap gap-2 justify-content-end mt-3'>
						<button
							type='button'
							className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 px-4 text-main'
							onClick={close}
							disabled={saving}>
							Cancel
						</button>
						<button
							type='submit'
							className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 px-4 text-main-light'
							disabled={saving || !fields.current || !fields.next || !fields.confirm}>
							{saving ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
