/**
 * Colour for generated post art: a palette gradient behind the halftone
 * motif, and the film grain on top.
 *
 * A gradient is a vertical base, interpolated in oklab, under four large soft
 * blobs of colour. A post's slug picks its palette (changelog posts draw from
 * the two orange ones) and seeds where the blobs sit, so a post always gets
 * the same colours and composition. ./share-card.ts draws it behind the
 * post's share card.
 */
import { hash, random } from "./post-art";

export type PaletteKey = "sunset" | "kiln" | "heat" | "dusk" | "afterglow" | "midnight" | "tide" | "moss";

type Hex = `#${string}`;

interface Palette {
	/** Base gradient stops, top to bottom: colour and position as a percentage of the height. */
	base: readonly (readonly [color: Hex, at: number])[];
	/** Colour, centre as percentages of the width and height, and diameter as a percentage of the width. */
	blobs: readonly (readonly [color: Hex, x: number, y: number, diameter: number])[];
}

/**
 * Each palette keeps to neighbouring hues, light and slightly cool at the top
 * and dark and warm at the bottom.
 */
const PALETTES: Record<PaletteKey, Palette> = {
	sunset: {
		base: [["#FFE7C8", 0], ["#F99A52", 36], ["#D6406A", 64], ["#2B1272", 100]],
		blobs: [["#FFF6EA", 56, -6, 96], ["#FBAD41", 4, 40, 62], ["#FF6633", 96, 56, 64], ["#3A0D78", 30, 108, 94]],
	},
	kiln: {
		base: [["#FFF3E5", 0], ["#FFC888", 44], ["#E8742A", 74], ["#8E3209", 100]],
		blobs: [["#FFF8F0", 60, -6, 96], ["#FFCD89", 2, 42, 62], ["#F6821F", 94, 72, 68], ["#7A2806", 24, 110, 88]],
	},
	heat: {
		base: [["#ECE7F0", 0], ["#F6A866", 42], ["#E2531C", 72], ["#561807", 100]],
		blobs: [["#F1ECF4", 48, -6, 96], ["#FBAD41", 6, 50, 60], ["#FA5D19", 92, 70, 70], ["#451205", 30, 110, 90]],
	},
	dusk: {
		base: [["#EEE6F4", 0], ["#EE9CAF", 40], ["#C3345F", 70], ["#310A3E", 100]],
		blobs: [["#F4EDF8", 30, -6, 96], ["#FF8C6E", 95, 48, 56], ["#CE2F55", 10, 72, 66], ["#22062C", 70, 110, 90]],
	},
	afterglow: {
		base: [["#E0DAF1", 0], ["#B3649F", 42], ["#5C1A7D", 72], ["#11093C", 100]],
		blobs: [["#E8E3F5", 50, -6, 96], ["#E2507A", 95, 56, 54], ["#911475", 8, 62, 66], ["#0F006B", 62, 112, 92]],
	},
	midnight: {
		base: [["#CBC4E8", 0], ["#7758B6", 42], ["#2C1660", 72], ["#0A0720", 100]],
		blobs: [["#D5CFEE", 26, -6, 90], ["#B7579F", 95, 46, 50], ["#4B1F8A", 16, 66, 70], ["#07051A", 72, 112, 94]],
	},
	tide: {
		base: [["#E3E9EF", 0], ["#88B0C1", 42], ["#2D6B85", 72], ["#0B2332", 100]],
		blobs: [["#EBF1F5", 50, -6, 96], ["#A6D1C9", 2, 50, 60], ["#2F6F8C", 94, 72, 70], ["#081B27", 28, 110, 92]],
	},
	moss: {
		base: [["#E2E8E3", 0], ["#AABD87", 42], ["#557A36", 72], ["#17220E", 100]],
		blobs: [["#E9EFEA", 58, -6, 96], ["#D3D18A", 4, 46, 60], ["#4F7F35", 92, 68, 68], ["#111B0B", 30, 110, 92]],
	},
};

/** Palettes for posts tagged `changelog`. */
const CHANGELOG_PALETTES: readonly PaletteKey[] = ["heat", "kiln"];
/** Palettes for every other post. */
const POST_PALETTES: readonly PaletteKey[] = ["sunset", "dusk", "afterglow", "midnight", "tide", "moss"];

/**
 * A blob's opacity by distance from its centre: `[distance / radius, opacity]`,
 * linear between entries. Solid in the middle and gone at the radius.
 */
export const BLOB_FALLOFF = [
	[0, 1],
	[0.18, 0.86],
	[0.38, 0.6],
	[0.58, 0.31],
	[0.79, 0.1],
	[1, 0],
] as const;

/** A stop of the base gradient, as `#rrggbb` at a position from 0 (top) to 1 (bottom). */
export interface GradientStop {
	offset: number;
	color: string;
}

