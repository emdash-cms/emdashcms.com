/**
 * Text for generated images, set in Inter 500: measuring runs with kerning
 * and tracking, wrapping and balancing lines, fitting a block to its box, and
 * turning lines into glyph outlines for ./raster.ts to fill.
 */
import { type Font, type Glyph, parse } from "opentype.js";
import { type Kerning, readKerning } from "./kerning";
import type { PathCommand } from "./raster";

/** One of a face's font files, with its pair kerning. */
interface FontFile {
	font: Font;
	kerning: Kerning;
}

/** A parsed face, in one or more files, with its vertical metrics. */
export interface Face {
	/** Each character is drawn from the first file that has it. Inter ships its character sets as separate files. */
	files: FontFile[];
	unitsPerEm: number;
	/** The hhea ascender and descender as shares of the em. The descender is negative. */
	ascender: number;
	descender: number;
}

/**
 * Size in pixels, tracking in em as CSS letter-spacing takes it, and line
 * height as a multiple of the size; without one, the font's own, as CSS
 * `line-height: normal`.
 */
export interface TextStyle {
	size: number;
	tracking: number;
	lineHeight?: number;
}

/** Lines of text in one style, ready to place. */
export interface TextBlock {
	lines: string[];
	style: TextStyle;
}

const ELLIPSIS = "…";

/** Shrinking text to fit tries this many sizes between its own and its smallest. */
const SHRINK_STEPS = 4;

let inter: Promise<Face> | undefined;

/** A font file from a base64 data URL module, parsed with its kerning. */
async function loadFile(module: Promise<{ default: string }>): Promise<FontFile> {
	const { default: dataUrl } = await module;
	const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (char) => char.charCodeAt(0));
	return { font: parse(bytes.buffer), kerning: await readKerning(bytes) };
}

/** Inter 500 in its Latin, Latin Extended and Vietnamese sets, parsed on first use. */
export function loadInter() {
	inter ??= (async () => {
		// Imported on demand, so each file is its own chunk instead of swelling the route's.
		const files = await Promise.all(
			[
				import("@fontsource/inter/files/inter-latin-500-normal.woff?inline"),
				import("@fontsource/inter/files/inter-latin-ext-500-normal.woff?inline"),
				import("@fontsource/inter/files/inter-vietnamese-500-normal.woff?inline"),
			].map(loadFile),
		);
		const { unitsPerEm, ascender, descender } = files[0].font;
		return { files, unitsPerEm, ascender: ascender / unitsPerEm, descender: descender / unitsPerEm };
	})().catch((error) => {
		// Let the next request try again rather than fail with the same error.
		inter = undefined;
		throw error;
	});
	return inter;
}

/**
 * The glyphs of `text` the font has, each at its x offset in pixels, and the
 * run's width, with tracking after every glyph as CSS adds it.
 */
function shape(face: Face, text: string, style: TextStyle) {
	const scale = style.size / face.unitsPerEm;
	const glyphs: { glyph: Glyph; x: number }[] = [];
	let x = 0;
	let previous: { file: FontFile; index: number } | undefined;
	for (const char of text) {
		// Glyph 0 is a file's box for characters it lacks; when no file has the character, leaving it out reads better.
		const file = face.files.find(({ font }) => font.charToGlyphIndex(char) !== 0);
		if (!file) continue;
		const index = file.font.charToGlyphIndex(char);
		const glyph = file.font.glyphs.get(index);
		// Kerning pairs only exist within one file.
		if (previous?.file === file) x += file.kerning(previous.index, index) * scale;
		glyphs.push({ glyph, x });
		x += (glyph.advanceWidth ?? 0) * scale + style.tracking * style.size;
		previous = { file, index };
	}
	return { glyphs, width: x };
}

/** The width of `text` in pixels. */
function measure(face: Face, text: string, style: TextStyle) {
	return shape(face, text, style).width;
}

/** Line height in pixels. */
function lineHeight(face: Face, style: TextStyle) {
	return (style.lineHeight ?? face.ascender - face.descender) * style.size;
}

/** How far below the top of its line box a line's baseline sits, with the leading split evenly above and below, as CSS does. */
function baselineOffset(face: Face, style: TextStyle) {
	const content = (face.ascender - face.descender) * style.size;
	return (lineHeight(face, style) - content) / 2 + face.ascender * style.size;
}

