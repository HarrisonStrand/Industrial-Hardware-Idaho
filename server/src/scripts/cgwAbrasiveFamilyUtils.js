function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value = '') {
  return clean(value).toLowerCase();
}

function slugify(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitle(value = '') {
  return clean(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((item) => clean(item)))];
}

function getPartNumber(product = {}) {
  return clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || '');
}

function getDescription(product = {}) {
  return clean(product?.fishbowl?.description || product?.description || product?.title || '');
}

function parseFraction(value = '') {
  const raw = clean(value).replace(/[”"]/g, '').replace(/\s+/g, '');
  if (!raw) return NaN;
  const mixed = raw.match(/^(\d+)[- ](\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = raw.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeDimensionToken(value = '') {
  return clean(value)
    .replace(/[”]/g, '"')
    .replace(/\s*"$/g, '')
    .replace(/^0+\./, '.')
    .replace(/\.0+$/, '')
    .replace(/^(\d+)\s+(\d+\/\d+)$/, '$1-$2');
}

function normalizeSizeText(value = '') {
  return clean(value)
    .replace(/[×]/g, 'x')
    .replace(/\s*[xX]\s*/g, ' x ')
    .replace(/\s+/g, ' ')
    .replace(/[”]/g, '"')
    .trim();
}

function compareDimension(a = '', b = '') {
  const an = parseFraction(a);
  const bn = parseFraction(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

const SUBCATEGORY_RULES = [
  {
    subcategory: 'cut-off wheels',
    familyType: 'cut-off wheel',
    familyTitleBase: 'Cut-Off Wheel',
    productKind: 'cut-off-wheel',
    regex: /\b(cut\s*-?\s*off|cutoff|cut\s+off|cutting\s+wheel|zip\s*cut|zipcut)\b/i,
  },
  {
    subcategory: 'flap wheels',
    familyType: 'flap wheel',
    familyTitleBase: 'Flap Wheel',
    productKind: 'flap-wheel',
    regex: /\bflap\b/i,
  },
  {
    subcategory: 'fibre discs',
    familyType: 'fibre disc',
    familyTitleBase: 'Fibre Disc',
    productKind: 'fibre-disc',
    regex: /\b(fibre|fiber|resin\s+fiber|resin\s+fibre)\b.*\bdisc\b|\bdisc\b.*\b(fibre|fiber)\b/i,
  },
  {
    subcategory: 'velcro discs',
    familyType: 'velcro disc',
    familyTitleBase: 'Velcro Disc',
    productKind: 'velcro-disc',
    regex: /\b(velcro|hook\s*(?:&|and)?\s*loop|h\s*&\s*l|h\/?l|hookit|hook-it)\b/i,
  },
  {
    subcategory: 'twist lock discs',
    familyType: 'twist lock disc',
    familyTitleBase: 'Twist Lock Disc',
    productKind: 'twist-lock-disc',
    regex: /\b(twist\s*lock|quick\s*change|quickchange|roloc|roll-?on|type\s*[rs]\b|t[rs]\s+disc)\b/i,
  },
  {
    subcategory: 'grinding wheels',
    familyType: 'grinding wheel',
    familyTitleBase: 'Grinding Wheel',
    productKind: 'grinding-wheel',
    regex: /\b(grinding\s*w(?:heel|hl)|grind\s*w(?:heel|hl)|bench\s*w(?:heel|hl)|depressed\s*center|cup\s*w(?:heel|hl))\b/i,
  },
  {
    subcategory: 'shop rolls',
    familyType: 'shop roll',
    familyTitleBase: 'Shop Roll',
    productKind: 'shop-roll',
    regex: /\b(shop\s*roll|emery\s*roll|cloth\s*roll|utility\s*roll|roll\s+abrasive)\b/i,
  },
  {
    subcategory: 'hand pads',
    familyType: 'hand pad',
    familyTitleBase: 'Hand Pad',
    productKind: 'hand-pad',
    regex: /\b(hand\s*pad|surface\s*conditioning\s*pad|non\s*woven\s*pad|scuff\s*pad|maroon\s*pad|gray\s*pad|grey\s*pad)\b/i,
  },
];

function detectSubcategory({ part = '', description = '' } = {}) {
  const text = `${part} ${description}`;
  return SUBCATEGORY_RULES.find((rule) => rule.regex.test(text)) || null;
}

function isClearlyNotRequestedCGWAbrasive({ part = '', description = '' } = {}) {
  const text = `${part} ${description}`.toUpperCase();

  // These showed up because their descriptions contain broad terms like
  // "quick change" or "cut-off", but they are tools/accessories rather than
  // the starting abrasive families we are intentionally categorizing.
  if (/\b(AUVECO|DEWALT|MAKITA|STANLEY)\b/.test(text)) return true;
  if (/\b(UTILITY\s+KNIFE|RET\s+KNF|KNIFE|SHANK|MANDREL|HOLDER)\b/.test(text)) return true;
  if (/\b(ANGLE\s+GRINDER|GRINDER\s+KIT|CUT\s*-?\s*OFF\s+SAW|SAW\s+KIT|TOOL\s+ONLY|BATTERY|CHARGER)\b/.test(text)) return true;

  return false;
}

function parseGrit({ part = '', description = '' } = {}) {
  const text = `${part} ${description}`.toUpperCase();

  const direct = text.match(/\b(?:P)?(\d{2,4})\s*(?:GRIT|GRT|GR|G)\b/);
  if (direct) return direct[1];

  const compact = text.match(/\b(?:A|AO|WA|WAO|Z|ZA|ZIRC|C|SC|GC|CER|CERAMIC)(\d{2,3})(?:[A-Z]{1,4})?\b/);
  if (compact) return compact[1];

  const gritPrefix = text.match(/\bP(\d{2,4})\b/);
  if (gritPrefix) return gritPrefix[1];

  // Roloc/twist-lock descriptions sometimes omit the trailing G.
  // Examples: ROLOC DISC 3" 60, TWIST LOCK 2" 120.
  const discDiameterThenBareGrit = text.match(/\b(?:ROLOC|TWIST\s*LOCK|VELCRO|HOOK\s*(?:&|AND)?\s*LOOP)\b.*?\b\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?\s*(?:"|IN)?\s+(\d{2,3})(?!\d)\b/);
  if (discDiameterThenBareGrit) return discDiameterThenBareGrit[1];

  const discTrailing = text.match(/\b(?:ROLOC|TWIST\s*LOCK|VELCRO|HOOK\s*(?:&|AND)?\s*LOOP)\b.*?\b(?:\d+(?:-\d+\/\d+|\/\d+)?\s*(?:IN|"))?\s+(\d{2,3})\b/);
  if (discTrailing) return discTrailing[1];

  if (/\b(?:7447|77447)\b/.test(text) || /\bGP\s+HAND\s*PAD\b/.test(text)) return 'maroon';

  if (/\bULTRA\s+FINE\b/.test(text)) return 'ultra fine';
  if (/\bVERY\s+FINE\b/.test(text)) return 'very fine';
  if (/\bMED(?:IUM)?\b/.test(text)) return 'medium';
  if (/\bCOARSE\b/.test(text)) return 'coarse';

  // Hand pads / surface conditioning products often use color rather than numeric grit.
  if (/\bMAROON\b/.test(text)) return 'maroon';
  if (/\b(?:GRAY|GREY)\b/.test(text)) return 'gray';
  if (/\bWHITE\b/.test(text)) return 'white';
  if (/\bTAN\b/.test(text)) return 'tan';
  if (/\bGREEN\b/.test(text)) return 'green';
  if (/\bBLACK\b/.test(text)) return 'black';
  if (/\bRED\b/.test(text)) return 'red';
  if (/\bBROWN\b/.test(text)) return 'brown';
  if (/\bBLUE\b/.test(text)) return 'blue';

  return '';
}

function parseAbrasiveMaterial({ part = '', description = '' } = {}) {
  const text = `${part} ${description}`.toUpperCase();
  if (/\b(CERAMIC|CER)\b/.test(text)) return 'ceramic';
  if (/\b(ZIRC|ZIRCONIA|ZA|ZA\d|Z\d{2,3})\b/.test(text)) return 'zirconia alumina';
  if (/\b(SILICON\s*CARBIDE|SIC|SC\d|GC\d|\bC\d{2,3})\b/.test(text)) return 'silicon carbide';
  if (/\b(ALUMINUM\s*OXIDE|ALUM\s*OXIDE|ALUM|A\/O|AO\b|WA\b|WAO\b|\bA\d{2,3}[A-Z]?\b)\b/.test(text)) return 'aluminum oxide';
  return '';
}

function parseWheelType({ description = '' } = {}) {
  const text = description.toUpperCase();
  const type = text.match(/\bT(?:YPE)?\s*-?\s*(\d{1,2})\b/);
  if (type) return `type ${type[1]}`;
  if (/\bDEPRESSED\s*CENTER\b/.test(text)) return 'type 27';
  return '';
}

function parseAttachment({ part = '', description = '' } = {}) {
  const text = `${part} ${description}`.toUpperCase();
  if (/\bVELCRO\b|\bHOOK\s*(?:&|AND)?\s*LOOP\b|\bH\s*&\s*L\b|\bH\/?L\b/.test(text)) return 'hook and loop';
  if (/\bTWIST\s*LOCK\b|\bROLOC\b|\bQUICK\s*CHANGE\b|\bQUICKCHANGE\b/.test(text)) return 'twist lock';
  if (/\bPSA\b|\bPRESSURE\s*SENSITIVE\b/.test(text)) return 'psa';
  return '';
}

function parseShape({ description = '' } = {}) {
  const text = description.toUpperCase();
  if (/\bDISC\b|\bDISK\b/.test(text)) return 'disc';
  if (/\bWHEEL\b|\bWHL\b/.test(text)) return 'wheel';
  if (/\bROLL\b/.test(text)) return 'roll';
  if (/\bPAD\b/.test(text)) return 'pad';
  return '';
}

function parseSize({ description = '' } = {}) {
  const text = clean(description)
    .replace(/[×]/g, 'x')
    .replace(/[”]/g, '"')
    .replace(/\bDIA\b/gi, '')
    .replace(/\s+/g, ' ');

  // Examples: 4-1/2X.045X7/8, 4-1/2X.045X5/8-11, 4 1/2 x 1/8 x 7/8, 2 X 72, 6X9.
  const dimensionToken = String.raw`(?:\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?(?:-\d+)?|\.\d+)`;
  const sizeMatch = text.match(new RegExp(`(${dimensionToken})\\s*(?:"|IN)?\\s*[xX]\\s*(${dimensionToken})(?:\\s*(?:"|IN)?\\s*[xX]\\s*(${dimensionToken})(?:\\s*(?:MM|M)\\b)?)?`, 'i'));
  if (sizeMatch) {
    const first = normalizeDimensionToken(sizeMatch[1]);
    const second = normalizeDimensionToken(sizeMatch[2]);
    const third = normalizeDimensionToken(sizeMatch[3] || '');
    const size = normalizeSizeText([first, second, third].filter(Boolean).join(' x '));

    // For wheels/discs, first is diameter, second is usually thickness/width, third is arbor.
    return {
      size,
      diameter: first,
      thickness: third ? second : '',
      width: third ? '' : second,
      arbor: third || '',
      length: '',
    };
  }

  // Single-diameter products: ROLOC DISC 2" 80G, TWIST LOCK 3" 120G, VELCRO DISC 2" MED.
  const singleDiameter = text.match(/\b(?:ROLOC|TWIST\s*LOCK|VELCRO|HOOK\s*(?:&|AND)?\s*LOOP|BUFF\s+DISC|FLAP\s+DISC|DISC)\b[^\d]*(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)\s*(?:"|IN)?/i);
  if (singleDiameter) {
    const diameter = normalizeDimensionToken(singleDiameter[1]);
    return {
      size: diameter,
      diameter,
      width: '',
      thickness: '',
      arbor: '',
      length: '',
    };
  }

  // Hand pads are commonly 6 x 9 even when not all details are in the current field.
  if (/\bHAND\s*PAD\b/i.test(text)) {
    const handPadSize = text.match(/(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)\s*(?:"|IN)?\s*[xX]\s*(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)/);
    if (handPadSize) {
      const first = normalizeDimensionToken(handPadSize[1]);
      const second = normalizeDimensionToken(handPadSize[2]);
      return { size: normalizeSizeText(`${first} x ${second}`), diameter: '', width: second, thickness: '', arbor: '', length: first };
    }

    // 7447 general-purpose hand pads are stocked as the common 6 x 9 pad when size is omitted.
    if (/\b7447\b|\bGP\b/i.test(text)) {
      return { size: '6 x 9', diameter: '', width: '9', thickness: '', arbor: '', length: '6' };
    }
  }

  return { size: '', diameter: '', width: '', thickness: '', arbor: '', length: '' };
}

function inferGrade({ abrasiveMaterial = '', description = '' } = {}) {
  const text = description.toUpperCase();
  if (/\bPREMIUM\b/.test(text)) return 'premium';
  if (/\bPRO\b/.test(text)) return 'professional';
  if (abrasiveMaterial) return abrasiveMaterial;
  return '';
}

function buildTitle(parsed = {}) {
  const bits = [];
  if (parsed.size) bits.push(parsed.size);
  bits.push(parsed.familyTitleBase || toTitle(parsed.familyType || 'Abrasive'));
  if (parsed.grit && !/^(maroon|gray|grey|white|tan|green|black|red|brown|blue|coarse|medium|very fine|ultra fine)$/i.test(parsed.grit)) bits.push(`${parsed.grit} Grit`);
  if (parsed.grit && /^(maroon|gray|grey|white|tan|green|black|red|brown|blue|coarse|medium|very fine|ultra fine)$/i.test(parsed.grit)) bits.push(toTitle(parsed.grit));
  if (parsed.abrasiveMaterial) bits.push(toTitle(parsed.abrasiveMaterial));
  if (parsed.wheelType) bits.push(toTitle(parsed.wheelType));
  if (parsed.attachment && !parsed.familyType?.includes('twist lock') && !parsed.familyType?.includes('velcro')) bits.push(toTitle(parsed.attachment));
  return clean(bits.filter(Boolean).join(' - '));
}

function buildDescription(parsed = {}) {
  const details = [];
  if (parsed.size) details.push(`Size: ${parsed.size}`);
  if (parsed.grit) details.push(`Grit: ${parsed.grit}`);
  if (parsed.abrasiveMaterial) details.push(`Abrasive: ${toTitle(parsed.abrasiveMaterial)}`);
  if (parsed.attachment) details.push(`Attachment: ${toTitle(parsed.attachment)}`);
  if (parsed.wheelType) details.push(`Wheel type: ${toTitle(parsed.wheelType)}`);

  return clean(`${parsed.websiteBrand || 'CGW'} ${parsed.familyTitleBase || toTitle(parsed.familyType || 'abrasive product')} for industrial cutting, grinding, finishing, and surface preparation.${details.length ? ` ${details.join('. ')}.` : ''}`);
}

function buildBulletPoints(parsed = {}) {
  const points = [];
  points.push(`${parsed.websiteBrand || 'CGW'} ${parsed.familyTitleBase || toTitle(parsed.familyType || 'abrasive product')}`);
  if (parsed.size) points.push(`Size: ${parsed.size}`);
  if (parsed.grit) points.push(`Grit/color: ${parsed.grit}`);
  if (parsed.abrasiveMaterial) points.push(`Abrasive material: ${toTitle(parsed.abrasiveMaterial)}`);
  if (parsed.attachment) points.push(`Attachment style: ${toTitle(parsed.attachment)}`);
  return uniqueStrings(points).slice(0, 5);
}

function buildTags(parsed = {}) {
  return uniqueStrings([
    'abrasives',
    'CGW',
    parsed.subcategory,
    parsed.familyType,
    parsed.productKind,
    parsed.grit ? `${parsed.grit} grit` : '',
    parsed.abrasiveMaterial,
    parsed.attachment,
    parsed.wheelType,
  ]).map((item) => normalize(item));
}

function buildSeoSlug(parsed = {}, partNumber = '') {
  return slugify(['cgw', parsed.familyType, parsed.size, parsed.grit, partNumber].filter(Boolean).join(' '));
}

function detectCGWAbrasiveProduct(product = {}) {
  const partNumber = getPartNumber(product);
  const description = getDescription(product);
  const brandText = clean(`${product?.brand || ''} ${product?.vendor || ''} ${product?.fishbowl?.raw?.brand || ''}`);
  if (isClearlyNotRequestedCGWAbrasive({ part: partNumber, description })) return null;
  const allText = `${partNumber} ${description} ${brandText}`;

  const isCGW = /\bCGW\b|CAMEL\s+GRINDING|CAMEL\s+WHEEL/i.test(allText);
  const rule = detectSubcategory({ part: partNumber, description });
  if (!isCGW && !rule) return null;
  if (!rule) return null;

  const sizeInfo = parseSize({ description });
  const abrasiveMaterial = parseAbrasiveMaterial({ part: partNumber, description });
  const grit = parseGrit({ part: partNumber, description });
  const attachment = parseAttachment({ part: partNumber, description }) || (rule.productKind === 'twist-lock-disc' ? 'twist lock' : rule.productKind === 'velcro-disc' ? 'hook and loop' : '');
  const wheelType = parseWheelType({ description });
  const shape = parseShape({ description }) || rule.familyType.split(' ').at(-1) || '';

  const parsed = {
    category: 'abrasives',
    subcategory: rule.subcategory,
    productKind: rule.productKind,
    familyType: rule.familyType,
    fastenerType: rule.familyType,
    familyTitleBase: rule.familyTitleBase,
    websiteBrand: 'CGW',
    websiteVendor: 'CGW',
    measurementSystem: 'imperial',
    size: sizeInfo.size,
    diameter: sizeInfo.diameter,
    width: sizeInfo.width,
    thickness: sizeInfo.thickness,
    arbor: sizeInfo.arbor,
    length: sizeInfo.length,
    grit,
    abrasiveMaterial,
    material: abrasiveMaterial || 'abrasive',
    finish: '',
    materialFinish: abrasiveMaterial || 'abrasive',
    grade: inferGrade({ abrasiveMaterial, description }),
    attachment,
    wheelType,
    shape,
    title: '',
    shortTitle: '',
  };

  parsed.title = buildTitle(parsed);
  parsed.shortTitle = parsed.title;
  return parsed;
}

export {
  buildBulletPoints,
  buildDescription,
  buildSeoSlug,
  buildTags,
  clean,
  compareDimension,
  detectCGWAbrasiveProduct,
  isClearlyNotRequestedCGWAbrasive,
  normalize,
  slugify,
  toTitle,
  uniqueStrings,
};
