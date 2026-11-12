/**
 * Isometric drawing for the figures, in the cover's language: hairline
 * objects, soft faces and each person's gradient. An Iso collects SVG markup
 * for one composition. Fills and strokes are classes (iso.css), so light and
 * dark follow the site's tokens.
 *
 * World axes: +x runs down-right on screen, +y down-left, +z up. Everything
 * draws on the server; the client reads what it animates from data
 * attributes (see live.ts).
 */
import { avatarPaint } from "../avatar";
import { PEOPLE, type PersonKey } from "../cast";

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
/** Hairlines: structure, then detail. */
export const W1 = 1.25;
export const W2 = 0.75;

export const f = (v: number) => +v.toFixed(2);

export type V3 = readonly [number, number, number?];
export type Pt = [number, number];

/** A figure draws one composition per width: lg for a figure 900px and wider, md from 600px, sm below. */
export type Size = "lg" | "md" | "sm";

/** One composition's SVG markup and its viewBox size, for IsoStage.astro. */
export interface Composition {
	size: Size;
	W: number;
	H: number;
	svg: string;
}

export interface BoxPaint {
	fy?: string;
	fx?: string;
	ft?: string;
	stroke?: string;
	sw?: number;
	/** Faces to draw, for boxes whose sides are hidden. */
	only?: ReadonlyArray<"y" | "x" | "t">;
}

let compositions = 0;

/** One isometric composition in screen space: world (0, 0, 0) lands on (ox, oy), scaled by k. */
export class Iso {
	readonly out: string[] = [];
	readonly prefix: string;
	private ids = 0;

	constructor(
		readonly ox: number,
		readonly oy: number,
		readonly k = 1,
	) {
		this.prefix = `iso${compositions++}`;
	}

	/** An id unique on the page, for gradients, clip paths and filters. */
	uid(name = "") {
		return `${this.prefix}${name}${this.ids++}`;
	}

	P(x: number, y: number, z = 0): Pt {
		return [this.ox + (x - y) * COS * this.k, this.oy + ((x + y) * SIN - z) * this.k];
	}

	/** A world-space offset as a screen-space one. */
	delta(dx: number, dy: number, dz = 0): Pt {
		return [(dx - dy) * COS * this.k, ((dx + dy) * SIN - dz) * this.k];
	}

	pt(p: Pt) {
		return `${f(p[0])} ${f(p[1])}`;
	}

	poly(pts: readonly V3[]) {
		return `M${pts.map((p) => this.pt(this.P(p[0], p[1], p[2] ?? 0))).join(" L")} Z`;
	}

	add(s: string) {
		this.out.push(s);
		return this;
	}

	open(attrs: string) {
		return this.add(`<g ${attrs}>`);
	}

	close() {
		return this.add(`</g>`);
	}

	group(attrs: string, fn: () => void) {
		this.open(attrs);
		fn();
		return this.close();
	}

	face(pts: readonly V3[], fill: string, stroke = "s-struct", sw = W1) {
		return this.add(`<path class="${fill} ${stroke}" d="${this.poly(pts)}" stroke-width="${sw}" stroke-linejoin="round"/>`);
	}

	seg(a: V3, b: V3, stroke = "s-detail", sw = W2) {
		return this.add(
			`<path class="${stroke}" d="M${this.pt(this.P(a[0], a[1], a[2] ?? 0))} L${this.pt(this.P(b[0], b[1], b[2] ?? 0))}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`,
		);
	}

	/** (u, v) → (x0 + u, y0 + v, z): drawing flat on a horizontal plane. */
	planeZ(z: number, x0: number, y0: number) {
		const [sx, sy] = this.P(x0, y0, z);
		const k = this.k;
		return `matrix(${f(COS * k)} ${f(SIN * k)} ${f(-COS * k)} ${f(SIN * k)} ${f(sx)} ${f(sy)})`;
	}

	/** (u, w) → (x0 + u, y, z0 - w): a plane facing +y (down-left). */
	planeY(y: number, x0: number, z0: number) {
		const [sx, sy] = this.P(x0, y, z0);
		const k = this.k;
		return `matrix(${f(COS * k)} ${f(SIN * k)} 0 ${f(k)} ${f(sx)} ${f(sy)})`;
	}

	/** (u, w) → (x, y0 - u, z0 - w): a plane facing +x (down-right). */
	planeX(x: number, y0: number, z0: number) {
		const [sx, sy] = this.P(x, y0, z0);
		const k = this.k;
		return `matrix(${f(COS * k)} ${f(-SIN * k)} 0 ${f(k)} ${f(sx)} ${f(sy)})`;
	}

