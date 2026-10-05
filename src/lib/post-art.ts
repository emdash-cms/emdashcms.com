/**
 * Generated halftone cover art for posts without a featured image.
 *
 * A post's slug seeds one of ten motifs: flowing waves, ripples, the em dash,
 * a shaded sphere, lines of text with a caret, a waveform, a braid of three
 * strands, stacked layers, a sun on the horizon, or weeks on a calendar. The
 * motif is sampled on a dot grid; each sample's intensity sets the dot size,
 * and one part of each motif is drawn in the brand orange. Dots of one size
 * and tone are drawn as a single path of zero-length round-capped segments,
 * so a cover is a handful of path strings rather than hundreds of elements.
 *
 * The output depends only on the seed and grid size, so a post always gets the
 * same motif, and its card and page show the same composition at their own
 * grid sizes.
 */

/**
 * Bump when the art changes. Share image URLs include it, so social sites
 * fetch the new image instead of showing one they cached.
 */
export const ART_VERSION = 2;

/** Grid pitch in SVG user units. */
export const ART_CELL = 10;

/** Dot diameter for each intensity level, as a share of the cell. */
const LEVEL_DIAMETERS = [0.14, 0.24, 0.34, 0.45, 0.57, 0.7];

/** Grid size per cover variant, roughly matching the aspect ratio each is shown at. */
export const ART_GRIDS = {
	card: { columns: 36, rows: 22 },
	feature: { columns: 52, rows: 38 },
	hero: { columns: 64, rows: 32 },
} as const;

export type ArtVariant = keyof typeof ART_GRIDS;

/** Dot diameter in SVG user units for a zero-based size level. */
const dotDiameter = (level: number) => Math.round(LEVEL_DIAMETERS[level] * ART_CELL * 100) / 100;

/** Samples below this intensity draw no dot. */
const THRESHOLD = 0.07;

export type ArtMotif =
	| "waves"
	| "ripple"
	| "dash"
	| "sphere"
	| "lines"
	| "waveform"
	| "braid"
	| "stack"
	| "horizon"
	| "calendar";

const MOTIFS: ArtMotif[] = [
	"waves",
	"ripple",
	"dash",
	"sphere",
	"lines",
	"waveform",
	"braid",
	"stack",
	"horizon",
	"calendar",
];

/** Motifs that read in one direction, so they are never mirrored. */
const UPRIGHT = new Set<ArtMotif>(["lines", "calendar"]);

export interface ArtLayer {
	/** Size level, 1 (smallest) to 6 (largest). */
	level: number;
	accent: boolean;
	/** Stroke width that draws each segment as a dot of this level's size. */
	width: number;
	d: string;
}

/** One dot, in SVG user units. */
export interface ArtDot {
	cx: number;
	cy: number;
	diameter: number;
	accent: boolean;
}

export interface HalftoneArt {
	/** A short, ID-safe key derived from the seed. */
	key: string;
	motif: ArtMotif;
	width: number;
	height: number;
	layers: ArtLayer[];
	/** The same dots as `layers`, one entry each, for drawing outside SVG. */
	dots: ArtDot[];
}

