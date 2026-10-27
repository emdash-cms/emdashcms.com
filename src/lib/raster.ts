/**
 * A small rasteriser for generated images: an RGB float canvas, discs, filled
 * paths, masks, gradients and blurs, and a PNG encoder. It needs no
 * rendering engine and no WebAssembly, so it runs in a Worker.
 *
 * Colours are 0–1 floats in sRGB and blend in sRGB, as browsers do. They are
 * rounded to 8 bits once, when the image is encoded.
 */

export type Rgb = readonly [number, number, number];

export const parseHex = (hex: string): Rgb => [
	Number.parseInt(hex.slice(1, 3), 16) / 255,
	Number.parseInt(hex.slice(3, 5), 16) / 255,
	Number.parseInt(hex.slice(5, 7), 16) / 255,
];

export const WHITE: Rgb = [1, 1, 1];

/** An RGB image: three floats per pixel, row by row. */
export interface Canvas {
	width: number;
	height: number;
	pixels: Float32Array;
}

export function createCanvas(width: number, height: number): Canvas {
	return { width, height, pixels: new Float32Array(width * height * 3) };
}

/** Coverage from 0 to 1 over a rectangle of pixels whose top left is at (x, y). */
export interface Mask {
	x: number;
	y: number;
	width: number;
	height: number;
	alpha: Float32Array;
}

function createMask(x: number, y: number, width: number, height: number): Mask {
	return { x, y, width, height, alpha: new Float32Array(Math.max(0, width * height)) };
}

/** Blend `color` at `alpha` over an anti-aliased disc. */
export function blendDisc(canvas: Canvas, cx: number, cy: number, radius: number, color: Rgb, alpha: number) {
	const { width, height, pixels } = canvas;
	const x0 = Math.max(0, Math.floor(cx - radius - 1));
	const x1 = Math.min(width - 1, Math.ceil(cx + radius + 1));
	const y0 = Math.max(0, Math.floor(cy - radius - 1));
	const y1 = Math.min(height - 1, Math.ceil(cy + radius + 1));
	for (let y = y0; y <= y1; y++) {
		const dy = y + 0.5 - cy;
		for (let x = x0; x <= x1; x++) {
			// Coverage falls off over one pixel at the edge.
			const coverage = Math.min(1, Math.max(0, radius + 0.5 - Math.hypot(x + 0.5 - cx, dy)));
			if (coverage === 0) continue;
			const a = alpha * coverage;
			const i = (y * width + x) * 3;
			pixels[i] += (color[0] - pixels[i]) * a;
			pixels[i + 1] += (color[1] - pixels[i + 1]) * a;
			pixels[i + 2] += (color[2] - pixels[i + 2]) * a;
		}
	}
}

/** A path command in pixels, y down: the commands glyph outlines and the logo use. */
export type PathCommand =
	| { type: "M" | "L"; x: number; y: number }
	| { type: "Q"; x1: number; y1: number; x: number; y: number }
	| { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
	| { type: "Z" };

/** Curves are flattened into lines that stray at most this far from them, in pixels. */
const FLATNESS = 0.2;

/** Most lines a curve is flattened into. */
const MAX_CURVE_LINES = 64;

/**
 * Lines that keep within FLATNESS of a curve whose second derivative is at
 * most `bend`: a chord over a span `h` strays up to `bend · h² / 8`.
 */
const linesFor = (bend: number) => Math.min(MAX_CURVE_LINES, Math.max(1, Math.ceil(Math.sqrt(bend / (8 * FLATNESS)))));

/** Flatten `commands` into line segments, as x0, y0, x1, y1 quadruples, closing every subpath. */
function flatten(commands: Iterable<PathCommand>) {
	const lines: number[] = [];
	let startX = 0;
	let startY = 0;
	let x = 0;
	let y = 0;
	const lineTo = (toX: number, toY: number) => {
		lines.push(x, y, toX, toY);
		x = toX;
		y = toY;
	};
	const close = () => {
		if (x !== startX || y !== startY) lineTo(startX, startY);
	};
	for (const command of commands) {
		switch (command.type) {
			case "M":
				close();
				startX = x = command.x;
				startY = y = command.y;
				break;
			case "L":
				lineTo(command.x, command.y);
				break;
			case "Q": {
				const { x1, y1 } = command;
				const x0 = x;
				const y0 = y;
				const n = linesFor(2 * Math.hypot(x0 - 2 * x1 + command.x, y0 - 2 * y1 + command.y));
				for (let i = 1; i <= n; i++) {
					const t = i / n;
					const s = 1 - t;
					lineTo(s * s * x0 + 2 * s * t * x1 + t * t * command.x, s * s * y0 + 2 * s * t * y1 + t * t * command.y);
				}
				break;
			}
			case "C": {
				const { x1, y1, x2, y2 } = command;
				const x0 = x;
				const y0 = y;
				const bend = 6 * Math.max(Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + command.x, y1 - 2 * y2 + command.y));
				const n = linesFor(bend);
				for (let i = 1; i <= n; i++) {
					const t = i / n;
					const s = 1 - t;
					lineTo(
						s * s * s * x0 + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t * t * t * command.x,
						s * s * s * y0 + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t * t * t * command.y,
					);
				}
				break;
			}
			case "Z":
				close();
				break;
		}
	}
	close();
	return lines;
}

