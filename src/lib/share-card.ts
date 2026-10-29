/**
 * A post's share card: its halftone cover art as the blog shows it in dark
 * mode, with its title, tag and meta line in white, as the 1200 × 630 PNG that
 * og:image points to.
 *
 * Release posts lead with the version number and other posts with the title,
 * at the bottom left, under the EmDash logo and the tag. The motif fades in
 * from the left and sits a little right of centre, away from the text. Its
 * grey and orange dots can still sit behind the text, so a scrim in the
 * cover's background colour darkens a band at the top and the corner behind
 * the text, each only as far as this card needs for its text to reach WCAG
 * contrast.
 */
import type { ContentEntry, InferCollectionData } from "emdash";
import { ART_CELL, ART_GRIDS, halftoneArt } from "./post-art";
import { authorSeparator, formatPostDate, postAuthors, readingMinutes } from "./posts";
import {
	blendDisc,
	blurMask,
	type Canvas,
	createCanvas,
	encodePng,
	fillMask,
	fillMaskGradient,
	fillPath,
	type LinearGradient,
	type Mask,
	type PathCommand,
	parseHex,
	type Rgb,
	WHITE,
} from "./raster";
import { blockHeight, blockOutline, blockWidth, type Face, fitText, loadInter, type TextBlock, type TextStyle } from "./text";

/** What a share card says. Titles like "EmDash 1.3: …" get the release layout. */
export type ShareCard = {
	slug: string;
	/** The pill's label: the first tag's label, or no pill. */
	tag: string | null;
	/** The line under the title. */
	meta: string | null;
} & ({ layout: "release"; version: string; title: string } | { layout: "article"; title: string });

/** The parts of a loaded post that its share card reads. */
type SharedPost = Pick<ContentEntry<InferCollectionData<"posts">>, "id"> & {
	data: Pick<InferCollectionData<"posts">, "title" | "publishedAt" | "content" | "bylines" | "terms">;
};

const RELEASE_TITLE = /^EmDash (\d+\.\d+(?:\.\d+)?):\s+(.+)$/;

