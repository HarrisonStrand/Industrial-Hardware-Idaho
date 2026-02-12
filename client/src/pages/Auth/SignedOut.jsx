import { Link } from "react-router-dom";

export default function SignedOut() {
	return (
		<div className='theme-container py-5'>
			<div className='row justify-content-center'>
				<div className='col-12 col-md-8 col-lg-6 text-center'>
					<div className='section-title text-main text-uppercase fw-regular mb-2'>
						You’ve Been Signed Out
					</div>

					<div className='section-copy text-muted fw-regular mb-4'>
						Your session has ended. Please log in again to continue.
					</div>
					<hr className='my-4 opacity-25' />
					<div className='d-flex justify-content-center gap-3 flex-wrap'>
						<Link to='/login' className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light text-decoration-none'>
							Log In
						</Link>

						<Link to='/' className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main text-decoration-none'>
							Go Home
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