/**
 * Fill a path with the nonzero rule into an anti-aliased coverage mask
 * covering its bounds. Each line adds the signed area it covers to an
 * accumulation buffer, and a running sum along each row turns that into
 * coverage, as font-rs does.
 */
export function fillPath(commands: Iterable<PathCommand>): Mask {
	const lines = flatten(commands);
	if (lines.length === 0) return createMask(0, 0, 0, 0);
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < lines.length; i += 2) {
		minX = Math.min(minX, lines[i]);
		maxX = Math.max(maxX, lines[i]);
		minY = Math.min(minY, lines[i + 1]);
		maxY = Math.max(maxY, lines[i + 1]);
	}
	const left = Math.floor(minX);
	const top = Math.floor(minY);
	// Two spare columns: a line's area can spill one pixel past its right end.
	const width = Math.ceil(maxX) - left + 2;
	const height = Math.ceil(maxY) - top;
	const mask = createMask(left, top, width, height);
	const area = mask.alpha;

	for (let i = 0; i < lines.length; i += 4) {
		let ax = lines[i] - left;
		let ay = lines[i + 1] - top;
		let bx = lines[i + 2] - left;
		let by = lines[i + 3] - top;
		if (ay === by) continue;
		let direction = 1;
		if (ay > by) {
			direction = -1;
			[ax, ay, bx, by] = [bx, by, ax, ay];
		}
		const slope = (bx - ax) / (by - ay);
		let x = ax;
		for (let row = Math.floor(ay); row < Math.min(height, Math.ceil(by)); row++) {
			const start = row * width;
			const dy = Math.min(row + 1, by) - Math.max(row, ay);
			const next = x + slope * dy;
			const d = dy * direction;
			const x0 = Math.min(x, next);
			const x1 = Math.max(x, next);
			const x0Floor = Math.floor(x0);
			const x1Ceil = Math.ceil(x1);
			if (x1Ceil <= x0Floor + 1) {
				// Within one pixel: split the area by where the line crosses it on average.
				const middle = 0.5 * (x + next) - x0Floor;
				area[start + x0Floor] += d - d * middle;
				area[start + x0Floor + 1] += d * middle;
			} else {
				const s = 1 / (x1 - x0);
				const x0Fraction = x0 - x0Floor;
				const first = 0.5 * s * (1 - x0Fraction) ** 2;
				const x1Fraction = x1 - x1Ceil + 1;
				const last = 0.5 * s * x1Fraction ** 2;
				area[start + x0Floor] += d * first;
				if (x1Ceil === x0Floor + 2) {
					area[start + x0Floor + 1] += d * (1 - first - last);
				} else {
					const second = s * (1.5 - x0Fraction);
					area[start + x0Floor + 1] += d * (second - first);
					for (let column = x0Floor + 2; column < x1Ceil - 1; column++) area[start + column] += d * s;
					const penultimate = second + (x1Ceil - x0Floor - 3) * s;
					area[start + x1Ceil - 1] += d * (1 - penultimate - last);
				}
				area[start + x1Ceil] += d * last;
			}
			x = next;
		}
	}

	for (let row = 0; row < height; row++) {
		let sum = 0;
		for (let i = row * width; i < (row + 1) * width; i++) {
			sum += area[i];
			area[i] = Math.min(1, Math.abs(sum));
		}
	}
	return mask;
}

/** Box widths whose three passes in a row approximate a Gaussian blur of `sigma`. */
function boxesFor(sigma: number) {
	const ideal = Math.sqrt(4 * sigma * sigma + 1);
	const lower = Math.floor(ideal) - (Math.floor(ideal) % 2 === 0 ? 1 : 0);
	const lowerCount = Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4));
	return [0, 1, 2].map((i) => (i < lowerCount ? lower : lower + 2));
}

/** Blur `count` lines of `length` values in place with a box of `width`, reading zero past the ends. */
function boxBlur(values: Float32Array, length: number, count: number, step: number, lineStep: number, width: number) {
	const radius = (width - 1) / 2;
	const line = new Float32Array(length);
	for (let l = 0; l < count; l++) {
		const base = l * lineStep;
		for (let i = 0; i < length; i++) line[i] = values[base + i * step];
		let sum = 0;
		for (let i = 0; i < Math.min(radius, length); i++) sum += line[i];
		for (let i = 0; i < length; i++) {
			if (i + radius < length) sum += line[i + radius];
			if (i - radius - 1 >= 0) sum -= line[i - radius - 1];
			values[base + i * step] = sum / width;
		}
	}
}

