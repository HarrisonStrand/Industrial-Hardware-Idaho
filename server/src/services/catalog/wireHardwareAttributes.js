// Wire hardware pages: Type and Material / Finish read from the product title where the data does not store
// them ("Zinc Clevis Pin", "Stainless Steel Woodruff Key", "Galvanized Screw Pin Shackle"). Plain code; no
// product data changes.

const FINISH_WORDS = [
	[/\b316 stainless/i, "316 Stainless Steel"],
	[/\bstainless/i, "Stainless Steel"],
	[/\bhot-?dip galvanized/i, "Hot-Dip Galvanized"],
	[/\bgalvanized/i, "Galvanized"],
	[/\bzinc/i, "Zinc Plated"],
	[/\bbrass\b/i, "Brass"],
	[/\bbronze\b/i, "Bronze"],
	[/\baluminum\b/i, "Aluminum"],
	[/\balloy steel\b/i, "Alloy Steel"],
	[/\bplain\b/i, "Plain Steel"],
	[/\bsteel\b/i, "Steel"],
];

function titleHead(title = "") {
	return String(title).split(/\s+–\s+/)[0];
}

// One name per finish: the stored values and the title words say the same things differently.
const FINISH_NAMES = {
	steel: "Plain Steel",
	plain: "Plain Steel",
	"steel / plain": "Plain Steel",
	"steel / zinc": "Zinc Plated",
	zinc: "Zinc Plated",
	"steel / yellow zinc": "Yellow Zinc",
	"stainless steel / stainless": "Stainless Steel",
};

function finishName(value = "") {
	const text = String(value || "").trim();
	return FINISH_NAMES[text.toLowerCase()] || text;
}

// Material / finish from the title's leading words, else the stored value.
export function titleFinish(title = "", stored = "") {
	const head = titleHead(title);
	for (const [re, label] of FINISH_WORDS) if (re.test(head)) return finishName(label);
	return finishName(stored);
}

const titleCase = (text) => String(text || "").trim().replace(/\b\w/g, (c) => c.toUpperCase());

export function clevisPinType(title = "") {
	const head = titleHead(title).toLowerCase();
	if (head.includes("detent")) return "Detent Ring Pin";
	if (head.includes("yoke")) return "Yoke End";
	return "Clevis Pin";
}

export function keyType(title = "") {
	const head = titleHead(title).toLowerCase();
	if (head.includes("woodruff")) return "Woodruff Key";
	if (head.includes("rectangular")) return "Rectangular Key Stock";
	if (head.includes("straight key")) return "Straight Key";
	return "Square Key Stock";
}

const CHAIN_GROUPS = [
	[/hook/i, "Hooks"],
	[/shackle/i, "Shackles"],
	[/wire rope clip/i, "Wire Rope Clips"],
	[/sleeve/i, "Wire Rope Sleeves"],
	[/thimble/i, "Wire Rope Thimbles"],
	[/eye nut/i, "Eye Nuts"],
	[/binder/i, "Chain Binders"],
	[/link|cold shut/i, "Links"],
];

export function chainHardwareType(title = "", stored = "") {
	const text = `${stored} ${titleHead(title)}`;
	for (const [re, label] of CHAIN_GROUPS) if (re.test(text)) return label;
	return titleCase(stored || titleHead(title));
}

export function wireLockPinType(title = "") {
	return /\bsquare\b/i.test(titleHead(title)) ? "Square" : "Round";
}

// ".080" Wire" in a screw eye title.
export function screwEyeWire(title = "") {
	const match = String(title).match(/(\.\d+|\d+\/\d+)"\s*wire/i);
	return match ? match[1] : "";
}

const stripInch = (value) => String(value || "").replace(/["”″]+$/, "").trim();

function shape(add) {
	return (variants = []) =>
		variants.map((variant) => ({
			...variant,
			attributes: { ...(variant.attributes || {}), ...add(variant.attributes || {}, variant.name || "") },
		}));
}

export const WIRE_HARDWARE_PAGES = {
	"wire-hardware/eye-bolts": shape((a, t) => ({ titleFinish: titleFinish(t, a.materialFinish) })),
	"wire-hardware/clevis-pins": shape((a, t) => ({
		pinType: clevisPinType(t),
		titleFinish: titleFinish(t, a.materialFinish),
	})),
	"wire-hardware/hitch-pins": shape((a, t) => ({
		pinType: titleCase(a.hardwareType || titleHead(t)),
		width: stripInch(a.size || a.diameter),
		titleFinish: titleFinish(t, a.materialFinish),
	})),
	"wire-hardware/keys-key-stock": shape((a, t) => ({
		keyType: keyType(t),
		width: stripInch(a.diameter),
		titleFinish: titleFinish(t, a.materialFinish),
	})),
	"wire-hardware/chain-hardware": shape((a, t) => ({
		hardwareGroup: chainHardwareType(t, a.hardwareType),
		size: stripInch(a.size),
		titleFinish: titleFinish(t, a.materialFinish),
	})),
	"wire-hardware/screw-eyes": shape((a, t) => ({
		wireSize: screwEyeWire(t),
		titleFinish: titleFinish(t, a.materialFinish),
	})),
	"wire-hardware/wire-lock-pins": shape((a, t) => ({ pinType: wireLockPinType(t) })),
};
