import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Legal.css";

export default function CustomerService() {
	const brand = useContext(BrandContext);

	const BRAND = brand?.brandName || "";
	const EMAIL = brand?.supportEmail || "";
	const PHONE = brand?.supportPhone || "";
	const HOURS = brand?.supportHours || "";
	const ADDR1 = brand?.supportAddressLine1 || "";
	const ADDR2 = brand?.supportAddressLine2 || "";
	const CITY = brand?.supportCityStateZip || "";

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						Customer Service
					</div>

					<div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<div className='row m-0'>
							<div className='legal-copy text-main'>
								<p className='mb-3'>
									Need help with an order, product questions, or account
									support? We’re here to help.
								</p>

								<h5 className='legal-title text-uppercase mt-4'>Contact</h5>
								<ul className='legal-list'>
									{EMAIL && (
										<li>
											Email: <span className='fw-semibold'>{EMAIL}</span>
										</li>
									)}
									{PHONE && (
										<li>
											Phone: <span className='fw-semibold'>{PHONE}</span>
										</li>
									)}
									{HOURS && (
										<li>
											Hours: <span className='fw-semibold'>{HOURS}</span>
										</li>
									)}
								</ul>

								{(ADDR1 || CITY) && (
									<>
										<h5 className='legal-title text-uppercase mt-4'>
											Store / pickup address
										</h5>
										<p className='mb-3'>
											<span className='fw-semibold'>{BRAND}</span>
											<br />
											{ADDR1}
											{ADDR2 ? (
												<>
													<br />
													{ADDR2}
												</>
											) : null}
											{CITY ? (
												<>
													<br />
													{CITY}
												</>
											) : null}
										</p>
									</>
								)}

								<h5 className='legal-title text-uppercase mt-4'>Order help</h5>
								<ul className='legal-list'>
									<li>Order status, tracking, and delivery questions</li>
									<li>Backorders and special order timelines</li>
									<li>Returns & exchanges</li>
									<li>Invoice / receipt requests</li>
								</ul>

								<h5 className='legal-title text-uppercase mt-4'>Backorders</h5>
								<p className='mb-0'>
									Some industrial hardware items may be temporarily out of
									stock. If an item is backordered, we will communicate updated
									ETAs when available.{" "}
									<span className='fw-semibold'>
										Orders are typically held until complete
									</span>
									, unless you request a partial shipment.
								</p>

								<h5 className='legal-title text-uppercase mt-4'>
									Special orders
								</h5>
								<p className='mb-0'>
									Special-order items may have different lead times and may be
									non-returnable. If you have questions before ordering, contact
									us and we’ll help confirm specs and lead times.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<ContactBanner />
		</>
	);
}
