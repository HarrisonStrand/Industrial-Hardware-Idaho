import SpecialRequestForm from "../../components/SpecialRequestForm/SpecialRequestForm";
import CategorySection from "../../components/CategorySection/CategorySection";
import FAQAccordion from "../../components/FAQ/FAQAccordion.jsx";
import "../../components/FAQ/FAQAccordion.css";
import "./SpecialRequests.css";

export default function SpecialRequests() {
	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						Special Requests
					</div>

					<div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<div className='row m-0'>
							<div className='text-main mb-2'>
								Looking for something you can't find on the website? Send us
								what you need and we'll track it down.
							</div>

							<SpecialRequestForm />
						</div>
					</div>
				</div>
			</div>

			<CategorySection />
			<FAQAccordion
				categories={["special-requests", "products"]}
				title='Special Request FAQs'
				subtitle='Answers for quote requests, custom items, and hard-to-find products.'
			/>
		</>
	);
}
