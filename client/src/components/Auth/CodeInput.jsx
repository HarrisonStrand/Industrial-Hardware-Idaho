import { forwardRef, useImperativeHandle, useRef } from "react";
import "./CodeInput.css";

const LENGTH = 6;

// Six one-digit boxes. Typing moves to the next box, Backspace moves back,
// and pasting a whole code fills every box.
const CodeInput = forwardRef(function CodeInput({ value, onChange, disabled = false, describedBy }, ref) {
	const boxes = useRef([]);
	// Latest code, updated before focus moves (React state lags one render behind).
	const latest = useRef(value);
	latest.current = value;
	const digits = Array.from({ length: LENGTH }, (_, i) => value[i] || "");

	useImperativeHandle(ref, () => ({
		focus: () => boxes.current[Math.min(value.length, LENGTH - 1)]?.focus(),
		clearAndFocus: () => boxes.current[0]?.focus(),
	}));

	function commit(next) {
		latest.current = next;
		onChange(next);
	}

	function setFrom(index, text) {
		const incoming = text.replace(/\D/g, "");
		if (!incoming) return;
		const next = (latest.current.slice(0, index) + incoming).slice(0, LENGTH);
		commit(next);
		boxes.current[Math.min(next.length, LENGTH - 1)]?.focus();
	}

	function onKeyDown(index, e) {
		if (e.key === "Backspace") {
			e.preventDefault();
			const cur = latest.current;
			if (cur[index]) {
				commit(cur.slice(0, index) + cur.slice(index + 1));
			} else if (index > 0) {
				commit(cur.slice(0, index - 1) + cur.slice(index));
				boxes.current[index - 1]?.focus();
			}
		} else if (e.key === "ArrowLeft" && index > 0) {
			boxes.current[index - 1]?.focus();
		} else if (e.key === "ArrowRight" && index < LENGTH - 1) {
			boxes.current[index + 1]?.focus();
		}
	}

	return (
		<div className='code-input' role='group' aria-label='6-digit code' aria-describedby={describedBy}>
			{digits.map((digit, i) => (
				<input
					key={i}
					id={i === 0 ? "verify-email-code" : undefined}
					ref={(el) => (boxes.current[i] = el)}
					className='form-input form-control rounded-3 text-dark code-input-box'
					value={digit}
					inputMode='numeric'
					autoComplete={i === 0 ? "one-time-code" : "off"}
					aria-label={`Digit ${i + 1}`}
					maxLength={LENGTH}
					disabled={disabled}
					// Only the box after the last filled digit takes typing, so digits stay in order.
					onFocus={(e) => {
						const filled = latest.current.length;
						if (i > filled) boxes.current[filled]?.focus();
						else e.target.select();
					}}
					onChange={(e) => {
						const typed = e.target.value.replace(/\D/g, "");
						if (typed.length > 1) {
							// Phone autofill or a fast typist: fill from the first box.
							setFrom(i === 0 ? 0 : i, digit && typed.startsWith(digit) ? typed.slice(1) : typed);
							return;
						}
						if (!typed) return;
						const cur = latest.current;
						const next = (cur.slice(0, i) + typed + cur.slice(i + 1)).slice(0, LENGTH);
						commit(next);
						if (i < LENGTH - 1) boxes.current[i + 1]?.focus();
					}}
					onKeyDown={(e) => onKeyDown(i, e)}
					onPaste={(e) => {
						e.preventDefault();
						setFrom(0, e.clipboardData.getData("text"));
					}}
				/>
			))}
		</div>
	);
});

export default CodeInput;
