import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import "./HomeReviews.css";

const FALLBACK_DATA = {
	summary: {
		rating: 4.9,
		reviewCount: 87,
		sourceLabel: "Customer Reviews",
	},
	reviews: [
		{
			id: "1",
			authorName: "Mike T.",
			rating: 5,
			text: "Great service, knowledgeable staff, and they helped us find exactly what we needed fast.",
			dateLabel: "Recent review",
			source: "website",
		},
		{
			id: "2",
			authorName: "Sarah L.",
			rating: 5,
			text: "Very easy to work with and the ordering process was smooth. We’ll definitely be ordering again.",
			dateLabel: "Recent review",
			source: "website",
		},
		{
			id: "3",
			authorName: "James R.",
			rating: 5,
			text: "Fast response time and excellent customer service. Product quality was exactly what we hoped for.",
			dateLabel: "Recent review",
			source: "website",
		},
	],
};

function StarRow({ rating = 0 }) {
	const rounded = Math.round(Number(rating || 0));

	return (
		<div className='d-flex align-items-center justify-content-center gap-1'>
			{[1, 2, 3, 4, 5].map((star) => (
				<i
					key={star}
					className={`bi ${star <= rounded ? "bi-star-fill" : "bi-star"} review-star`}
				/>
			))}
		</div>
	);
}

function ReviewCard({ review }) {
	return (
		<div className='home-review-card rounded-4 h-100 p-4'>
			<div className='review-author-row'>
				<div>
					<div className='text-main text-uppercase fw-bold review-author'>
						{review.authorName || "Anonymous"}
					</div>
					<div className='small text-muted'>
						{review.dateLabel || "Recent review"}
					</div>
				</div>

				<div className='review-source-badge text-uppercase'>
					{review.source === "google" ? "Google" : "Website"}
				</div>
			</div>

			<div className='review-stars-row'>
				<StarRow rating={review.rating} />
			</div>

			<div className='text-main review-copy'>
				“{review.text || "Great experience."}”
			</div>
		</div>
	);
}

function ReviewModal({ open, onClose, onSuccess }) {
	const [form, setForm] = useState({
		authorName: "",
		email: "",
		rating: 5,
		text: "",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		if (!open) return;

		const onKeyDown = (e) => {
			if (e.key === "Escape") onClose();
		};

		document.addEventListener("keydown", onKeyDown);
		document.body.style.overflow = "hidden";

		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);

	useEffect(() => {
		if (!open) return;

		setError("");
		setSaving(false);
		setSubmitted(false);
		setForm({
			authorName: "",
			email: "",
			rating: 5,
			text: "",
		});
	}, [open]);

	if (!open) return null;

	function updateField(key, value) {
		setForm((prev) => ({
			...prev,
			[key]: value,
		}));
	}

	async function handleSubmit(e) {
		e.preventDefault();

		try {
			setSaving(true);
			setError("");

			await apiFetch("/api/reviews", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					authorName: form.authorName,
					email: form.email,
					rating: Number(form.rating || 0),
					text: form.text,
				}),
			});

			setSubmitted(true);
			onSuccess?.();
		} catch (err) {
			console.error(err);
			setError(err.message || "Failed to submit review");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className='review-modal-backdrop' onClick={onClose}>
			<div className="review-modal-panel rounded-4 p-0">

			<div
				className='review-modal-panel rounded-4 modal-overlay'
				onClick={(e) => e.stopPropagation()}>
				<div className='d-flex justify-content-between align-items-start gap-3 mb-3'>
					<div>
						<div className='text-main text-uppercase fs-4 fw-bold'>
							Leave A Review
						</div>
						<div className='text-muted small'>
							Share your experience with us.
						</div>
					</div>

					<button
						type='button'
						className='review-modal-close'
						onClick={onClose}
						aria-label='Close review modal'>
						<i className='bi bi-x-lg' />
					</button>
				</div>

				{submitted ? (
					<div className='review-submit-success rounded-4 p-4 text-center'>
						<div className='text-main text-uppercase fw-bold fs-5 mb-2'>
							Thank You
						</div>
						<div className='text-main mb-3'>
							Your review has been submitted and is now pending approval.
						</div>

						<button
							type='button'
							className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light'
							onClick={onClose}>
							Close
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit}>
						{error ? (
							<div className='alert alert-danger py-2 mb-3'>{error}</div>
						) : null}

						<div className='row g-3'>
							<div className='col-12 col-md-6'>
								<label className='mb-0 ps-2 form-label text-uppercase small fw-bold text-main'>
									Name
								</label>
								<input
									type='text'
									className='form-input form-control rounded-3 text-dark'
									value={form.authorName}
									onChange={(e) => updateField("authorName", e.target.value)}
									required
								/>
							</div>

							<div className='col-12 col-md-6'>
								<label className='mb-0 ps-2 form-label text-uppercase small fw-bold text-main'>
									Email
								</label>
								<input
									type='email'
									className='form-input form-control rounded-3 text-dark'
									value={form.email}
									onChange={(e) => updateField("email", e.target.value)}
								/>
							</div>

							<div className='col-12'>
								<label className='mb-0 ps-2 form-label text-uppercase small fw-bold text-main'>
									Rating
								</label>
								<select
									className='form-input form-select rounded-3 text-dark'
									value={form.rating}
									onChange={(e) =>
										updateField("rating", Number(e.target.value))
									}>
									<option value={5}>5 - Excellent</option>
									<option value={4}>4 - Great</option>
									<option value={3}>3 - Good</option>
									<option value={2}>2 - Fair</option>
									<option value={1}>1 - Poor</option>
								</select>
							</div>

							<div className='col-12'>
								<label className='mb-0 ps-2 form-label text-uppercase small fw-bold text-main'>
									Review
								</label>
								<textarea
									rows='5'
									className='form-input form-control rounded-3 text-dark'
									value={form.text}
									onChange={(e) => updateField("text", e.target.value)}
									required
								/>
							</div>
						</div>

						<div className='d-flex justify-content-end gap-2 mt-4'>
							<button
								type='button'
								className='btn-secondary-cta rounded-3 text-uppercase fw-regular text-main bg-white'
								onClick={onClose}
								disabled={saving}>
								Cancel
							</button>

							<button
								type='submit'
								className='btn-main-cta rounded-3 text-uppercase fw-regular text-main-light px-0'
								disabled={saving}>
								{saving ? "Submitting..." : "Submit Review"}
							</button>
						</div>
					</form>
				)}
			</div>
			</div>
		</div>
	);
}