/** `mask` blurred by a Gaussian of `sigma`, grown to hold the blur's reach. */
export function blurMask(mask: Mask, sigma: number): Mask {
	const boxes = boxesFor(sigma);
	const pad = boxes.reduce((total, width) => total + (width - 1) / 2, 0);
	const blurred = createMask(mask.x - pad, mask.y - pad, mask.width + 2 * pad, mask.height + 2 * pad);
	for (let row = 0; row < mask.height; row++) {
		blurred.alpha.set(mask.alpha.subarray(row * mask.width, (row + 1) * mask.width), (row + pad) * blurred.width + pad);
	}
	for (const width of boxes) {
		boxBlur(blurred.alpha, blurred.width, blurred.height, 1, blurred.width, width);
		boxBlur(blurred.alpha, blurred.height, blurred.width, blurred.width, 1, width);
	}
	return blurred;
}

/** A colour at an offset from 0 to 1 along a gradient. */
export interface GradientStop {
	offset: number;
	color: Rgb;
}

/** A linear gradient from (x1, y1) to (x2, y2) in pixels, with its stops in order of offset. */
export interface LinearGradient {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	stops: readonly GradientStop[];
}

/**
 * Blend a linear gradient over the canvas through `mask`, at `opacity`, as SVG
 * paints one by default: each pixel is projected onto the gradient's line,
 * held at the end colours past either end, and its colour interpolated
 * between the stops either side in sRGB.
 */
export function fillMaskGradient(canvas: Canvas, mask: Mask, gradient: LinearGradient, opacity = 1) {
	const { x1, y1, stops } = gradient;
	const dx = gradient.x2 - x1;
	const dy = gradient.y2 - y1;
	const length2 = dx * dx + dy * dy;
	const color: [number, number, number] = [0, 0, 0];
	blendThrough(canvas, mask, opacity, (x, y) => {
		const t = Math.min(1, Math.max(0, ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / length2));
		let next = stops.findIndex((stop) => stop.offset >= t);
		if (next === -1) next = stops.length - 1;
		const from = stops[Math.max(0, next - 1)];
		const to = stops[next];
		const span = to.offset - from.offset;
		const share = span > 0 ? (t - from.offset) / span : 1;
		for (let c = 0; c < 3; c++) color[c] = from.color[c] + (to.color[c] - from.color[c]) * share;
		return color;
	});
}

/** Blend `color` over the canvas through `mask`, at `opacity`. */
export function fillMask(canvas: Canvas, mask: Mask, color: Rgb, opacity = 1) {
	blendThrough(canvas, mask, opacity, () => color);
}

function blendThrough(canvas: Canvas, mask: Mask, opacity: number, colorAt: (x: number, y: number) => Rgb) {
	const { width, height, pixels } = canvas;
	const x0 = Math.max(0, mask.x);
	const x1 = Math.min(width, mask.x + mask.width);
	const y0 = Math.max(0, mask.y);
	const y1 = Math.min(height, mask.y + mask.height);
	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			const a = Math.min(1, mask.alpha[(y - mask.y) * mask.width + x - mask.x]) * opacity;
			if (a <= 0) continue;
			const i = (y * width + x) * 3;
			const color = colorAt(x, y);
			pixels[i] += (color[0] - pixels[i]) * a;
			pixels[i + 1] += (color[1] - pixels[i + 1]) * a;
			pixels[i + 2] += (color[2] - pixels[i + 2]) * a;
		}
	}
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array) {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

/** A PNG chunk: length, type, data, then a CRC over type and data. */
function chunk(type: string, data: Uint8Array) {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** zlib-wrapped deflate, which is what a PNG's image data holds. */
async function deflate(data: Uint8Array<ArrayBuffer>) {
	const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Encode the canvas as an 8-bit RGB PNG. Every row uses the Sub filter, which
 * stores each byte as its difference from the pixel to its left; on flat colour
 * and smooth gradients that leaves small, repetitive values that deflate well.
 */
export async function encodePng({ width, height, pixels }: Canvas) {
	const bytes = new Uint8Array(pixels.length);
	for (let i = 0; i < pixels.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, pixels[i])) * 255);
	const rowLength = width * 3;
	const filtered = new Uint8Array((rowLength + 1) * height);
	for (let y = 0; y < height; y++) {
		const row = y * rowLength;
		const out = y * (rowLength + 1);
		filtered[out] = 1;
		for (let i = 0; i < rowLength; i++) filtered[out + 1 + i] = bytes[row + i] - (i >= 3 ? bytes[row + i - 3] : 0);
	}

	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	header[8] = 8; // bit depth
	header[9] = 2; // colour type: RGB
	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", await deflate(filtered)),
		chunk("IEND", new Uint8Array(0)),
	];
	const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		png.set(part, offset);
		offset += part.length;
	}
	return png;
}
