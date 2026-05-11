import { useMemo, useState } from "react";
import FAQ_SECTIONS from "./faqData";

function FAQRow({ question, answer, isOpen, onToggle }) {
	return (
		<div className=''>
			<button
				type='button'
				className='faq-toggle theme-detail-container rounded-4'
				onClick={onToggle}>
				<span className='faq-question'>{question}</span>
				<span className='faq-symbol'>{isOpen ? "−" : "+"}</span>
			</button>

			{isOpen && (
				<div className='faq-answer-wrap'>
					<div className='faq-answer'>{answer}</div>
				</div>
			)}
		</div>
	);
}

export default function FAQAccordion({
	categories = [],
	title = "Frequently Asked Questions",
	subtitle = "Quick answers to the most common questions.",
	itemColumnClassName = "",
	listColumnClassName = "",
	groupColumnClassName = ""
}) {
	const [openKey, setOpenKey] = useState("");

	const sections = useMemo(() => {
		if (!categories || categories.length === 0) return FAQ_SECTIONS;

		return FAQ_SECTIONS.filter((section) =>
			categories.includes(section.category),
		);
	}, [categories]);

	if (!sections.length) return null;

	return (
		<section className='faq-section container py-5'>
			<div className='text-center mb-4'>
				<h2 className='faq-title'>{title}</h2>
				<p className='faq-subtitle mb-0'>{subtitle}</p>
			</div>

			<div className='row'>
				{sections.map((section) => (
					<div
						key={section.category}
						className={groupColumnClassName || "faq-group col-12 col-md-6 py-2 pt-2 pt-md-4"}>
						<h3 className='faq-group-title'>{section.title}</h3>

						<div className={listColumnClassName || "row faq-list"}>
							{section.items.map((item, index) => {
								const key = `${section.category}-${index}`;
								const isOpen = openKey === key;

								return (
									<div key={key} className={itemColumnClassName || "col-12"}>
										<FAQRow
											question={item.question}
											answer={item.answer}
											isOpen={isOpen}
											onToggle={() => setOpenKey(isOpen ? "" : key)}
										/>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
