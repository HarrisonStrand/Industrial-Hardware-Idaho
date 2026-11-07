// Bits & Drivers and Hand Tools pages: a Type read from what a product already says. Plain code; no
// product data changes.

// Masonry bits by shank (SDS-Plus, SDS-Max, hammer drill ...), chisels and adapters on their own.
export function masonryBitType(attributes = {}, title = "") {
	const text = `${title} ${attributes.toolType || ""}`.toLowerCase();
	const shank = String(attributes.shankSize || "").toLowerCase();
	if (text.includes("adapter")) return "Adapter";
	if (text.includes("chisel")) return "SDS-Max Chisel";
	if (shank === "sds-max" || text.includes("sds-max")) return "SDS-Max";
	if (shank === "sds-plus" || text.includes("sds-plus") || /\bsds\b/.test(text)) return "SDS-Plus";
	if (shank === "spline" || text.includes("spline")) return "Spline Shank";
	if (shank.includes("taper") || text.includes("taper shank")) return "Taper Shank";
	if (text.includes("hammer")) return "Hammer Drill";
	return "Masonry Drill";
}

const HAND_TOOL_GROUPS = [
	[/socket/, "Sockets"],
	[/ratchet(?! screwdriver)|extension|flex handle|universal joint|speeder|sliding t handle|adapt(o|e)r/, "Ratchets & Accessories"],
	[/wrench/, "Wrenches"],
	[/screwdriver|bit driver/, "Screwdrivers"],
	[/hex key|torx/, "Hex & Torx Keys"],
	[/plier|wire stripper|cable cutter/, "Pliers & Cutters"],
	[/file/, "Files"],
	[/chisel/, "Chisels"],
	[/knife|blade|scraper/, "Knives & Blades"],
	[/clamp/, "Clamps"],
	[/brush/, "Brushes"],
	[/hammer/, "Hammers"],
	[/die stock/, "Threading Tools"],
	[/level|chalk/, "Measuring & Marking"],
];

export function handToolType(attributes = {}, title = "") {
	const text = `${attributes.toolType || ""} ${title}`.toLowerCase();
	for (const [re, label] of HAND_TOOL_GROUPS) if (re.test(text)) return label;
	return "Other";
}

function shape(add) {
	return (variants = []) =>
		variants.map((variant) => ({
			...variant,
			attributes: { ...(variant.attributes || {}), ...add(variant.attributes || {}, variant.name || "") },
		}));
}

export const TOOL_PAGES = {
	"bits-drivers/masonry-bits": shape((a, t) => ({ bitType: masonryBitType(a, t) })),
	"tools/hand-tools": shape((a, t) => ({ productGroup: handToolType(a, t) })),
};