/** FNV-1a: a small, stable string hash. */
function hash(input: string) {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** Mulberry32: a seeded generator returning floats in [0, 1). */
function random(seed: number) {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);
const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = clamp((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;

interface Sample {
	intensity: number;
	accent: boolean;
}

const BLANK: Sample = { intensity: 0, accent: false };

type Field = (x: number, y: number) => Sample;

/**
 * Each motif returns a field over x in [0, aspect] and y in [0, 1], so
 * distances are isotropic whatever the cover's shape. `pitch` is the distance
 * between samples, which motifs use to put edges between rows of dots.
 */
function motifField(motif: ArtMotif, rand: () => number, aspect: number, pitch: number): Field {
	switch (motif) {
		case "waves": {
			// Diagonal bands that bend gently as they cross, fading out from a focus.
			// The band through the focus is drawn in the accent colour.
			const angle = between(rand, -0.6, 0.6);
			const frequency = between(rand, 3, 3.8);
			const bend = between(rand, 0.08, 0.14);
			const bendFrequency = between(rand, 0.6, 1);
			const phase = rand();
			const focus = { x: aspect * between(rand, 0.4, 0.7), y: between(rand, 0.35, 0.65) };
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const bandAt = (x: number, y: number) => {
				const along = x * cos + y * sin;
				const across = -x * sin + y * cos;
				return frequency * (across + bend * Math.sin(TAU * bendFrequency * along)) + phase;
			};
			const accentBand = Math.floor(bandAt(focus.x, focus.y));
			return (x, y) => {
				const t = bandAt(x, y);
				// Narrower crests, so each band has a clear gap before the next.
				const wave = (0.5 + 0.5 * Math.sin(TAU * t)) ** 1.6;
				// A fine line runs down the middle of each gap.
				const seam = 0.3 * (0.5 - 0.5 * Math.sin(TAU * t)) ** 8;
				const distance = Math.hypot(x - focus.x, y - focus.y);
				const envelope = Math.exp(-((distance / 0.85) ** 2));
				const intensity = Math.max(wave, seam) * (0.18 + 0.82 * envelope);
				return {
					intensity,
					accent: Math.floor(t) === accentBand && wave > 0.45 && distance < 0.5,
				};
			};
		}
		case "ripple": {
			// The centre sits on a dot, so the drop there is round.
			const snap = (value: number) => (Math.floor(value / pitch) + 0.5) * pitch;
			const cx = snap(aspect * (rand() < 0.5 ? between(rand, 0.18, 0.32) : between(rand, 0.68, 0.82)));
			const cy = snap(between(rand, 0.35, 0.65));
			const frequency = between(rand, 4.2, 5.4);
			const phase = between(rand, 0, 0.3);
			// At least two dots and a bit in radius, so the drop is round on the card grid too.
			const drop = Math.max(0.5 / frequency, 2.3 * pitch);
			return (x, y) => {
				const r = Math.hypot(x - cx, y - cy);
				// The drop is solid, in the accent colour, and a ring of paper keeps
				// it apart from the first ripple.
				if (r < drop) return { intensity: 1, accent: true };
				if (r < drop + pitch) return BLANK;
				const ring = 0.5 + 0.5 * Math.cos(TAU * (r * frequency - phase));
				const envelope = Math.exp(-r * 1.25);
				// A low floor keeps the farthest rings quiet.
				return { intensity: ring * (0.12 + 0.88 * envelope), accent: false };
			};
		}
		case "dash": {
			// The em dash in the middle, in whole rows so its edges are crisp, with
			// an orange glow whose dots shrink away from it.
			const cx = aspect / 2;
			const middleRow = Math.round(between(rand, 0.46, 0.54) / pitch - 0.5);
			const cy = (middleRow + 0.5) * pitch;
			const half = aspect * between(rand, 0.2, 0.23);
			// A narrow range, so on each grid every dash rounds to the same number of rows.
			const halfRows = Math.round(between(rand, 0.095, 0.1) / pitch - 0.5);
			const radius = (halfRows + 0.5) * pitch;
			const glow = between(rand, 3, 4) * pitch;
			return (x, y) => {
				const dx = Math.max(Math.abs(x - cx) - half, 0);
				const edge = Math.hypot(dx, y - cy) - radius;
				if (edge <= 0) return { intensity: 1, accent: true };
				if (edge >= glow) return BLANK;
				return { intensity: 0.62 * (1 - edge / glow) ** 1.5, accent: true };
			};
		}
		case "sphere": {
			const radius = between(rand, 0.36, 0.4);
			const cx = aspect * between(rand, 0.5, 0.56);
			const cy = between(rand, 0.46, 0.52);
			const light = { x: -0.55, y: -0.6, z: 0.58 };
			return (x, y) => {
				const nx = (x - cx) / radius;
				const ny = (y - cy) / radius;
				const r2 = nx * nx + ny * ny;
				if (r2 > 1) {
					// A shadow on the ground, cast to the lower right.
					const sx = (x - cx - radius * 0.45) / (radius * 1.2);
					const sy = (y - cy - radius * 0.8) / (radius * 0.42);
					return { intensity: Math.exp(-(sx * sx + sy * sy) * 1.4) * 0.42, accent: false };
				}
				const nz = Math.sqrt(1 - r2);
				// Dark where lit, like ink on paper: the lit side reads as small dots,
				// and the highlight, where the light hits head on, has none.
				const lambert = clamp(nx * light.x + ny * light.y + nz * light.z);
				if (lambert > 0.97) return BLANK;
				// The shadowed rim glows in the accent colour.
				return { intensity: 0.2 + 0.8 * (1 - lambert), accent: r2 > 0.7 && lambert < 0.3 };
			};
		}
		case "lines": {
			// Lines of text in an editor: a heading, a paragraph, and the caret. Each
			// line covers whole rows, so lines of one kind are always the same weight.
			const rowOf = (value: number) => Math.round(value / pitch);
			const left = aspect * between(rand, 0.1, 0.16);
			const top = between(rand, 0.2, 0.26);
			const count = 4 + Math.floor(rand() * 2);
			const headingRows = Math.max(2, rowOf(0.075));
			const headingTop = rowOf(top) - Math.floor(headingRows / 2);
			// The paragraph's lines are one row each.
			const bodyTop = rowOf(top + 0.2);
			const leading = Math.max(3, rowOf(0.13));
			const lines = Array.from({ length: count }, (_, i) => {
				const heading = i === 0;
				const last = i === count - 1;
				const reach = heading ? between(rand, 0.34, 0.48) : last ? between(rand, 0.3, 0.46) : between(rand, 0.6, 0.78);
				const first = heading ? headingTop : bodyTop + (i - 1) * leading;
				return { first, last: heading ? first + headingRows - 1 : first, end: left + aspect * reach };
			});
			const caretLine = lines[count - 1];
			const caretColumn = Math.floor((caretLine.end + aspect * 0.035) / pitch);
			return (x, y) => {
				const row = Math.floor(y / pitch);
				// The caret: one column, a row taller than the line at each end.
				if (Math.floor(x / pitch) === caretColumn && row >= caretLine.first - 1 && row <= caretLine.last + 1) {
					return { intensity: 1, accent: true };
				}
				for (const line of lines) {
					if (row >= line.first && row <= line.last && x >= left && x <= line.end) {
						// Ink thins toward the end of each line.
						const progress = (x - left) / (line.end - left);
						return { intensity: 1 - 0.55 * smoothstep(0.35, 1, progress), accent: false };
					}
				}
				return BLANK;
			};
		}
		case "waveform": {
			// A voice's waveform, mirrored about the middle row along a faint
			// baseline. Bars swell toward the centre, and the middle ones are drawn
			// in the accent colour.
			const totalColumns = Math.round(aspect / pitch);
			const step = Math.max(2, Math.round(0.09 / pitch));
			const count = Math.floor((totalColumns * 0.84 + 1) / step);
			const left = Math.round((totalColumns - (count * step - 1)) / 2);
			const middleRow = Math.round(0.5 / pitch - 0.5);
			const cx = aspect / 2;
			// Two slow waves vary the loudness from bar to bar. The loudness is a
			// function of position, so every grid size draws the same waveform.
			const swells = [0, 1].map(() => ({ frequency: between(rand, 7, 13), phase: rand() * TAU }));
			const loudness = (x: number) => {
				const t = (x - cx) / (aspect * 0.42);
				const wobble =
					0.5 +
					0.3 * Math.sin(swells[0].frequency * x + swells[0].phase) +
					0.2 * Math.sin(swells[1].frequency * x + swells[1].phase);
				return Math.exp(-((t / 0.62) ** 2)) * (0.55 + 0.45 * wobble);
			};
			return (x, y) => {
				const row = Math.floor(y / pitch);
				const column = Math.floor(x / pitch) - left;
				const inBar = column >= 0 && column < count * step - 1 && column % step !== step - 1;
				if (inBar) {
					const bar = Math.floor(column / step);
					// The bar's centre, in field units.
					const barX = (left + bar * step + (step - 1) / 2) * pitch;
					const reach = Math.round((0.04 + 0.32 * loudness(barX)) / pitch);
					const offset = Math.abs(row - middleRow);
					if (offset <= reach) {
						// Each bar thins toward its tips.
						return {
							intensity: 0.95 - 0.4 * (offset / Math.max(1, reach)),
							accent: Math.abs(barX - cx) < 1.5 * step * pitch,
						};
					}
				}
				if (row !== middleRow) return BLANK;
				return { intensity: 0.32 * smoothstep(aspect * 0.5, aspect * 0.3, Math.abs(x - cx)), accent: false };
			};
		}
		case "braid": {
			// Three strands braided across the cover, one in the accent colour. Each
			// is thicker and darker where it passes in front, with a gap around it.
			const cx = aspect / 2;
			const cy = between(rand, 0.46, 0.54);
			const tilt = between(rand, -0.14, 0.14);
			const span = aspect * 0.52;
			const amplitude = between(rand, 0.15, 0.18);
			const twists = between(rand, 1, 1.3);
			const frequency = (TAU * twists) / (2 * span);
			const phase = rand() * TAU;
			const width = between(rand, 0.05, 0.058);
			const cos = Math.cos(tilt);
			const sin = Math.sin(tilt);
			// Per-strand values for the sample being drawn, nearest strand first in `order`.
			const depths = [0, 0, 0];
			const offsets = [0, 0, 0];
			const order = [0, 1, 2];
			const nearestFirst = (a: number, b: number) => depths[b] - depths[a];
			return (x, y) => {
				const u = (x - cx) * cos + (y - cy) * sin;
				const v = -(x - cx) * sin + (y - cy) * cos;
				// The strands taper off at the edges.
				const taper = smoothstep(span, span * 0.7, Math.abs(u));
				if (taper === 0) return BLANK;
				for (let k = 0; k < 3; k++) {
					const theta = frequency * u + phase + (k * TAU) / 3;
					depths[k] = Math.cos(theta);
					offsets[k] = amplitude * Math.sin(theta);
				}
				order.sort(nearestFirst);
				// The nearest strand that covers the point wins; the gap around it hides those behind.
				for (let i = 0; i < 3; i++) {
					const k = order[i];
					const depth = depths[k];
					// At least a dot and a half wide, so strands behind stay unbroken on small grids.
					const halfWidth = Math.max(0.75 * pitch, width * (0.45 + 0.55 * taper) * (0.75 + 0.25 * depth));
					// Distance across, turned into distance from the curve.
					const distance = Math.abs(v - offsets[k]) / Math.hypot(1, amplitude * frequency * depth);
					if (distance <= halfWidth) {
						return { intensity: (0.62 + 0.33 * depth) * (0.6 + 0.4 * taper), accent: k === 0 };
					}
					if (distance <= halfWidth + pitch) return BLANK;
				}
				return BLANK;
			};
		}
		case "stack": {
			// Three layers stacked at the isometric angle on a faint isometric grid,
			// each kept apart from the one above by a gap. The middle layer, slotted
			// in, is the accent; the others fade back with depth.
			const tones = [0.66, 0.9, 0.44];
			const slope = Math.tan(Math.PI / 6);
			const halfWidth = between(rand, 0.46, 0.5);
			const halfHeight = halfWidth * slope;
			const spacing = between(rand, 0.12, 0.135);
			const cx = aspect / 2;
			const top = 0.5 - spacing * ((tones.length - 1) / 2);
			// How far a point is inside the layer at index i: 1 at its centre, 0 on its edge.
			const inside = (x: number, y: number, i: number) =>
				1 - Math.abs(x - cx) / halfWidth - Math.abs(y - (top + i * spacing)) / halfHeight;
			// The gap around a layer above, as a share of the layer's size.
			const gap = pitch / halfHeight;
			// Grid lines run along the top layer's edges and split each side in three.
			const cell = (2 * halfHeight) / 3;
			// Distance from a point to the nearest grid line, given its offset along one family's normal.
			const toLine = (value: number) => Math.abs(value / cell - Math.round(value / cell)) * cell * Math.cos(Math.PI / 6);
			return (x, y) => {
				for (let i = 0; i < tones.length; i++) {
					const depth = inside(x, y, i);
					if (depth >= 0) {
						// Each layer darkens slightly toward its front corner.
						const front = clamp((y - (top + i * spacing)) / halfHeight / 2 + 0.5);
						return { intensity: tones[i] * (0.82 + 0.18 * front), accent: i === 1 };
					}
					if (depth > -gap) return BLANK;
				}
				const dx = x - cx;
				// Measured from the top layer's upper corner, which two grid lines pass through.
				const dy = y - (top - halfHeight);
				const onGrid = Math.min(toLine(dy - dx * slope), toLine(dy + dx * slope)) < pitch * 0.45;
				const fade = smoothstep(0.95, 0.25, Math.hypot(dx / aspect, (y - 0.5) * 0.9));
				return { intensity: onGrid ? 0.22 * fade : 0, accent: false };
			};
		}
		case "horizon": {
			// A halftone sunset. The sun sits on the horizon in the accent colour,
			// its rim rounded off by smaller dots, with a glow that fades into the
			// sky and a few thin cuts near the horizon. The sky darkens away from the
			// sun, and the sea carries ripples and the sun's broken reflection.
			const horizonRow = Math.round(between(rand, 0.58, 0.62) / pitch);
			const horizon = horizonRow * pitch;
			const radius = between(rand, 0.36, 0.4);
			const cx = aspect / 2;
			const cy = horizon + radius * between(rand, 0.1, 0.18);
			const sunHeight = radius - (cy - horizon);
			const glowWidth = 2.5 * pitch;
			// Rows above the horizon cut out of the sun and its glow, in its lower part only.
			const cuts = new Set([1, 3, 6].filter((above) => above * pitch < sunHeight * 0.6));
			const swell = rand() * TAU;
			const ripple = between(rand, 14, 20);
			return (x, y) => {
				const row = Math.floor(y / pitch);
				const r = Math.hypot(x - cx, y - cy);
				if (row < horizonRow) {
					if (r < radius + glowWidth) {
						if (cuts.has(horizonRow - row)) return BLANK;
						// How far inside the rim, in dots: the rim's own dots are smaller.
						const inside = (radius - r) / pitch;
						if (inside >= -0.5) return { intensity: 0.55 + 0.45 * clamp(inside + 0.5), accent: true };
						return { intensity: 0.5 * (1 - (r - radius) / glowWidth) ** 1.4, accent: true };
					}
					const sky = 0.36 * smoothstep(radius * 1.12, radius * 2.4, r) * (0.55 + 0.45 * (1 - y / horizon));
					return { intensity: sky, accent: false };
				}
				if (row === horizonRow) return { intensity: 0.72, accent: false };
				const below = row - horizonRow;
				const depth = clamp((y - horizon) / (1 - horizon));
				// Alternate rows are fainter, so the water reads as horizontal ripples.
				const even = below % 2 === 0;
				const strength = even ? 1 : 0.5;
				// The reflection: a column of orange under the sun that narrows with
				// depth, each row a different width, its ends rounded off like the sun.
				const halfLength = radius * (0.9 - 0.45 * depth) * (even ? 1 : 0.72) * (0.85 + 0.15 * Math.cos(below * 2.3));
				const shift = radius * 0.06 * Math.sin(below * 1.7);
				const fromEnd = (halfLength - Math.abs(x - cx - shift)) / pitch;
				if (fromEnd >= -0.5) {
					return { intensity: (0.95 - 0.35 * depth) * strength * (0.6 + 0.4 * clamp(fromEnd + 0.5)), accent: true };
				}
				const wave = 0.55 + 0.45 * Math.sin(ripple * x + below * 2.39 + swell);
				return { intensity: (0.14 + 0.5 * depth) * strength * wave, accent: false };
			};
		}
		case "calendar": {
			// Four weeks of a calendar under its title and the days of the week. Past
			// days are shaded by how much was published, and a day in the next few,
			// the next scheduled post, is in the accent colour.
			const totalColumns = Math.round(aspect / pitch);
			const totalRows = Math.round(1 / pitch);
			// Tiles grow with the grid, but the week always fits in 84% of the width.
			const tile = Math.max(3, Math.min(Math.round(0.15 / pitch), Math.floor((totalColumns * 0.84 + 1) / 7) - 1));
			const step = tile + 1;
			const weeks = 4;
			const width = 7 * step - 1;
			const titleRows = Math.max(2, Math.round(0.08 / pitch));
			// The title, a gap, the days of the week, then another gap.
			const header = titleRows + 3;
			const height = header + weeks * step - 1;
			const left = Math.round((totalColumns - width) / 2);
			const top = Math.round((totalRows - height) / 2);
			const titleLength = width * between(rand, 0.32, 0.42);
			const days = weeks * 7;
			const today = Math.floor(days * between(rand, 0.55, 0.8));
			const scheduled = Math.min(days - 1, today + 1 + Math.floor(rand() * 4));
			const shades = Array.from({ length: days }, () => rand());
			return (x, y) => {
				const column = Math.floor(x / pitch) - left;
				const row = Math.floor(y / pitch) - top;
				if (column < 0 || row < 0 || column >= width || row >= height) return BLANK;
				if (row < titleRows) {
					// The month's name, thinning toward its end like a line of text.
					const progress = column / titleLength;
					return progress > 1 ? BLANK : { intensity: 0.95 - 0.5 * smoothstep(0.4, 1, progress), accent: false };
				}
				const inX = column % step;
				if (row === titleRows + 1) {
					// The days of the week: a short mark over each column.
					return Math.abs(inX - (tile - 1) / 2) <= (tile - 2) / 2 ? { intensity: 0.38, accent: false } : BLANK;
				}
				if (row < header) return BLANK;
				const weekRow = row - header;
				const inY = weekRow % step;
				if (inX === tile || inY === tile) return BLANK;
				// Round the corners of larger tiles.
				if (tile > 3 && (inX === 0 || inX === tile - 1) && (inY === 0 || inY === tile - 1)) return BLANK;
				const day = Math.floor(weekRow / step) * 7 + Math.floor(column / step);
				if (day === scheduled) return { intensity: 1, accent: true };
				const shade = shades[day];
				if (day > today || shade < 0.15) return { intensity: 0.14, accent: false };
				return { intensity: shade < 0.5 ? 0.45 : shade < 0.8 ? 0.66 : 0.88, accent: false };
			};
		}
	}
}

/**
 * Build halftone art for a seed on a `columns` by `rows` grid.
 * Empty size and tone combinations are omitted.
 */
export function halftoneArt(seed: string, columns: number, rows: number): HalftoneArt {
	const seedHash = hash(seed);
	const motif = MOTIFS[seedHash % MOTIFS.length];
	const rand = random(seedHash);
	const aspect = columns / rows;
	const field = motifField(motif, rand, aspect, aspect / columns);
	// Mirror half the covers so motifs with a direction don't all face one way.
	const mirror = !UPRIGHT.has(motif) && rand() < 0.5;

	const levels = LEVEL_DIAMETERS.length;
	const paths: string[] = Array.from({ length: levels * 2 }, () => "");
	const dots: ArtDot[] = [];
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const u = (column + 0.5) / columns;
			const x = (mirror ? 1 - u : u) * aspect;
			const y = (row + 0.5) / rows;
			const { intensity, accent } = field(x, y);
			const value = clamp(intensity);
			if (value < THRESHOLD) continue;
			const level = Math.min(levels - 1, Math.floor(((value - THRESHOLD) / (1 - THRESHOLD)) * levels));
			const cx = column * ART_CELL + ART_CELL / 2;
			const cy = row * ART_CELL + ART_CELL / 2;
			paths[(accent ? levels : 0) + level] += `M${cx} ${cy}h0`;
			dots.push({ cx, cy, diameter: dotDiameter(level), accent });
		}
	}

	return {
		key: seedHash.toString(36),
		motif,
		width: columns * ART_CELL,
		height: rows * ART_CELL,
		layers: paths.flatMap((d, index) =>
			d
				? [
						{
							level: (index % levels) + 1,
							accent: index >= levels,
							width: dotDiameter(index % levels),
							d,
						},
					]
				: [],
		),
		dots,
	};
}
