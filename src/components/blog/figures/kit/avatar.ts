/**
 * EmDash's generated user avatar (packages/admin/src/lib/user-avatar.ts and
 * GeneratedAvatar in components/UserAvatar.tsx) as SVG markup: a user id
 * hashes to a palette, a wave, an angle and a mirror, drawn under the
 * person's initial.
 */

const PALETTES = [
	{ name: "Ember", top: "#fee4b9", bottom: "#e14c33" },
	{ name: "Apricot", top: "#ffe6aa", bottom: "#dd6301" },
	{ name: "Meadow", top: "#e5efae", bottom: "#009b3c" },
	{ name: "Jade", top: "#caf7c1", bottom: "#07957c" },
	{ name: "Lagoon", top: "#a7fbea", bottom: "#058eaf" },
	{ name: "Sky", top: "#aff6fe", bottom: "#0584da" },
	{ name: "Indigo", top: "#d3ecff", bottom: "#5f74e4" },
	{ name: "Iris", top: "#ffdbfa", bottom: "#8a66d9" },
	{ name: "Orchid", top: "#fedee7", bottom: "#b156b7" },
	{ name: "Rose", top: "#fee1d4", bottom: "#d04a69" },
	{ name: "Dusk", top: "#ffe0d6", bottom: "#447be4" },
	{ name: "Twilight", top: "#fee5b0", bottom: "#9860d0" },
] as const;

const WAVES = [
	{ base: 44, amp: 6, freq: 0.5, phase: 0.3, amp2: 0 },
	{ base: 42, amp: 7, freq: 1, phase: 0, amp2: 0 },
	{ base: 46, amp: 7, freq: 1, phase: Math.PI, amp2: 0 },
	{ base: 41, amp: 5, freq: 1.5, phase: 0.6, amp2: 0 },
	{ base: 45, amp: 8, freq: 0.75, phase: 1.2, amp2: 0 },
	{ base: 43, amp: 6, freq: 1.25, phase: 2.4, amp2: 0 },
	{ base: 47, amp: 6, freq: 1, phase: Math.PI / 2, amp2: 2.5 },
	{ base: 40, amp: 4, freq: 2, phase: 0.2, amp2: 0 },
] as const;

function cyrb53(str: string) {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return [h1 >>> 0, h2 >>> 0] as const;
}

function avatarVariant(id: string) {
	const [h1, h2] = cyrb53(id);
	return {
		palette: PALETTES[h1 % PALETTES.length]!,
		wave: WAVES[(h1 >>> 8) % WAVES.length]!,
		angle: (h2 % 25) - 12,
		mirrored: ((h2 >>> 7) & 1) === 1,
	};
}

/** The wave's top edge as a Catmull-Rom curve through samples every 10 units, closed well below the circle. */
function wavePath({ base, amp, freq, phase, amp2 }: (typeof WAVES)[number]) {
	const y = (x: number) => {
		const a = (2 * Math.PI * x) / 100;
		return base + amp * Math.sin(a * freq + phase) + amp2 * Math.sin(a * freq * 2 + phase);
	};
	const points: Array<[number, number]> = [];
	for (let x = -40; x <= 140; x += 10) points.push([x, y(x)]);
	let d = `M ${points[0]![0]} ${points[0]![1].toFixed(2)}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p1 = points[i]!;
		const p2 = points[i + 1]!;
		const p0 = points[i - 1] ?? p1;
		const p3 = points[i + 2] ?? p2;
		const c1x = p1[0] + (p2[0] - p0[0]) / 6;
		const c1y = p1[1] + (p2[1] - p0[1]) / 6;
		const c2x = p2[0] - (p3[0] - p1[0]) / 6;
		const c2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0]} ${p2[1].toFixed(2)}`;
	}
	return `${d} L 140 160 L -40 160 Z`;
}

function mixHex(a: string, b: string, p: number) {
	const rgb = (hex: string) => {
		const n = Number.parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	const to = rgb(b);
	return `#${rgb(a)
		.map((v, i) => Math.round(v + (to[i]! - v) * p).toString(16).padStart(2, "0"))
		.join("")}`;
}

let instances = 0;

/** GeneratedAvatar at `size` px. Ids stay unique on the page. */
export function avatarSVG(id: string, name: string, size: number) {
	const uid = `fig-av${instances++}`;
	const { palette, wave, angle, mirrored } = avatarVariant(id);
	const path = wavePath(wave);
	const transform = `rotate(${angle} 50 50)${mirrored ? " translate(100 0) scale(-1 1)" : ""}`;
	const initial = [...name.trim()][0]?.toUpperCase() ?? "";
	const shadow = `<filter id="${uid}t" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="${mixHex(palette.bottom, "#000000", 0.55)}" flood-opacity="0.55"/><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${mixHex(palette.bottom, "#000000", 0.35)}" flood-opacity="0.35"/></filter>`;
	return `<svg class="fig-avatar-svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${uid}c"><circle cx="50" cy="50" r="50"/></clipPath><filter id="${uid}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter><filter id="${uid}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter><radialGradient id="${uid}h" cx="30%" cy="18%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="${uid}d" cx="72%" cy="104%" r="70%"><stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>${initial ? shadow : ""}</defs><g clip-path="url(#${uid}c)"><rect width="100" height="100" fill="${palette.top}"/><path d="${path}" transform="${transform} translate(0 -10)" fill="${mixHex(palette.top, palette.bottom, 0.45)}" filter="url(#${uid}s)" opacity="0.7"/><path d="${path}" transform="${transform}" fill="${palette.bottom}" filter="url(#${uid}b)"/><rect width="100" height="100" fill="url(#${uid}h)"/><rect width="100" height="100" fill="url(#${uid}d)"/></g><circle class="fig-avatar-edge" cx="50" cy="50" r="49.5" fill="none" stroke-width="${Math.max(1, 100 / size).toFixed(2)}"/>${initial ? `<text x="50" y="50" dy=".35em" text-anchor="middle" font-size="44" font-weight="600" fill="#fff" filter="url(#${uid}t)">${initial}</text>` : ""}</svg>`;
}

/**
 * The avatar's gradient (no initial) filling a 100-unit box, clipped by
 * `clip`, an SVG shape in the same box. Isometric scenes paint it on
 * monitors and avatars. `uid` must be unique on the page.
 */
export function avatarPaint(id: string, uid: string, clip: string) {
	const { palette, wave, angle, mirrored } = avatarVariant(id);
	const path = wavePath(wave);
	const transform = `rotate(${angle} 50 50)${mirrored ? " translate(100 0) scale(-1 1)" : ""}`;
	return `<defs><clipPath id="${uid}c">${clip}</clipPath><filter id="${uid}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter><filter id="${uid}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter><radialGradient id="${uid}h" cx="30%" cy="18%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="${uid}d" cx="72%" cy="104%" r="70%"><stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><g clip-path="url(#${uid}c)"><rect width="100" height="100" fill="${palette.top}"/><path d="${path}" transform="${transform} translate(0 -10)" fill="${mixHex(palette.top, palette.bottom, 0.45)}" filter="url(#${uid}s)" opacity="0.7"/><path d="${path}" transform="${transform}" fill="${palette.bottom}" filter="url(#${uid}b)"/><rect width="100" height="100" fill="url(#${uid}h)"/><rect width="100" height="100" fill="url(#${uid}d)"/></g>`;
}
