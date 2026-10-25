import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import CodeInput from "../Auth/CodeInput.jsx";
import "./DeleteAccount.css";

// Profile section: customers can delete their own account after confirming
// with their password (or an emailed code for Google sign-ins) and typing DELETE.
export default function DeleteAccount() {
	const { user, setUser } = useAuth();
	const { showToast } = useToast();
	const navigate = useNavigate();

	const usesCode = user?.authProvider === "google";
	const [open, setOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [typed, setTyped] = useState("");
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => e.key === "Escape" && !busy && close();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, busy]);

	function close() {
		setOpen(false);
		setPassword("");
		setCode("");
		setTyped("");
		setErr("");
	}

	async function sendCode() {
		setErr("");
		setBusy(true);
		try {
			await apiFetch("/api/auth/delete-account/send-code", { method: "POST" });
			setCodeSent(true);
			showToast({ variant: "success", message: "We emailed you a 6-digit code." });
		} catch (ex) {
			setErr(ex?.message || "Could not send the code.");
		} finally {
			setBusy(false);
		}
	}

	async function confirmDelete(e) {
		e.preventDefault();
		setErr("");
		setBusy(true);
		try {
			await apiFetch("/api/auth/delete-account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(usesCode ? { confirm: typed, code } : { confirm: typed, password }),
			});
			setUser(null);
			showToast({ variant: "success", message: "Your account was deleted." });
			navigate("/", { replace: true });
		} catch (ex) {
			setErr(ex?.message || "Could not delete the account.");
			setBusy(false);
		}
	}

	if (!user) return null;

	const ready = typed.trim() === "DELETE" && (usesCode ? code.length === 6 : password.length > 0);

	return (
		<div className='profile-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-xl-4 px-3 px-xl-5 fw-semibold g-0 mt-4'>
			<div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
				<div className='fs-4 contact-form-title text-main text-uppercase text-start'>Delete Account</div>
				{user.role !== "admin" && (
					<button type='button' className='btn btn-outline-danger rounded-3 text-uppercase py-2 px-4' onClick={() => setOpen(true)}>
						Delete Account
					</button>
				)}
			</div>
			<div className='text-muted small fw-normal mt-2'>
				{user.role === "admin"
					? "Admin accounts can't be deleted here. Ask another admin to remove this account."
					: "Permanently removes your sign-in, saved card, addresses and profile photo."}
			</div>

			{/* Rendered on <body>: the profile card's animation would otherwise trap the fixed overlay. */}
			{open && createPortal(
				<div className='delete-account-backdrop' onClick={() => !busy && close()}>
					<form
						className='delete-account-modal bg-white rounded-4 p-3 p-sm-4 text-dark fw-normal'
						role='dialog'
						aria-modal='true'
						aria-labelledby='delete-account-title'
						onClick={(e) => e.stopPropagation()}
						onSubmit={confirmDelete}>
						<div id='delete-account-title' className='fs-5 fw-semibold mb-2'>
							Delete your account?
						</div>
						<p className='mb-2'>This can't be undone. We'll remove:</p>
						<ul className='mb-2'>
							<li>Your sign-in for {user.email}</li>
							<li>Your saved card, addresses and profile photo</li>
						</ul>
						<p className='text-muted small mb-3'>
							Records of your past orders are kept by the store. You can create a new account anytime.
						</p>

						{usesCode ? (
							<div className='mb-3'>
								<div className='small fw-semibold mb-1'>Confirm with a code sent to your email</div>
								{codeSent ? (
									<CodeInput value={code} onChange={setCode} disabled={busy} />
								) : (
									<button type='button' className='btn btn-outline-dark btn-sm' onClick={sendCode} disabled={busy}>
										Email me a code
									</button>
								)}
							</div>
						) : (
							<div className='mb-3'>
								<label htmlFor='delete-account-password' className='small fw-semibold mb-1'>
									Your password
								</label>
								<input
									id='delete-account-password'
									type='password'
									className='form-control'
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete='current-password'
									autoFocus
								/>
							</div>
						)}

						<label htmlFor='delete-account-typed' className='small fw-semibold mb-1'>
							Type DELETE to confirm
						</label>
						<input
							id='delete-account-typed'
							className='form-control mb-2'
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							autoComplete='off'
							autoCapitalize='characters'
							spellCheck={false}
						/>

						{err && (
							<div role='alert' className='small mb-2' style={{ color: "crimson" }}>
								{err}
							</div>
						)}

						<div className='d-flex justify-content-end gap-2 mt-3'>
							<button type='button' className='btn btn-outline-dark' onClick={close} disabled={busy}>
								Cancel
							</button>
							<button type='submit' className='btn btn-danger' disabled={busy || !ready}>
								{busy ? "Deleting..." : "Delete Account"}
							</button>
						</div>
					</form>
				</div>,
				document.body,
			)}
		</div>
	);
}