const joinMeta = (parts: readonly (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/** The share card for a post loaded with getEmDashEntry, which hydrates its tags and bylines. */
export function shareCardFor(post: SharedPost): ShareCard {
	const terms = post.data.terms?.tag ?? [];
	const card = { slug: post.id, tag: terms[0]?.label ?? null };
	const date = formatPostDate(post.data.publishedAt)?.label;
	const release = RELEASE_TITLE.exec(post.data.title);
	if (release) {
		const minutes = readingMinutes(post.data.content);
		return {
			...card,
			layout: "release",
			version: release[1],
			title: release[2].replace(/^./u, (first) => first.toUpperCase()),
			meta: joinMeta([date, minutes ? `${minutes} min read` : null]),
		};
	}
	const authors = postAuthors(post.data.bylines);
	const names = authors.map((author, index) => authorSeparator(index, authors.length) + author.name).join("");
	return { ...card, layout: "article", title: post.data.title, meta: joinMeta([names, date]) };
}

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING = 72;

/**
 * public/brand/logo-light-text.svg, the logo the site header shows in dark
 * mode, in a 471 × 118 view box: the wordmark's six paths, which are white.
 */
const WORDMARK_PATHS = [
	"M154.762 90V27.4834H194.447V35.8449H164.467V54.0844H192.844V62.2293H164.467V81.6385H194.447V90H154.762Z",
	"M204.172 90V44.4231H213.53V51.4849H213.747C215.697 46.7193 220.332 43.5566 226.311 43.5566C232.593 43.5566 237.185 46.8059 239.005 52.5247H239.222C241.561 46.9792 246.933 43.5566 253.432 43.5566C262.443 43.5566 268.335 49.5353 268.335 58.6767V90H258.934V60.9296C258.934 54.9942 255.771 51.5716 250.226 51.5716C244.68 51.5716 240.825 55.7307 240.825 61.4928V90H231.64V60.2364C231.64 54.9508 228.304 51.5716 223.018 51.5716C217.473 51.5716 213.53 55.9473 213.53 61.8394V90H204.172Z",
	"M279.404 90V27.4834H301.456C319.998 27.4834 331.046 38.8776 331.046 58.5467V58.6334C331.046 78.3892 320.085 90 301.456 90H279.404ZM289.108 81.5951H300.546C313.803 81.5951 321.125 73.4935 321.125 58.72V58.6334C321.125 43.9465 313.716 35.8449 300.546 35.8449H289.108V81.5951Z",
	"M353.379 90.8232C344.281 90.8232 338.172 85.2344 338.172 77.0461V76.9595C338.172 69.0312 344.324 64.1789 355.112 63.529L367.502 62.7925V59.3699C367.502 54.3443 364.253 51.3116 358.448 51.3116C353.032 51.3116 349.696 53.8677 348.916 57.507L348.83 57.8969H339.992L340.035 57.4203C340.685 49.5787 347.487 43.5566 358.708 43.5566C369.842 43.5566 376.904 49.4487 376.904 58.5901V90H367.502V82.8082H367.329C364.686 87.7038 359.401 90.8232 353.379 90.8232ZM347.617 76.8295C347.617 80.8153 350.909 83.3281 355.935 83.3281C362.52 83.3281 367.502 78.8657 367.502 72.9303V69.3778L356.368 70.0709C350.736 70.4175 347.617 72.887 347.617 76.7428V76.8295Z",
	"M403.959 90.9098C392.564 90.9098 385.893 85.2777 384.939 76.9595L384.896 76.5695H394.167L394.254 77.0028C395.121 81.2052 398.24 83.6747 404.002 83.6747C409.634 83.6747 413.013 81.3352 413.013 77.6527V77.6093C413.013 74.6633 411.367 72.9737 406.471 71.8039L399.02 70.1143C390.355 68.1214 386.066 63.9623 386.066 57.3337V57.2903C386.066 49.1454 393.171 43.5566 403.655 43.5566C414.443 43.5566 420.942 49.5787 421.418 57.3337L421.462 57.8536H412.667L412.624 57.5503C412.06 53.5645 408.941 50.7917 403.655 50.7917C398.63 50.7917 395.467 53.1746 395.467 56.8138V56.8571C395.467 59.6732 397.33 61.5794 402.226 62.7492L409.634 64.4388C418.949 66.605 422.501 70.2876 422.501 76.8295V76.8728C422.501 85.191 414.703 90.9098 403.959 90.9098Z",
	"M431.014 90V27.4834H440.372V51.9182H440.588C443.014 46.6326 447.91 43.5566 454.712 43.5566C464.46 43.5566 470.872 50.8351 470.872 61.8394V90H461.514V63.6157C461.514 56.0773 457.701 51.5716 451.116 51.5716C444.661 51.5716 440.372 56.5105 440.372 63.6157V90H431.014Z",
];

/** The same file's mark: its ring and bar, each filled with a linear gradient whose ends are in view box units. */
const MARK_PATHS: readonly {
	d: string;
	from: readonly [number, number];
	to: readonly [number, number];
	stops: readonly (readonly [offset: number, hex: string])[];
}[] = [
	{
		d: "M0.410156 96.5125V21.2097C0.410156 9.48841 9.91245 -0.013916 21.6338 -0.013916V9.40601L21.3291 9.40991C14.9509 9.57133 9.83008 14.7927 9.83008 21.2097V96.5125C9.83008 102.93 14.9509 108.151 21.3291 108.312L21.6338 108.316H96.9365L97.2412 108.312C103.518 108.153 108.577 103.094 108.736 96.8171L108.74 96.5125V21.2097C108.74 14.6909 103.455 9.40601 96.9365 9.40601V-0.013916C108.658 -0.013916 118.16 9.48838 118.16 21.2097V96.5125C118.16 108.234 108.658 117.736 96.9365 117.736H21.6338C9.91248 117.736 0.410156 108.234 0.410156 96.5125ZM96.9365 -0.013916V9.40601H21.6338V-0.013916H96.9365Z",
		from: [-67.1002, 194.666],
		to: [145.514, -65.5554],
		stops: [
			[0, "#0F006B"],
			[0.0833333, "#281A81"],
			[0.166667, "#5D0C83"],
			[0.25, "#911475"],
			[0.333333, "#CE2F55"],
			[0.416667, "#FF6633"],
			[0.5, "#F6821F"],
			[0.583333, "#FBAD41"],
			[0.666667, "#FFCD89"],
			[0.75, "#FFE9CB"],
			[0.833333, "#FFF7EC"],
			[0.916667, "#FFF8EE"],
			[1, "#FFFFFF"],
		],
	},
	{
		d: "M28.6699 53.366H90.4746V63.6668H28.6699V53.366Z",
		from: [144.064, 43.1581],
		to: [44.5609, 85.0447],
		stops: [
			[0, "#FFFFFF"],
			[0.129253, "#FFF8EE"],
			[0.617058, "#FBAD41"],
			[0.848019, "#F6821F"],
			[1, "#FF6633"],
		],
	},
];
const LOGO_VIEWBOX_HEIGHT = 118;
const LOGO_HEIGHT = 43;

/** Absolute M, L, H, V, C and Z commands, which is all the logo uses, scaled and moved to (x, y). */
function svgPath(d: string, x: number, y: number, scale: number): PathCommand[] {
	const tokens = d.match(/[MLHVCZ]|-?[\d.]+/g) ?? [];
	const commands: PathCommand[] = [];
	let i = 0;
	let command = "";
	let penX = 0;
	let penY = 0;
	const nextX = () => x + Number(tokens[i++]) * scale;
	const nextY = () => y + Number(tokens[i++]) * scale;
	while (i < tokens.length) {
		if (/[A-Z]/.test(tokens[i])) command = tokens[i++];
		switch (command) {
			case "M":
			case "L":
				penX = nextX();
				penY = nextY();
				commands.push({ type: command, x: penX, y: penY });
				// Coordinates after a move's first pair are lines.
				command = "L";
				break;
			case "H":
				penX = nextX();
				commands.push({ type: "L", x: penX, y: penY });
				break;
			case "V":
				penY = nextY();
				commands.push({ type: "L", x: penX, y: penY });
				break;
			case "C": {
				const [x1, y1, x2, y2] = [nextX(), nextY(), nextX(), nextY()];
				penX = nextX();
				penY = nextY();
				commands.push({ type: "C", x1, y1, x2, y2, x: penX, y: penY });
				break;
			}
			default:
				commands.push({ type: "Z" });
		}
	}
	return commands;
}

const TAG: TextStyle = { size: 29, tracking: 0, lineHeight: 1 };
const NUMERAL: TextStyle = { size: 180, tracking: -0.065, lineHeight: 0.86 };
const RELEASE_TITLE_STYLE: TextStyle = { size: 43, tracking: -0.012, lineHeight: 1.2 };
const ARTICLE_TITLE_STYLE: TextStyle = { size: 67, tracking: -0.025, lineHeight: 1.08 };
const META: TextStyle = { size: 28, tracking: 0 };

const PILL = {
	paddingX: 25,
	paddingY: 12,
	/** Longer labels are cut short, which keeps the pill well clear of the logo. */
	maxLabelWidth: 480,
	fillOpacity: 0.08,
	ringWidth: 1,
	ringOpacity: 0.2,
};

/** The numeral's optical nudge to the left, so its first digit lines up with the text under it. */
const NUMERAL_NUDGE = -10;
const NUMERAL_GAP = 24;
const META_GAP = 26;

const RELEASE_TITLE_FIT = { maxWidth: 672, maxLines: 2, balance: true };
const ARTICLE_TITLE_FIT = { maxWidth: 792, maxLines: 3, minSize: 50, balance: true };

/*
 * PostCover's dark-mode colours as the browser resolves them from Base.astro
 * and theme.css: --art-bg mixes --color-bg #0a0a0a 40% into --color-surface
 * #171717, and the paper and ink are --color-text at 8% and 50%.
 */
const BACKGROUND = parseHex("#121212");
const INK = parseHex("#f5f5f5");
const ACCENT = parseHex("#ff5e1f");
const PAPER_OPACITY = 0.08;
const INK_OPACITY = 0.5;
/** Radius of the paper dot at the centre of every cell, in art units. */
const PAPER_RADIUS = 0.75;

/**
 * The motif fades in across this share of the width, from transparent to
 * full, as `linear-gradient(90deg, transparent 30%, #000 72%)`.
 */
const MOTIF_FADE = [0.3, 0.72] as const;

/**
 * How many art cells the motif, and its fade, sit right of the hero cover's
 * centred crop, so it keeps clear of the text. A whole number of cells keeps
 * its dots on the paper's lattice.
 */
const MOTIF_SHIFT_CELLS = 6;

const SHADOW_BLUR = 10;
const SHADOW_OPACITY = 0.3;

/**
 * The scrim's shape, in pixels. The band runs across the top behind the
 * wordmark and pill, solid down to `solidTo` and clear from `clearFrom`, and
 * blends from its left strength to its right one between `leftTo` and
 * `rightFrom`.
 * The corner covers the text block, fading in from `above` its top to
 * `below` it, and out from `inside` its right edge to `outside` it.
 */
const SCRIM = {
	band: { solidTo: 130, clearFrom: 330, leftTo: 300, rightFrom: 900 },
	corner: { above: 220, below: 40, inside: 120, outside: 360 },
};

/** The scrim aims this far past each minimum, so sampling and rounding to 8 bits can't tip an element under it. */
const CONTRAST_HEADROOM = 1.03;

/** At most this many pixels of an element are sampled while choosing the scrim. */
const MAX_SAMPLES = 6000;

/** How strongly each part of the scrim is drawn, from 0 to 1: the band's two ends, then the corner. */
interface ScrimStrength {
	bandLeft: number;
	bandRight: number;
	corner: number;
}

/**
 * Each text element's minimum contrast against white, 4.5:1 for normal text
 * and 3:1 for large text, and the part of the scrim behind it. The logo's
 * mark is a brand graphic in its own colours, so it is drawn as is.
 */
const ELEMENTS = {
	wordmark: { minContrast: 4.5, scrim: "bandLeft" },
	tag: { minContrast: 4.5, scrim: "bandRight" },
	numeral: { minContrast: 3, scrim: "corner" },
	title: { minContrast: 3, scrim: "corner" },
	meta: { minContrast: 4.5, scrim: "corner" },
} as const satisfies Record<string, { minContrast: number; scrim: keyof ScrimStrength }>;

type ElementName = keyof typeof ELEMENTS | "mark";

/** What an element is filled with: white, or one of the mark's gradients. */
type Fill = Rgb | LinearGradient;

/** One piece of text, or part of the logo, as the coverage it will be filled through. */
interface CardElement {
	name: ElementName;
	mask: Mask;
	fill: Fill;
}

/** A card drawn up to its text, with the text still to fill. */
interface ShareCardBackdrop {
	/** The art, scrim and pill: what the text's contrast is measured against. */
	canvas: Canvas;
	elements: CardElement[];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = clamp((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
};

/** Each 12-bit sRGB level made linear, as WCAG relative luminance takes it, so sampling needs no powers. */
const LINEAR = Float32Array.from({ length: 4096 }, (_, level) => {
	const c = level / 4095;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const luminance = (r: number, g: number, b: number) =>
	0.2126 * LINEAR[Math.round(clamp(r) * 4095)] + 0.7152 * LINEAR[Math.round(clamp(g) * 4095)] + 0.0722 * LINEAR[Math.round(clamp(b) * 4095)];

/** The 95th percentile of `values`, from 0 to 1, to within a 2048th. */
function percentile95(values: Float32Array) {
	const bins = new Uint32Array(2048);
	for (const value of values) bins[Math.min(2047, Math.floor(value * 2048))]++;
	let seen = 0;
	for (let bin = 0; bin < bins.length; bin++) {
		seen += bins[bin];
		if (seen >= values.length * 0.95) return (bin + 1) / 2048;
	}
	return 1;
}

/**
 * Draw the post's cover art as the blog shows it in dark mode: the paper dot
 * in every cell across the card, then the motif, scaled to cover the card,
 * centred as the post's hero cover is and moved `MOTIF_SHIFT_CELLS` right.
 */
function drawArt(canvas: Canvas, card: ShareCard) {
	const { columns, rows } = ART_GRIDS.hero;
	const art = halftoneArt(card.slug, columns, rows);
	const scale = Math.max(WIDTH / art.width, HEIGHT / art.height);
	const offsetX = (art.width * scale - WIDTH) / 2;
	const offsetY = (art.height * scale - HEIGHT) / 2;
	const toX = (x: number) => x * scale - offsetX;
	const toY = (y: number) => y * scale - offsetY;

	for (let i = 0; i < canvas.pixels.length; i += 3) canvas.pixels.set(BACKGROUND, i);

	// Cells are counted from the card's edges, not the art's, so the paper reaches every edge whatever the art's aspect.
	const firstCell = (offset: number) => Math.floor(offset / scale / ART_CELL) - 1;
	const lastCell = (offset: number, size: number) => Math.ceil((offset + size) / scale / ART_CELL) + 1;
	for (let row = firstCell(offsetY); row <= lastCell(offsetY, HEIGHT); row++) {
		for (let column = firstCell(offsetX); column <= lastCell(offsetX, WIDTH); column++) {
			blendDisc(canvas, toX((column + 0.5) * ART_CELL), toY((row + 0.5) * ART_CELL), PAPER_RADIUS * scale, INK, PAPER_OPACITY);
		}
	}

	const shift = MOTIF_SHIFT_CELLS * ART_CELL * scale;
	const fade = (x: number) => clamp(((x - shift) / WIDTH - MOTIF_FADE[0]) / (MOTIF_FADE[1] - MOTIF_FADE[0]));
	for (const dot of art.dots) {
		const x = toX(dot.cx) + shift;
		const alpha = (dot.accent ? 1 : INK_OPACITY) * fade(x);
		if (alpha > 0 && x - dot.diameter * scale < WIDTH) {
			blendDisc(canvas, x, toY(dot.cy), (dot.diameter / 2) * scale, dot.accent ? ACCENT : INK, alpha);
		}
	}
}

/** A pill: a rectangle with fully rounded ends. */
interface Pill {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** The top and right edges of the text block at the bottom left. */
interface TextBounds {
	top: number;
	right: number;
}

/** An element's glyphs or logo paths, as path commands in pixels, and its fill. */
interface Outline {
	name: ElementName;
	commands: PathCommand[];
	fill: Fill;
}

/** Where everything on the card goes: the text and logo as outlines, the pill, and the text block's bounds. */
function layOut(face: Face, card: ShareCard): { outlines: Outline[]; pill: Pill | null; block: TextBounds } {
	const logoScale = LOGO_HEIGHT / LOGO_VIEWBOX_HEIGHT;
	const toLogo = (at: number) => PADDING + at * logoScale;
	const outlines: Outline[] = [
		{ name: "wordmark", commands: WORDMARK_PATHS.flatMap((d) => svgPath(d, PADDING, PADDING, logoScale)), fill: WHITE },
		...MARK_PATHS.map(({ d, from, to, stops }) => ({
			name: "mark" as const,
			commands: svgPath(d, PADDING, PADDING, logoScale),
			fill: {
				x1: toLogo(from[0]),
				y1: toLogo(from[1]),
				x2: toLogo(to[0]),
				y2: toLogo(to[1]),
				stops: stops.map(([offset, hex]) => ({ offset, color: parseHex(hex) })),
			},
		})),
	];

	let pill: Pill | null = null;
	if (card.tag) {
		const label = fitText(face, card.tag, TAG, { maxWidth: PILL.maxLabelWidth, maxLines: 1 });
		const height = blockHeight(face, label) + 2 * PILL.paddingY;
		const top = PADDING + LOGO_HEIGHT / 2 - height / 2;
		const right = WIDTH - PADDING;
		pill = { left: right - blockWidth(face, label) - 2 * PILL.paddingX, right, top, bottom: top + height };
		outlines.push({ name: "tag", commands: blockOutline(face, label, pill.left + PILL.paddingX, top + PILL.paddingY), fill: WHITE });
	}

	// The block is stacked up from the bottom padding, last line first.
	let bottom = HEIGHT - PADDING;
	let right = PADDING;
	const place = (name: ElementName, block: TextBlock, x: number, gapAbove: number) => {
		const top = bottom - blockHeight(face, block);
		outlines.push({ name, commands: blockOutline(face, block, x, top), fill: WHITE });
		right = Math.max(right, x + blockWidth(face, block));
		bottom = top - gapAbove;
		return top;
	};
	if (card.meta) place("meta", fitText(face, card.meta, META, { maxWidth: WIDTH - 2 * PADDING, maxLines: 1 }), PADDING, META_GAP);
	let top: number;
	if (card.layout === "release") {
		place("title", fitText(face, card.title, RELEASE_TITLE_STYLE, RELEASE_TITLE_FIT), PADDING, NUMERAL_GAP);
		top = place("numeral", { lines: [card.version], style: NUMERAL }, PADDING + NUMERAL_NUDGE, 0);
	} else {
		top = place("title", fitText(face, card.title, ARTICLE_TITLE_STYLE, ARTICLE_TITLE_FIT), PADDING, 0);
	}
	return { outlines, pill, block: { top, right } };
}

/** Paints everything between the art and the text over one pixel: the scrim, then the pill. */
type BackdropPainter = (pixels: Float32Array, i: number, x: number, y: number, strength: ScrimStrength) => void;

function backdropPainter(pill: Pill | null, block: TextBounds): BackdropPainter {
	const { band, corner } = SCRIM;
	const scrimAlpha = (x: number, y: number, strength: ScrimStrength) => {
		const toRight = smoothstep(band.leftTo, band.rightFrom, x);
		const inBand =
			(strength.bandLeft + (strength.bandRight - strength.bandLeft) * toRight) * (1 - smoothstep(band.solidTo, band.clearFrom, y));
		const inCorner =
			strength.corner *
			smoothstep(block.top - corner.above, block.top + corner.below, y) *
			(1 - smoothstep(block.right - corner.inside, block.right + corner.outside, x));
		return 1 - (1 - inBand) * (1 - inCorner);
	};
	/** Signed distance from the pill's edge, negative inside. */
	const pillEdge = (x: number, y: number) => {
		if (!pill || y < pill.top - 1 || y > pill.bottom + 1 || x < pill.left - 1 || x > pill.right + 1) return Infinity;
		const radius = (pill.bottom - pill.top) / 2;
		const along = Math.min(pill.right - radius, Math.max(pill.left + radius, x));
		return Math.hypot(x - along, y - pill.top - radius) - radius;
	};
	return (pixels, i, x, y, strength) => {
		const scrim = scrimAlpha(x + 0.5, y + 0.5, strength);
		const edge = pillEdge(x + 0.5, y + 0.5);
		const fill = clamp(0.5 - edge) * PILL.fillOpacity;
		const ring = (clamp(0.5 - edge) - clamp(0.5 - edge - PILL.ringWidth)) * PILL.ringOpacity;
		for (let c = i; c < i + 3; c++) {
			let value = pixels[c] + (BACKGROUND[c - i] - pixels[c]) * scrim;
			value += (INK[c - i] - value) * fill;
			pixels[c] = value + (INK[c - i] - value) * ring;
		}
	};
}

/** Up to MAX_SAMPLES of the pixels a mask covers by more than half, spread evenly, as pixel indices. */
function coveredPixels(mask: Mask) {
	const covered: number[] = [];
	for (let row = 0; row < mask.height; row++) {
		const y = mask.y + row;
		for (let column = 0; column < mask.width; column++) {
			const x = mask.x + column;
			if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && mask.alpha[row * mask.width + column] > 0.5) covered.push(y * WIDTH + x);
		}
	}
	const stride = Math.max(1, Math.ceil(covered.length / MAX_SAMPLES));
	return covered.filter((_, index) => index % stride === 0);
}

/** White's contrast against the 95th percentile luminance of `pixels` of the art once the backdrop is painted over them. */
function contrastOver(art: Canvas, pixels: readonly number[], paint: BackdropPainter, strength: ScrimStrength) {
	const pixel = new Float32Array(3);
	const levels = new Float32Array(pixels.length);
	pixels.forEach((p, s) => {
		pixel.set(art.pixels.subarray(p * 3, p * 3 + 3));
		paint(pixel, 0, p % WIDTH, Math.floor(p / WIDTH), strength);
		levels[s] = luminance(pixel[0], pixel[1], pixel[2]);
	});
	return 1.05 / (percentile95(levels) + 0.05);
}

/** The lightest strength from 0 to 1 at which `passes` holds, to within a 1024th, or 1 if it never does. */
function lightest(passes: (strength: number) => boolean) {
	if (passes(0)) return 0;
	let low = 0;
	let high = 1;
	while (high - low > 1 / 1024) {
		const mid = (low + high) / 2;
		if (passes(mid)) high = mid;
		else low = mid;
	}
	return high;
}

/**
 * Draw a card up to its text. Each part of the scrim, in turn, is set to the
 * lightest strength at which the elements in front of it reach their
 * minimum contrast, measured as the 95th percentile luminance of the pixels
 * each element covers by more than half.
 */
async function drawShareCardBackdrop(card: ShareCard): Promise<ShareCardBackdrop> {
	const face = await loadInter();
	const { outlines, pill, block } = layOut(face, card);
	const canvas = createCanvas(WIDTH, HEIGHT);
	drawArt(canvas, card);
	const elements = outlines.map(({ name, commands, fill }) => ({ name, mask: fillPath(commands), fill }));

	const paint = backdropPainter(pill, block);
	const measured = elements.flatMap(({ name, mask }) => (name === "mark" ? [] : [{ ...ELEMENTS[name], pixels: coveredPixels(mask) }]));
	const reaches = (part: keyof ScrimStrength, strength: ScrimStrength) =>
		measured.every(
			({ scrim: behind, minContrast, pixels }) =>
				behind !== part || contrastOver(canvas, pixels, paint, strength) >= minContrast * CONTRAST_HEADROOM,
		);
	const scrim: ScrimStrength = { bandLeft: 0, bandRight: 0, corner: 0 };
	for (const part of ["bandLeft", "bandRight", "corner"] as const) {
		scrim[part] = lightest((strength) => reaches(part, { ...scrim, [part]: strength }));
	}

	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) paint(canvas.pixels, (y * WIDTH + x) * 3, x, y, scrim);
	}
	return { canvas, elements };
}

/** Render a share card as a 1200 × 630 PNG. */
export async function shareCardPng(card: ShareCard) {
	const { canvas, elements } = await drawShareCardBackdrop(card);
	for (const { mask } of elements) fillMask(canvas, blurMask(mask, SHADOW_BLUR), BACKGROUND, SHADOW_OPACITY);
	for (const { mask, fill } of elements) {
		if ("stops" in fill) fillMaskGradient(canvas, mask, fill);
		else fillMask(canvas, mask, fill);
	}
	return encodePng(canvas);
}