/** A blob in art units: centre, radius, and `#rrggbb` colour. */
export interface GradientBlob {
	cx: number;
	cy: number;
	r: number;
	color: string;
}

export interface CoverGradient {
	palette: PaletteKey;
	/** The base gradient as sRGB stops: interpolating between them in sRGB matches the palette's oklab gradient. */
	stops: GradientStop[];
	/** Painted over the base in order, each fading out by BLOB_FALLOFF. */
	blobs: GradientBlob[];
}

/** The resolved base gradient has a stop every 1/BASE_STEPS of the height, as well as the palette's own. */
const BASE_STEPS = 16;

type Rgb = readonly [number, number, number];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

const parseHex = (hex: string): Rgb => [
	Number.parseInt(hex.slice(1, 3), 16) / 255,
	Number.parseInt(hex.slice(3, 5), 16) / 255,
	Number.parseInt(hex.slice(5, 7), 16) / 255,
];

const toHex = (rgb: Rgb) =>
	`#${rgb.map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, "0")).join("")}`;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB to OKLab, with Björn Ottosson's matrices. */
function toOklab(rgb: Rgb): Rgb {
	const [r, g, b] = rgb.map(toLinear);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function fromOklab([lightness, a, b]: Rgb): Rgb {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	];
}

/**
 * Resolve `linear-gradient(to bottom in oklab, …)` into sRGB stops: every
 * 1/16 of the height, plus the palette's own stops, where the gradient bends.
 */
function resolveBase(base: Palette["base"]): GradientStop[] {
	const stops = base.map(([color, at]) => ({ offset: at / 100, lab: toOklab(parseHex(color)) }));
	const offsets = new Set([...Array.from({ length: BASE_STEPS + 1 }, (_, i) => i / BASE_STEPS), ...stops.map((stop) => stop.offset)]);
	return [...offsets]
		.sort((a, b) => a - b)
		.map((offset) => {
			const end = Math.max(1, stops.findIndex((stop) => stop.offset >= offset));
			const from = stops[end - 1];
			const to = stops[end];
			const t = (offset - from.offset) / (to.offset - from.offset);
			const mix = (i: number) => from.lab[i] + (to.lab[i] - from.lab[i]) * t;
			return { offset: round(offset, 4), color: toHex(fromOklab([mix(0), mix(1), mix(2)])) };
		});
}

/**
 * The gradient behind a post's cover art, for art `width` by `height` units.
 * `tags` are the post's tag slugs.
 *
 * Blobs are laid out from the palette's positions, mirrored for half the
 * posts and nudged per post, in proportion to the art's size, so every
 * variant of one post shows the same composition.
 */
export function coverGradient(slug: string, tags: readonly string[], width: number, height: number): CoverGradient {
	const family = tags.includes("changelog") ? CHANGELOG_PALETTES : POST_PALETTES;
	const key = family[hash(`color:${slug}`) % family.length];
	const palette = PALETTES[key];
	const rand = random(hash(`blobs:${slug}`));
	const mirror = rand() < 0.5;
	const blobs = palette.blobs.map(([color, x, y, diameter]) => {
		const left = (mirror ? 100 - x : x) + (rand() - 0.5) * 12;
		const top = y + (rand() - 0.5) * 8;
		const size = diameter * (0.92 + rand() * 0.16);
		return {
			cx: round((left / 100) * width, 2),
			cy: round((top / 100) * height, 2),
			r: round((size / 200) * width, 2),
			color: color.toLowerCase(),
		};
	});
	return { palette: key, stops: resolveBase(palette.base), blobs };
}

/** Grain tile size in texels. Covers show one texel per device pixel. */
export const GRAIN_TILE = 128;

/** Opacity of the grain's overlay blend. */
export const GRAIN_OPACITY = 0.4;

/**
 * Standard deviation of the grain, as a share of the full range. Through the
 * overlay blend this gives mid-tones about 8 levels of grain, as subtle as
 * ElevenLabs' covers.
 */
const GRAIN_SPREAD = 0.12;

/**
 * A `GRAIN_TILE` square of grey levels: Gaussian noise around mid-grey, which
 * the overlay blend leaves unchanged. Seeded, so it is the same every time.
 */
export function grainTile() {
	const rand = random(hash("grain"));
	const tile = new Uint8Array(GRAIN_TILE * GRAIN_TILE);
	const level = (value: number) => Math.min(255, Math.max(0, Math.round(127.5 + value * GRAIN_SPREAD * 255)));
	for (let i = 0; i < tile.length; i += 2) {
		// Box-Muller: two uniform samples give two independent normal ones.
		const radius = Math.sqrt(-2 * Math.log(1 - rand()));
		const angle = 2 * Math.PI * rand();
		tile[i] = level(radius * Math.cos(angle));
		tile[i + 1] = level(radius * Math.sin(angle));
	}
	return tile;
}
