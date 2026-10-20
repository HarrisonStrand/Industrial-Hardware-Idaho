// Specifications table for a product page.
// Two kinds of value: what the maker's own catalog states (basis 'manufacturer'), and the minimum
// properties of the part's grade or class from its published standard (basis 'derived_from_standard').
// A standard value is a property of the grade, not a rating of this item, and the table says so.

import "./SpecificationsTable.css";

const GROUP_ORDER = ["Standards", "Mechanical", "Dimensions", "Other"];

function sourceLabel(spec) {
	if (spec.basis === "derived_from_standard") return spec.reference ? `Per ${spec.reference}` : "Per published standard";
	if (spec.basis === "manufacturer") return "Manufacturer";
	return "";
}

function groupSpecs(specs) {
	const groups = new Map();
	specs.forEach((spec) => {
		const group = spec.group || "Other";
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group).push(spec);
	});
	return [...groups.entries()].sort(
		([a], [b]) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99),
	);
}

export default function SpecificationsTable({ specs = [], className = "" }) {
	const rows = specs.filter((spec) => spec && spec.name && spec.value);
	if (!rows.length) return null;
	const hasStandard = rows.some((spec) => spec.basis === "derived_from_standard");

	return (
		<div className={className}>
			<div className='small text-muted text-uppercase mb-3'>Specifications</div>
			{groupSpecs(rows).map(([group, items]) => (
				<div key={group} className='mb-3'>
					<div className='small fw-bold text-main mb-1 text-uppercase ps-3'>{group}</div>
					<div className='mb-3 builder-detail-spec spec-table-card theme-section-container bg-light rounded-3 border px-3 py-2'>
						<table className='spec-table'>
							<colgroup>
								<col className='spec-table-name' />
								<col className='spec-table-value' />
								<col className='spec-table-source' />
							</colgroup>
							<tbody>
							{items.map((spec) => (
								<tr key={`${group}-${spec.name}-${spec.reference}`}>
									<th scope='row' className='spec-table-name-cell fw-normal'>{spec.name}</th>
									<td className='spec-table-value-cell fw-semibold'>
										{spec.value}
										{spec.unit ? ` ${spec.unit}` : ""}
									</td>
									<td className='spec-table-source-cell small text-muted'>
										{spec.sourceUrl ? (
											<a href={spec.sourceUrl} target='_blank' rel='noopener noreferrer' className='text-muted text-decoration-none'>
												{sourceLabel(spec)}
											</a>
										) : (
											sourceLabel(spec)
										)}
									</td>
								</tr>
							))}
							</tbody>
						</table>
					</div>
				</div>
			))}
			{hasStandard ? (
				<div className='small text-muted'>
					Values marked "Per" a standard come from that standard: strength values are the minimums it sets for this grade
					or class, and dimensions are its limits for this size. They are not a tested rating of this item.
				</div>
			) : null}
		</div>
	);
}