/** Break `text` into lines at spaces, filling each line as far as `maxWidth` allows. A word wider than that gets a line of its own. */
function wrap(face: Face, text: string, style: TextStyle, maxWidth: number) {
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const longer = line ? `${line} ${word}` : word;
		if (line && measure(face, longer, style) > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = longer;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/** Wrap `text` at the narrowest width that still takes `count` lines, as CSS `text-wrap: balance` does. */
function balance(face: Face, text: string, style: TextStyle, count: number, maxWidth: number) {
	let low = 0;
	let high = maxWidth;
	if (count > 1) {
		while (high - low > 0.5) {
			const mid = (low + high) / 2;
			if (wrap(face, text, style, mid).length <= count) high = mid;
			else low = mid;
		}
	}
	return wrap(face, text, style, high);
}

/** `text` cut after a word, or within the word when the first is too wide, and ended with an ellipsis, to fit `maxWidth`. */
function truncate(face: Face, text: string, style: TextStyle, maxWidth: number) {
	if (measure(face, text, style) <= maxWidth) return text;
	const fits = (cut: string) => measure(face, cut + ELLIPSIS, style) <= maxWidth;
	const words = text.split(" ");
	for (let count = words.length - 1; count > 0; count--) {
		const cut = words.slice(0, count).join(" ").replace(/[\s,.:;!?–—-]+$/u, "");
		if (cut && fits(cut)) return cut + ELLIPSIS;
	}
	const chars = [...words[0]];
	for (let count = chars.length - 1; count > 0; count--) {
		const cut = chars.slice(0, count).join("");
		if (fits(cut)) return cut + ELLIPSIS;
	}
	return ELLIPSIS;
}

export interface Fit {
	maxWidth: number;
	maxLines: number;
	/** Shrink the text in steps down to this size before cutting it short. */
	minSize?: number;
	/** Even out the line lengths. */
	balance?: boolean;
}

/**
 * Lay `text` out in at most `maxLines` lines of `maxWidth`, shrinking it in
 * steps to `minSize` if it doesn't fit, then ending the last line with an
 * ellipsis.
 */
export function fitText(face: Face, text: string, style: TextStyle, fit: Fit): TextBlock {
	const minSize = fit.minSize ?? style.size;
	const steps = minSize < style.size ? SHRINK_STEPS : 0;
	for (let step = 0; step <= steps; step++) {
		const sized = { ...style, size: style.size - ((style.size - minSize) * step) / Math.max(1, steps) };
		const lines = wrap(face, text, sized, fit.maxWidth);
		if (lines.length <= fit.maxLines && lines.every((line) => measure(face, line, sized) <= fit.maxWidth)) {
			return { lines: fit.balance ? balance(face, text, sized, lines.length, fit.maxWidth) : lines, style: sized };
		}
	}
	const sized = { ...style, size: minSize };
	const lines = wrap(face, text, sized, fit.maxWidth);
	const kept = [...lines.slice(0, fit.maxLines - 1), lines.slice(fit.maxLines - 1).join(" ")];
	return { lines: kept.map((line) => truncate(face, line, sized, fit.maxWidth)), style: sized };
}

/** The block's height in pixels. */
export function blockHeight(face: Face, block: TextBlock) {
	return block.lines.length * lineHeight(face, block.style);
}

/** The width of the block's widest line in pixels. */
export function blockWidth(face: Face, block: TextBlock) {
	return Math.max(0, ...block.lines.map((line) => measure(face, line, block.style)));
}

/** The glyph outlines of a block whose first line box has its top left at (x, top), in pixels. */
export function blockOutline(face: Face, block: TextBlock, x: number, top: number): PathCommand[] {
	const scale = block.style.size / face.unitsPerEm;
	const step = lineHeight(face, block.style);
	const commands: PathCommand[] = [];
	block.lines.forEach((line, index) => {
		const baseline = top + index * step + baselineOffset(face, block.style);
		for (const { glyph, x: offset } of shape(face, line, block.style).glyphs) {
			const left = x + offset;
			const px = (value: number) => left + value * scale;
			// Font units point up; pixels point down.
			const py = (value: number) => baseline - value * scale;
			for (const command of glyph.path.commands) {
				switch (command.type) {
					case "M":
					case "L":
						commands.push({ type: command.type, x: px(command.x), y: py(command.y) });
						break;
					case "Q":
						commands.push({ type: "Q", x1: px(command.x1), y1: py(command.y1), x: px(command.x), y: py(command.y) });
						break;
					case "C":
						commands.push({
							type: "C",
							x1: px(command.x1),
							y1: py(command.y1),
							x2: px(command.x2),
							y2: py(command.y2),
							x: px(command.x),
							y: py(command.y),
						});
						break;
					case "Z":
						commands.push(command);
						break;
				}
			}
		}
	});
	return commands;
}
