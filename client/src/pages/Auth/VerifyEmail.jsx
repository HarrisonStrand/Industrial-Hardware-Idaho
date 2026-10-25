import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext";
import { apiFetch } from "../../utils/apiFetch";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import CodeInput from "../../components/Auth/CodeInput.jsx";
import "./VerifyEmail.css";

const RESEND_WAIT_SECONDS = 60;
const STORAGE_KEY = "ihi.verifyEmail";

function readStoredEmail() {
	try {
		return sessionStorage.getItem(STORAGE_KEY) || "";
	} catch {
		return "";
	}
}

function storeEmail(value) {
	try {
		if (value) sessionStorage.setItem(STORAGE_KEY, value);
		else sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Private windows can refuse storage; the page still works.
	}
}

// Step after sign-up: enter the 6-digit code emailed to the new account.
export default function VerifyEmail() {
	const { user, loadingAuth, setUser } = useAuth();
	const { showToast } = useToast();
	const navigate = useNavigate();
	const location = useLocation();

	const [email, setEmail] = useState(location.state?.email || readStoredEmail());
	const [emailLocked, setEmailLocked] = useState(Boolean(location.state?.email || readStoredEmail()));
	const [code, setCode] = useState("");
	const [err, setErr] = useState(
		location.state?.emailSent === false
			? "We couldn't send the email just now. Press \"Send a new code\"."
			: "",
	);
	const [alreadyVerified, setAlreadyVerified] = useState(false);
	const [verifying, setVerifying] = useState(false);
	const [resending, setResending] = useState(false);
	// Wait before resending only when a code was just sent on the way here.
	const [wait, setWait] = useState(
		location.state?.email && location.state?.emailSent !== false ? RESEND_WAIT_SECONDS : 0,
	);
	const codeRef = useRef(null);

	useEffect(() => {
		storeEmail(email);
	}, [email]);

	useEffect(() => {
		if (wait <= 0) return undefined;
		const timer = setTimeout(() => setWait((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [wait]);

	useEffect(() => {
		if (!loadingAuth && user) navigate("/profile", { replace: true });
	}, [user, loadingAuth, navigate]);

	async function verify(value = code) {
		if (verifying) return;
		setErr("");
		if (!email.trim()) {
			setErr("Enter the email you signed up with.");
			return;
		}
		if (value.length !== 6) {
			setErr("Enter all 6 digits.");
			return;
		}

		setVerifying(true);
		try {
			const data = await apiFetch("/api/auth/verify-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim(), code: value }),
			});
			storeEmail("");
			setUser(data.user);
			showToast({ variant: "success", message: "Email verified. Your account is ready." });
			const from = location.state?.from;
			navigate(from || (data.user?.role === "admin" ? "/admin" : "/profile"), { replace: true });
		} catch (ex) {
			if (ex?.code === "ALREADY_VERIFIED") setAlreadyVerified(true);
			setErr(ex?.message || "Verification failed.");
			setCode("");
			codeRef.current?.clearAndFocus();
		} finally {
			setVerifying(false);
		}
	}

	async function resend() {
		setErr("");
		if (!email.trim()) {
			setErr("Enter the email you signed up with.");
			return;
		}
		setResending(true);
		try {
			await apiFetch("/api/auth/resend-verification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim() }),
			});
			setEmailLocked(true);
			setWait(RESEND_WAIT_SECONDS);
			showToast({ variant: "success", message: "If that sign-up is waiting for a code, we sent a new one." });
		} catch (ex) {
			setErr(ex?.message || "Could not send a new code.");
		} finally {
			setResending(false);
		}
	}

	function onCodeChange(digits) {
		setCode(digits);
		if (digits.length === 6) verify(digits);
	}

	// Start in the first box once the page is ready.
	useEffect(() => {
		if (!loadingAuth && !user) setTimeout(() => codeRef.current?.focus(), 0);
	}, [loadingAuth, user]);

	if (loadingAuth || user) return null;

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>Verify Your Email</div>

					<div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<form
							className='contact-form verify-email-form g-0 py-3 mx-auto'
							onSubmit={(e) => {
								e.preventDefault();
								verify();
							}}>
							{emailLocked ? (
								<p className='text-center text-dark mb-4'>
									{location.state?.fromLogin
										? "Your account isn't verified yet. "
										: "Almost done. "}
									We sent a 6-digit code to <span className='fw-semibold text-break'>{email}</span>. It
									expires in 15 minutes.{" "}
									<button
										type='button'
										className='btn btn-link p-0 align-baseline small'
										onClick={() => setEmailLocked(false)}>
										Not your email?
									</button>
								</p>
							) : (
								<div className='mb-3'>
									<label
										htmlFor='verify-email-address'
										className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
										Email you signed up with
									</label>
									<input
										id='verify-email-address'
										type='email'
										className='form-input form-control rounded-3 text-dark'
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										autoComplete='email'
										required
									/>
								</div>
							)}

							<label
								htmlFor='verify-email-code'
								className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
								6-digit code
							</label>
							<CodeInput
								ref={codeRef}
								value={code}
								onChange={onCodeChange}
								disabled={verifying}
								describedBy='verify-email-error'
							/>

							<div id='verify-email-error' role='alert' className='verify-email-error mt-2'>
								{err}
								{alreadyVerified && (
									<>
										{" "}
										<Link to='/login'>Sign in</Link>
									</>
								)}
							</div>

							<div className='d-flex flex-column flex-sm-row gap-2 justify-content-center mt-3'>
								<button
									type='submit'
									disabled={verifying || code.length !== 6}
									className='btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 px-4 text-main-light'>
									{verifying ? "Checking..." : "Verify"}
								</button>
								<button
									type='button'
									onClick={resend}
									disabled={resending || wait > 0}
									className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 px-4 text-main'>
									{resending ? "Sending..." : wait > 0 ? `Send a new code (${wait}s)` : "Send a new code"}
								</button>
							</div>

							<p className='text-muted small text-center mt-3 mb-0'>
								Don't see it? Check your spam or junk folder. You can keep browsing the store without an
								account.
							</p>
						</form>
					</div>
				</div>
			</div>

			<ContactBanner />
		</>
	);
}
