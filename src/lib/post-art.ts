/**
 * Generated halftone cover art for posts without a featured image.
 *
 * A post's slug seeds one of a few motifs: flowing waves, ripples, the em
 * dash, a shaded sphere, or lines of text with a caret. The motif is sampled on a dot grid;
 * each sample's intensity sets the dot size, and a small accent region of each
 * motif is drawn in the brand orange. Dots of one size and tone are drawn as a
 * single path of zero-length round-capped segments, so a cover is a handful of
 * path strings rather than hundreds of elements.
 *
 * The output depends only on the seed and grid size, so a post always gets the
 * same motif, and its card and page show the same composition at their own
 * grid sizes.
 */

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

export type ArtMotif = "waves" | "ripple" | "dash" | "sphere" | "lines";
const MOTIFS: ArtMotif[] = ["waves", "ripple", "dash", "sphere", "lines"];

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

type Field = (x: number, y: number) => Sample;

/**
 * Each motif returns a field over x in [0, aspect] and y in [0, 1], so
 * distances are isotropic whatever the cover's shape.
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
				const wave = 0.5 + 0.5 * Math.sin(TAU * t);
				const distance = Math.hypot(x - focus.x, y - focus.y);
				const envelope = Math.exp(-((distance / 0.8) ** 2));
				const intensity = wave * (0.15 + 0.85 * envelope);
				return {
					intensity,
					accent: Math.floor(t) === accentBand && wave > 0.6 && distance < 0.45,
				};
			};
		}
		case "ripple": {
			const cx = aspect * (rand() < 0.5 ? between(rand, 0.18, 0.32) : between(rand, 0.68, 0.82));
			const cy = between(rand, 0.35, 0.65);
			const frequency = between(rand, 4.2, 5.4);
			const phase = between(rand, 0, 0.3);
			return (x, y) => {
				const r = Math.hypot(x - cx, y - cy);
				const ring = 0.5 + 0.5 * Math.cos(TAU * (r * frequency - phase));
				const envelope = Math.exp(-r * 1.25);
				return { intensity: ring * (0.2 + 0.8 * envelope), accent: r < 0.7 / frequency && ring > 0.35 };
			};
		}
		case "dash": {
			const cx = aspect * between(rand, 0.56, 0.64);
			const cy = between(rand, 0.46, 0.54);
			const half = aspect * between(rand, 0.15, 0.2);
			const thickness = between(rand, 0.07, 0.085);
			const trail = between(rand, 1.1, 1.6);
			return (x, y) => {
				// Distance to a horizontal capsule: the em dash itself.
				const dx = Math.max(Math.abs(x - cx) - half, 0);
				const edge = Math.hypot(dx, y - cy) - thickness;
				if (edge <= 0) return { intensity: 1, accent: true };
				const glow = Math.exp(-edge * 7) * 0.85;
				// Speed lines trailing behind the dash, thinning with distance.
				const behind = cx - half - x;
				const lane = 0.5 + 0.5 * Math.cos(TAU * (y - cy) * 9);
				const band = Math.exp(-(((y - cy) / 0.26) ** 2));
				const streak = behind > 0 ? lane * band * Math.exp(-behind * trail) * 0.8 : 0;
				return { intensity: Math.max(glow, streak), accent: false };
			};
		}
		case "sphere": {
			const radius = between(rand, 0.34, 0.4);
			const cx = aspect * between(rand, 0.56, 0.68);
			const cy = between(rand, 0.46, 0.56);
			const light = { x: -0.55, y: -0.6, z: 0.58 };
			return (x, y) => {
				const nx = (x - cx) / radius;
				const ny = (y - cy) / radius;
				const r2 = nx * nx + ny * ny;
				if (r2 > 1) {
					// Soft cast shadow to the lower right.
					const sx = (x - cx - radius * 0.35) / (radius * 1.25);
					const sy = (y - cy - radius * 0.55) / (radius * 0.55);
					return { intensity: Math.exp(-(sx * sx + sy * sy) * 1.6) * 0.32, accent: false };
				}
				const nz = Math.sqrt(1 - r2);
				// Dark where lit, like ink on paper: the lit side reads as small dots.
				const lambert = clamp(nx * light.x + ny * light.y + nz * light.z);
				// The shadowed rim glows in the accent colour.
				return { intensity: 0.2 + 0.8 * (1 - lambert), accent: r2 > 0.7 && lambert < 0.3 };
			};
		}
		case "lines": {
			// Lines of text in an editor: a heading, a paragraph, and the caret.
			const left = aspect * between(rand, 0.1, 0.16);
			const top = between(rand, 0.2, 0.26);
			const count = 4 + Math.floor(rand() * 2);
			const lines = Array.from({ length: count }, (_, i) => {
				const heading = i === 0;
				const last = i === count - 1;
				const reach = heading ? between(rand, 0.34, 0.48) : last ? between(rand, 0.3, 0.46) : between(rand, 0.6, 0.78);
				return {
					y: top + (heading ? 0 : 0.2 + (i - 1) * 0.14),
					half: heading ? 0.055 : 0.03,
					end: left + aspect * reach,
				};
			});
			const caretLine = lines[count - 1];
			const caretX = caretLine.end + aspect * 0.035;
			// At least half a column wide, so the caret always covers one sample.
			const caretHalf = Math.max(aspect * 0.012, pitch / 2);
			return (x, y) => {
				if (Math.abs(x - caretX) < caretHalf && Math.abs(y - caretLine.y) < 0.075) {
					return { intensity: 1, accent: true };
				}
				for (const line of lines) {
					if (Math.abs(y - line.y) <= line.half && x >= left && x <= line.end) {
						// Ink thins toward the end of each line.
						const progress = (x - left) / (line.end - left);
						return { intensity: 1 - 0.55 * smoothstep(0.35, 1, progress), accent: false };
					}
				}
				return { intensity: 0, accent: false };
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
	// Text lines stay left to right.
	const mirror = motif !== "lines" && rand() < 0.5;

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
