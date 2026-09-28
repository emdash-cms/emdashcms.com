/**
 * Draws a post's halftone cover art as a PNG, for use as its social share
 * image. Social sites don't accept SVG, so the dots are drawn straight into
 * a pixel buffer and encoded here. The art is only round dots on a flat
 * background, which needs no rendering engine and no WebAssembly.
 *
 * The output matches the post's hero cover in light mode: the same grid,
 * scaled to cover the image and centred, like `preserveAspectRatio="xMidYMid slice"`.
 */
import { ART_CELL, ART_GRIDS, halftoneArt } from "./post-art";

/** The standard large share-card size. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type Rgb = readonly [number, number, number];

/*
 * PostCover's light-mode colours as the browser resolves them:
 * --color-bg #f9f9f9, --color-surface #ffffff, and --color-text #262626 from
 * Base.astro, and --color-primary (--heat-100) #ff5e1f from theme.css.
 */
/** --art-bg: color-mix(bg 55%, surface). */
const BACKGROUND: Rgb = [252, 252, 252];
const TEXT: Rgb = [0x26, 0x26, 0x26];
/** --art-paper: text at 9% opacity. */
const PAPER_ALPHA = 0.09;
/** --art-ink: text at 62% opacity. */
const INK_ALPHA = 0.62;
/** --art-accent: the brand orange, opaque. */
const ACCENT: Rgb = [0xff, 0x5e, 0x1f];
/** Radius of the paper grain dot in each cell, in SVG user units. */
const GRAIN_RADIUS = 0.75;

/** Bytes per row: one filter byte, then RGB triples. */
const STRIDE = OG_WIDTH * 3 + 1;

/** Blend an anti-aliased disc into the raw scanline buffer. */
function drawDisc(pixels: Uint8Array, cx: number, cy: number, radius: number, color: Rgb, alpha: number) {
	const x0 = Math.max(0, Math.floor(cx - radius - 1));
	const x1 = Math.min(OG_WIDTH - 1, Math.ceil(cx + radius + 1));
	const y0 = Math.max(0, Math.floor(cy - radius - 1));
	const y1 = Math.min(OG_HEIGHT - 1, Math.ceil(cy + radius + 1));
	for (let y = y0; y <= y1; y++) {
		const dy = y + 0.5 - cy;
		for (let x = x0; x <= x1; x++) {
			// Coverage falls off over one pixel at the edge.
			const coverage = Math.min(1, Math.max(0, radius + 0.5 - Math.hypot(x + 0.5 - cx, dy)));
			if (coverage === 0) continue;
			const a = alpha * coverage;
			const i = y * STRIDE + 1 + x * 3;
			pixels[i] = Math.round(pixels[i] + (color[0] - pixels[i]) * a);
			pixels[i + 1] = Math.round(pixels[i + 1] + (color[1] - pixels[i + 1]) * a);
			pixels[i + 2] = Math.round(pixels[i + 2] + (color[2] - pixels[i + 2]) * a);
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

async function encodePng(pixels: Uint8Array<ArrayBuffer>) {
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, OG_WIDTH);
	view.setUint32(4, OG_HEIGHT);
	header[8] = 8; // bit depth
	header[9] = 2; // colour type: RGB
	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", await deflate(pixels)),
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

/** Render the hero cover art for `slug` as a 1200 × 630 PNG. */
export async function postArtPng(slug: string) {
	const { columns, rows } = ART_GRIDS.hero;
	const art = halftoneArt(slug, columns, rows);
	const scale = Math.max(OG_WIDTH / art.width, OG_HEIGHT / art.height);
	const offsetX = (art.width * scale - OG_WIDTH) / 2;
	const offsetY = (art.height * scale - OG_HEIGHT) / 2;
	const toX = (x: number) => x * scale - offsetX;
	const toY = (y: number) => y * scale - offsetY;

	// Each row starts with filter byte 0 (none), which the fill leaves in place.
	const pixels = new Uint8Array(STRIDE * OG_HEIGHT);
	for (let y = 0; y < OG_HEIGHT; y++) {
		for (let x = 0; x < OG_WIDTH; x++) pixels.set(BACKGROUND, y * STRIDE + 1 + x * 3);
	}

	// Paper grain: one faint dot at the centre of every cell, under the art.
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const cx = column * ART_CELL + ART_CELL / 2;
			const cy = row * ART_CELL + ART_CELL / 2;
			drawDisc(pixels, toX(cx), toY(cy), GRAIN_RADIUS * scale, TEXT, PAPER_ALPHA);
		}
	}

	for (const dot of art.dots) {
		const radius = (dot.diameter / 2) * scale;
		if (dot.accent) drawDisc(pixels, toX(dot.cx), toY(dot.cy), radius, ACCENT, 1);
		else drawDisc(pixels, toX(dot.cx), toY(dot.cy), radius, TEXT, INK_ALPHA);
	}

	return encodePng(pixels);
}