	box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: BoxPaint = {}) {
		const stroke = o.stroke ?? "s-struct";
		const sw = o.sw ?? W1;
		const only = o.only ?? ["y", "x", "t"];
		if (only.includes("y")) this.face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], o.fy ?? "f-fy", stroke, sw);
		if (only.includes("x")) this.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], o.fx ?? "f-fx", stroke, sw);
		if (only.includes("t")) this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], o.ft ?? "f-top", stroke, sw);
		return this;
	}

	/** An upright cylinder standing on z0, centred on (x, y). */
	cylinder(x: number, y: number, r: number, z0: number, z1: number, o: { side?: string; top?: string; stroke?: string; sw?: number } = {}) {
		const rx = r * Math.SQRT2 * COS * this.k;
		const ry = r * Math.SQRT2 * SIN * this.k;
		const [cx, b] = this.P(x, y, z0);
		const top = b - (z1 - z0) * this.k;
		const stroke = o.stroke ?? "s-struct";
		const sw = o.sw ?? W1;
		this.add(
			`<path class="${o.side ?? "f-fy"} ${stroke}" d="M${f(cx - rx)} ${f(top)} V${f(b)} A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(b)} V${f(top)} Z" stroke-width="${sw}" stroke-linejoin="round"/>`,
		);
		this.add(`<ellipse class="${o.top ?? "f-top"} ${stroke}" cx="${f(cx)}" cy="${f(top)}" rx="${f(rx)}" ry="${f(ry)}" stroke-width="${sw}"/>`);
		return { cx, top, bottom: b, rx, ry };
	}

	/** A floating floor plate with a fine grid on top. */
	floor(x0: number, x1: number, y0: number, y1: number, { t = 10, grid = 23, cls = "f-floor" } = {}) {
		this.face([[x0, y1, 0], [x1, y1, 0], [x1, y1, -t], [x0, y1, -t]], "f-fy");
		this.face([[x1, y0, 0], [x1, y1, 0], [x1, y1, -t], [x1, y0, -t]], "f-fx");
		this.face([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], cls);
		for (let x = x0 + grid; x < x1 - 0.1; x += grid) this.seg([x, y0, 0], [x, y1, 0], "s-grid");
		for (let y = y0 + grid; y < y1 - 0.1; y += grid) this.seg([x0, y, 0], [x1, y, 0], "s-grid");
		this.add(`<path class="s-struct" d="${this.poly([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]])}" fill="none" stroke-width="${W1}" stroke-linejoin="round"/>`);
		return this;
	}

	toString() {
		return this.out.join("");
	}
}

/** A person's gradient, filling a w × h rectangle at (x, y) in the current coordinate system. */
export function gradientRect(iso: Iso, who: PersonKey, x: number, y: number, w: number, h: number, rx: number) {
	const s = Math.max(w, h) / 100;
	const ox = x + (w - 100 * s) / 2;
	const oy = y + (h - 100 * s) / 2;
	const clip = `<rect x="${f((x - ox) / s)}" y="${f((y - oy) / s)}" width="${f(w / s)}" height="${f(h / s)}" rx="${f(rx / s)}"/>`;
	return `<g transform="translate(${f(ox)} ${f(oy)}) scale(${f(s)})">${avatarPaint(PEOPLE[who].id, iso.uid("g"), clip)}</g>`;
}

/** The EmDash mark's two shapes in its 118-unit box. */
export function markShape(ring: string, bar: string, extra = "") {
	return `<path d="M0 21.2 Q0 0 21.2 0 H96.95 Q118.16 0 118.16 21.2 V96.5 Q118.16 117.74 96.95 117.74 H21.2 Q0 117.74 0 96.5 Z M9.42 21.2 Q9.42 9.42 21.2 9.42 H96.95 Q108.74 9.42 108.74 21.2 V96.5 Q108.74 108.32 96.95 108.32 H21.2 Q9.42 108.32 9.42 96.5 Z" fill-rule="evenodd" fill="${ring}" ${extra}/><rect x="28.67" y="53.37" width="61.8" height="10.3" fill="${bar}" ${extra}/>`;
}

/** The mark's gradients, defined once per composition. Returns their ids. */
export function markDefs(iso: Iso) {
	const ring = iso.uid("ring");
	const bar = iso.uid("bar");
	iso.add(
		`<defs><linearGradient id="${ring}" x1="-67.1" y1="194.67" x2="145.51" y2="-65.56" gradientUnits="userSpaceOnUse"><stop stop-color="#0F006B"/><stop offset="0.0833" stop-color="#281A81"/><stop offset="0.1667" stop-color="#5D0C83"/><stop offset="0.25" stop-color="#911475"/><stop offset="0.3333" stop-color="#CE2F55"/><stop offset="0.4167" stop-color="#FF6633"/><stop offset="0.5" stop-color="#F6821F"/><stop offset="0.5833" stop-color="#FBAD41"/><stop offset="0.6667" stop-color="#FFCD89"/><stop offset="0.75" stop-color="#FFE9CB"/><stop offset="0.8333" stop-color="#FFF7EC"/><stop offset="0.9167" stop-color="#FFF8EE"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient><linearGradient id="${bar}" x1="144.06" y1="43.16" x2="44.56" y2="85.04" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset="0.1293" stop-color="#FFF8EE"/><stop offset="0.6171" stop-color="#FBAD41"/><stop offset="0.848" stop-color="#F6821F"/><stop offset="1" stop-color="#FF6633"/></linearGradient></defs>`,
	);
	return { ring: `url(#${ring})`, bar: `url(#${bar})` };
}

/** A person's avatar as SVG, centred on (cx, cy), for labels drawn in the scene. */
export function avatarG(iso: Iso, who: PersonKey, cx: number, cy: number, size: number) {
	const s = size / 100;
	return `<g transform="translate(${f(cx - size / 2)} ${f(cy - size / 2)}) scale(${f(s)})">${avatarPaint(PEOPLE[who].id, iso.uid("a"), `<circle cx="50" cy="50" r="50"/>`)}<circle class="s-ring" cx="50" cy="50" r="49.5" fill="none" stroke-width="${f(1 / s)}"/></g>`;
}
