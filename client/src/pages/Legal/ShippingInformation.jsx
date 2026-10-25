import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import FAQAccordion from "../../components/FAQ/FAQAccordion.jsx";
import { Link } from "react-router-dom";
import "../../components/FAQ/FAQAccordion.css";
import "./Legal.css";

export default function ShippingInformation() {
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
						Pickup & Delivery
					</div>

					<div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<div className='row m-0'>
							<div className='legal-copy text-main'>
								<p className='mb-3'>
									<span className='fw-semibold'>All online orders from {BRAND} are pickup / will call</span> at
									our store. We don't ship online orders.
								</p>

								<h5 className='legal-title text-uppercase mt-4 text-center text-sm-start'>Where to pick up</h5>
								<p className='mb-2'>
									<span className='fw-semibold'>{BRAND}</span>
									<br />
									{ADDR1 || "115 E 48th St"}
									{ADDR2 ? (
										<>
											<br />
											{ADDR2}
										</>
									) : null}
									<br />
									{CITY || "Boise, ID 83714"}
								</p>
								{HOURS ? (
									<p className='text-muted small mb-3'>
										Pickup hours: <span className='fw-semibold'>{HOURS}</span>
									</p>
								) : null}

								<h5 className='legal-title text-uppercase mt-4 text-center text-sm-start'>When it's ready</h5>
								<p className='mb-3'>
									Most in-stock orders are ready within <span className='fw-semibold'>1–2 business days</span>.
									We'll contact you when your order is ready. Larger orders may take a little longer.
								</p>

								<h5 className='legal-title text-uppercase mt-4 text-center text-sm-start'>Backorders</h5>
								<p className='mb-3'>
									If an item is out of stock, it's backordered. Backordered items typically take{" "}
									<span className='fw-semibold'>3–4 business days</span>, but we can't guarantee timing. We
									usually hold an order until it's complete; if you'd like to pick up the in-stock items first,
									just let us know.
								</p>

								<h5 className='legal-title text-uppercase mt-4 text-center text-sm-start'>Delivery</h5>
								<p className='mb-3'>
									Businesses on our established delivery schedule can arrange delivery directly with our
									team. Please call us to ask.
								</p>

								<h5 className='legal-title text-uppercase mt-4 text-center text-sm-start'>Questions?</h5>
								<p className='mb-0'>
									For pickup questions, contact us
									{EMAIL ? (
										<>
											{" "}
											at 
											<Link to={`mailto:${EMAIL}`} className="text-decoration-none text-secondary"><span className='fw-semibold'> {EMAIL}</span></Link>
										</>
									) : null}
									{PHONE ? (
										<>
											{" "}
											or <Link to={`tel:${PHONE}`} className="text-decoration-none text-secondary"><span className='fw-semibold'> {PHONE}</span></Link>
										</>
									) : null}
									.
								</p>

								<p className='text-muted small mt-3 mb-0'>
									Last updated: {new Date().toLocaleDateString()}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<ContactBanner />
			<FAQAccordion
				categories={["shipping", "ordering"]}
				title='Pickup FAQs'
				subtitle='Helpful answers about pickup, timing, and order processing.'
			/>
		</>
	);
}