export default function HomeReviews() {
	const [data, setData] = useState(FALLBACK_DATA);
	const [loading, setLoading] = useState(true);
	const [activeIndex, setActiveIndex] = useState(0);
	const [isTransitioning, setIsTransitioning] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);

	async function loadReviews() {
		try {
			const response = await apiFetch("/api/reviews/home");

			const safeReviews = Array.isArray(response?.reviews)
				? response.reviews
				: FALLBACK_DATA.reviews;

			const safeSummary = response?.summary || FALLBACK_DATA.summary;

			setData({
				summary: safeSummary,
				reviews: safeReviews.length ? safeReviews : FALLBACK_DATA.reviews,
			});
		} catch (err) {
			console.error("Failed to load home reviews:", err);
			setData(FALLBACK_DATA);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		let alive = true;

		async function run() {
			try {
				const response = await apiFetch("/api/reviews/home");
				if (!alive) return;

				const safeReviews = Array.isArray(response?.reviews)
					? response.reviews
					: FALLBACK_DATA.reviews;

				const safeSummary = response?.summary || FALLBACK_DATA.summary;

				setData({
					summary: safeSummary,
					reviews: safeReviews.length ? safeReviews : FALLBACK_DATA.reviews,
				});
			} catch (err) {
				console.error("Failed to load home reviews:", err);
				if (alive) setData(FALLBACK_DATA);
			} finally {
				if (alive) setLoading(false);
			}
		}

		run();

		return () => {
			alive = false;
		};
	}, []);

	const reviews = useMemo(() => {
		return Array.isArray(data?.reviews) ? data.reviews : [];
	}, [data]);

	const extendedReviews = useMemo(() => {
		if (!reviews.length) return [];
		if (reviews.length === 1) return reviews;
		return [reviews[reviews.length - 1], ...reviews, reviews[0]];
	}, [reviews]);

	useEffect(() => {
		if (reviews.length <= 1) return;

		const interval = window.setInterval(() => {
			setIsTransitioning(true);
			setActiveIndex((prev) => prev + 1);
		}, 5500);

		return () => window.clearInterval(interval);
	}, [reviews.length]);

	useEffect(() => {
		if (reviews.length <= 1) return;

		if (activeIndex === reviews.length) {
			const timeout = window.setTimeout(() => {
				setIsTransitioning(false);
				setActiveIndex(0);
			}, 500);

			return () => window.clearTimeout(timeout);
		}

		if (activeIndex < 0) {
			const timeout = window.setTimeout(() => {
				setIsTransitioning(false);
				setActiveIndex(reviews.length - 1);
			}, 500);

			return () => window.clearTimeout(timeout);
		}
	}, [activeIndex, reviews.length]);

	useEffect(() => {
		if (!isTransitioning) {
			const frame = window.requestAnimationFrame(() => {
				const frame2 = window.requestAnimationFrame(() => {
					setIsTransitioning(true);
				});
				return () => window.cancelAnimationFrame(frame2);
			});

			return () => window.cancelAnimationFrame(frame);
		}
	}, [isTransitioning]);

	const goPrev = () => {
		if (reviews.length <= 1) return;
		setIsTransitioning(true);
		setActiveIndex((prev) => prev - 1);
	};

	const goNext = () => {
		if (reviews.length <= 1) return;
		setIsTransitioning(true);
		setActiveIndex((prev) => prev + 1);
	};

	const displayIndex = reviews.length > 1 ? activeIndex + 1 : activeIndex;

	return (
		<>
			<section className='container-fluid px-3 px-sm-4 py-4 justify-content-center'>
				<div className='theme-section-container home-reviews-shell rounded-4 p-3 p-md-2 mx-auto mb-5'>
					<div className='row justify-content-center align-items-end pb-0 mb-0 mx-auto banner-title pt-3'>
						<div className='col-12 col-xl-6'>
							<div className='section-title text-main text-uppercase mb-0'>
								Customer Reviews
							</div>
						</div>
						<div className='col-12 col-xl-6'>
							<div className='review-header-rating-wrap'>
								<div className='review-header-rating-block'>
									<div className='review-header-score-row'>
										<div className='home-review-rating-number fs-1 text-main fw-bold mb-0'>
											{Number(data?.summary?.rating || 0).toFixed(1)}
										</div>
										<StarRow rating={data?.summary?.rating || 0} />
									</div>

									<div className='section-copy text-main fw-light mb-0 review-header-count'>
										Based on {Number(data?.summary?.reviewCount || 0)} reviews
									</div>
								</div>
							</div>
						</div>
						<div className='container-fluid text-center row justify-content-center'>
							<hr className='w-100 my-1' />
						</div>
					</div>

					<div className='row justify-content-center'>
						<div className='col-12 col-xl-12'>
							<div className='home-review-carousel-wrap position-relative'>
								{loading ? (
									<div className='home-review-card rounded-4 p-4 text-center text-muted'>
										Loading reviews...
									</div>
								) : reviews.length ? (
									<div className='home-review-viewport'>
										<div
											className='home-review-track'
											style={{
												transform: `translateX(-${displayIndex * 100}%)`,
												transition: isTransitioning
													? "transform 500ms ease"
													: "none",
											}}>
											{extendedReviews.map((review, index) => (
												<div
													className='home-review-slide'
													key={`${review.id || review._id || "review"}-${index}`}>
													<div className='review-slide-inner'>
														<ReviewCard review={review} />
													</div>
												</div>
											))}
										</div>
									</div>
								) : (
									<div className='home-review-card rounded-4 p-4 text-center text-muted'>
										No reviews available yet.
									</div>
								)}
							</div>

							{reviews.length > 1 ? (
								<div className='d-flex justify-content-center gap-2 mt-3'>
									{reviews.map((review, index) => (
										<button
											key={review.id || review._id || index}
											type='button'
											className={`review-dot ${index === activeIndex ? "active" : ""}`}
											onClick={() => {
												setIsTransitioning(true);
												setActiveIndex(index);
											}}
											aria-label={`Go to review ${index + 1}`}
										/>
									))}
								</div>
							) : null}

							<div className='d-flex justify-content-center my-4'>
								<button
									type='button'
									className='btn-main-cta rounded-4 text-uppercase fw-regular fs-5 py-3 text-main-light'
									onClick={() => setModalOpen(true)}>
									Leave A Review
								</button>
							</div>
						</div>
					</div>
				</div>
			</section>

			<ReviewModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onSuccess={() => {
					loadReviews();
				}}
			/>
		</>
	);
}
