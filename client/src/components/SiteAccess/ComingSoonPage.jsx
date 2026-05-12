import { Link } from "react-router-dom";

export default function ComingSoonPage({
	title = "Coming soon",
	description = "",
	backTo = "/",
	backLabel = "Back Home",
}) {
	return (
		<section className='container py-5'>
			<div className='row justify-content-center'>
				<div className='col-12 col-lg-8'>
					<div className='rounded-4 p-4 p-md-5 theme-section-container text-center shadow-sm'>
						<div className='text-main text-uppercase small fw-bold mb-2'>
							Under construction
						</div>
						<h1 className='text-main mb-3'>{title}</h1>
						<p className='text-muted fs-5 mb-4'>
							{description ||
								"This area is being polished for launch. We're hiding it until the experience is ready."}
						</p>

						<div className='d-flex flex-wrap justify-content-center gap-3'>
							<Link to={backTo} className='btn-main-cta px-4 py-2 text-main-light rounded-3 text-decoration-none'>
								{backLabel}
							</Link>
							<Link to='/contact' className='btn-secondary-cta text-main rounded-3 text-decoration-none px-4 py-2'>
								Contact Us
							</Link>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
