import ContactBanner from "../../components/ContactBanner/ContactBanner";
import vendorLogos from "../../data/vendorLogos";
import "./VendorInformation.css";
import { Link } from "react-router-dom";

function normalizeUrl(url = "") {
	if (!url) return "#";
	if (/^https?:\/\//i.test(url)) return url;
	return `https://${url}`;
}

export default function VendorInformation() {
	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						Vendor Information
					</div>

					<div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5 mb-4'>
						<div className='text-main mb-3'>
							<strong>Interested in becoming a vendor or supplier?</strong>{" "}
							We&apos;re always looking for quality product lines.
						</div>

						<div className='row g-3'>
							<div className='col-12 text-main'>
								Please send:
								<ul className='legal-list mt-2'>
									<li>Company overview and contact info</li>
									<li>Line card / catalog</li>
									<li>Pricing structure and terms</li>
									<li>Minimums, lead times, and freight details</li>
									<li>
										Warranty, compliance, and certifications (if applicable)
									</li>
								</ul>
							</div>

							<div className='col-12 text-main text-center fw-bold rounded-4 vendor-note-wrap'>
								<p className='vendor-information-note'>
									For the fastest review, use the Contact Page with “Vendor
									Inquiry” as the subject{" "}
									<Link
										to='/contact?subject=Vendor%20Inquiry'
										className='vendor-information-link text-uppercase'>
										HERE.
									</Link>{" "}
								</p>
							</div>
						</div>
					</div>

					<div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<div className='d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-2 mb-4'>
							<div>
								<h2 className='text-main text-uppercase mb-1 fs-3'>
									Current Vendors
								</h2>
								<p className='text-main vendor-info-subtext mb-0'>
									Trusted brands we currently carry
								</p>
							</div>

							{/* <div className='vendor-count-badge'>
								{vendorLogos.length} Vendors
							</div> */}
						</div>
						<hr className="mb-3"/>

						<div className='vendor-logo-grid'>
							{vendorLogos.map((vendor) => {
								const image = (
									<img
										src={vendor.logo}
										alt={vendor.name}
										className='vendor-logo-image'
										loading='lazy'
									/>
								);

								return vendor.website ? (
									<div className='vendor-logo-image-wrap'>
										<a
											key={vendor.name}
											href={vendor.website}
											target='_blank'
											rel='noreferrer'
											className='vendor-logo-link'
											aria-label={vendor.name}
											title={vendor.name}>
											{image}
										</a>
									</div>
								) : (
									<div className='vendor-logo-image-wrap'>
										<div
											key={vendor.name}
											className='vendor-logo-link'
											aria-label={vendor.name}
											title={vendor.name}>
											{image}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>

			<ContactBanner />
		</>
	);
}
