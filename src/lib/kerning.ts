/**
 * Pair kerning read straight from a WOFF font's GPOS table.
 *
 * opentype.js 2 skips GPOS extension lookups, and Inter keeps nearly all of
 * its Latin kerning in one, so through opentype.js only a few numeral pairs
 * are kerned. This reads the pair adjustments of every lookup the `kern`
 * feature uses, extension lookups included.
 */

/** The horizontal adjustment between two glyphs, in font units. */
export type Kerning = (left: number, right: number) => number;

/** Bits of a GPOS value format, which say which fields a value record holds. */
const X_PLACEMENT = 0x1;
const Y_PLACEMENT = 0x2;
const X_ADVANCE = 0x4;

/** GPOS lookup types: pair adjustment, and an extension that wraps a lookup of another type. */
const PAIR_ADJUSTMENT = 2;
const EXTENSION = 9;

/** A WOFF table, inflated when it was stored compressed. */
async function woffTable(woff: Uint8Array, tag: string) {
	const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
	for (let i = 0; i < view.getUint16(12); i++) {
		const entry = 44 + i * 20;
		if (String.fromCharCode(...woff.subarray(entry, entry + 4)) !== tag) continue;
		const offset = view.getUint32(entry + 4);
		const stored = woff.slice(offset, offset + view.getUint32(entry + 8));
		const length = view.getUint32(entry + 12);
		const data =
			stored.length < length
				? new Uint8Array(await new Response(new Blob([stored]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer())
				: stored;
		return new DataView(data.buffer, data.byteOffset, data.byteLength);
	}
	return null;
}

/** Bytes in a value record of `format`: two for each field it holds. */
function recordSize(format: number) {
	let size = 0;
	for (let bits = format; bits; bits >>= 1) size += (bits & 1) * 2;
	return size;
}

/** The pair kerning in `woff`, or none when it has no GPOS table. */
export async function readKerning(woff: Uint8Array): Promise<Kerning> {
	const gpos = await woffTable(woff, "GPOS");
	if (!gpos) return () => 0;
	const u16 = (at: number) => gpos.getUint16(at);

	const coverageIndex = (table: number, glyph: number) => {
		const ranged = u16(table) === 2;
		let low = 0;
		let high = u16(table + 2) - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const start = ranged ? u16(table + 4 + mid * 6) : u16(table + 4 + mid * 2);
			const end = ranged ? u16(table + 6 + mid * 6) : start;
			if (glyph < start) high = mid - 1;
			else if (glyph > end) low = mid + 1;
			else return ranged ? u16(table + 8 + mid * 6) + glyph - start : mid;
		}
		return -1;
	};

	const classOf = (table: number, glyph: number) => {
		if (u16(table) === 1) {
			const index = glyph - u16(table + 2);
			return index >= 0 && index < u16(table + 4) ? u16(table + 6 + index * 2) : 0;
		}
		let low = 0;
		let high = u16(table + 2) - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const range = table + 4 + mid * 6;
			if (glyph < u16(range)) high = mid - 1;
			else if (glyph > u16(range + 2)) low = mid + 1;
			else return u16(range + 4);
		}
		return 0;
	};

	/** A PairPos subtable's x-advance for the pair, or undefined when the subtable doesn't cover it. */
	const pairAdjustment = (subtable: number, left: number, right: number) => {
		const covered = coverageIndex(subtable + u16(subtable + 2), left);
		if (covered < 0) return undefined;
		const format1 = u16(subtable + 4);
		const size = recordSize(format1) + recordSize(u16(subtable + 6));
		const advance = format1 & X_ADVANCE ? recordSize(format1 & (X_PLACEMENT | Y_PLACEMENT)) : -1;
		const read = (record: number) => (advance < 0 ? 0 : gpos.getInt16(record + advance));
		if (u16(subtable) === 1) {
			const pairs = subtable + u16(subtable + 10 + covered * 2);
			let low = 0;
			let high = u16(pairs) - 1;
			while (low <= high) {
				const mid = (low + high) >> 1;
				const record = pairs + 2 + mid * (2 + size);
				const second = u16(record);
				if (second === right) return read(record + 2);
				if (second < right) low = mid + 1;
				else high = mid - 1;
			}
			return undefined;
		}
		const class1 = classOf(subtable + u16(subtable + 8), left);
		const class2 = classOf(subtable + u16(subtable + 10), right);
		return read(subtable + 16 + (class1 * u16(subtable + 14) + class2) * size);
	};

	const features = u16(6);
	const lookupList = u16(8);
	const indices = new Set<number>();
	for (let i = 0; i < u16(features); i++) {
		const record = features + 2 + i * 6;
		if (String.fromCharCode(gpos.getUint8(record), gpos.getUint8(record + 1), gpos.getUint8(record + 2), gpos.getUint8(record + 3)) !== "kern") continue;
		const feature = features + u16(record + 4);
		for (let j = 0; j < u16(feature + 2); j++) indices.add(u16(feature + 4 + j * 2));
	}
	const lookups = [...indices]
		.sort((a, b) => a - b)
		.map((index) => {
			const lookup = lookupList + u16(lookupList + 2 + index * 2);
			const type = u16(lookup);
			const subtables: number[] = [];
			for (let k = 0; k < u16(lookup + 4); k++) {
				const subtable = lookup + u16(lookup + 6 + k * 2);
				if (type === PAIR_ADJUSTMENT) subtables.push(subtable);
				else if (type === EXTENSION && u16(subtable + 2) === PAIR_ADJUSTMENT) subtables.push(subtable + gpos.getUint32(subtable + 4));
			}
			return subtables;
		});

	const cache = new Map<number, number>();
	return (left, right) => {
		const key = left * 0x10000 + right;
		let total = cache.get(key);
		if (total !== undefined) return total;
		total = 0;
		// Each lookup adjusts the pair once, with its first subtable that covers it.
		for (const subtables of lookups) {
			for (const subtable of subtables) {
				const adjustment = pairAdjustment(subtable, left, right);
				if (adjustment === undefined) continue;
				total += adjustment;
				break;
			}
		}
		cache.set(key, total);
		return total;
	};
}
