/**
 * The scene's objects. Each draws into an Iso at a world position, wraps
 * itself in a <g data-part> so a scene can animate it, and returns the
 * anchors a composition needs: where a card's stem lands, where a link
 * attaches, where a label goes.
 */
import type { PersonKey } from "../cast";
import { f, gradientRect, type Iso, markShape, type Pt, type V3, W1, W2 } from "./iso";

/** A floor plate's sides and corners, by world direction. Corners: back is the top on screen, front the bottom. */
export type Side = "-x" | "+x" | "-y" | "+y" | "back" | "front" | "left" | "right";

export interface Tile {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
	/** The world point on a side's midpoint (or a corner), at floor level, where a link attaches. */
	port(side: Side, along?: number): V3;
	/** A side's or corner's screen point at the plate's underside, for labels below the tile. */
	under(side: Side): Pt;
}

function tileAt(iso: Iso, x0: number, x1: number, y0: number, y1: number, t = 10): Tile {
	const mx = (x0 + x1) / 2;
	const my = (y0 + y1) / 2;
	const at = (side: Side, along = 0): [number, number] => {
		switch (side) {
			case "-x":
				return [x0, my + along];
			case "+x":
				return [x1, my + along];
			case "-y":
				return [mx + along, y0];
			case "+y":
				return [mx + along, y1];
			case "back":
				return [x0, y0];
			case "front":
				return [x1, y1];
			case "left":
				return [x0, y1];
			case "right":
				return [x1, y0];
		}
	};
	return {
		x0,
		x1,
		y0,
		y1,
		port: (side, along) => {
			const [x, y] = at(side, along);
			return [x, y, 0];
		},
		under: (side) => {
			const [x, y] = at(side);
			return iso.P(x, y, -t);
		},
	};
}

/** A floating floor plate with a fine grid, `part`-named. Centre (cx, cy), half sizes hx and hy. */
export function tile(iso: Iso, cx: number, cy: number, hx: number, hy = hx, { part = "", t = 10, grid = 23, cls = "f-floor" } = {}) {
	const x0 = cx - hx;
	const x1 = cx + hx;
	const y0 = cy - hy;
	const y1 = cy + hy;
	iso.group(`data-part="${part}"`, () => iso.floor(x0, x1, y0, y1, { t, grid, cls }));
	return tileAt(iso, x0, x1, y0, y1, t);
}

// ---------- Desks ----------

/** Half the side of a desk's floor tile, in world units. */
export const DESK_TILE = 57.5;

export type Facing = "x" | "y";

/** The little browser window on a monitor, in the screen's 58 × 38 box. */
function screenWindow() {
	return `<rect class="f-paper" x="9" y="6" width="40" height="26" rx="1.4"/><path class="s-detail" d="M9 10.5 H49" stroke-width="${W2}" vector-effect="non-scaling-stroke" fill="none"/><path class="s-content" d="M13 15.5 H33 M13 20 H42 M13 24.5 H29" stroke-width="${W1}" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
}

export interface Desk {
	/** Screen point at the top of the monitor, where a window's stem lands. */
	monitorTop: Pt;
	/** Screen offset the chair travels when it rolls back from the desk. */
	roll: Pt;
}

/**
 * A desk with a monitor and a chair, in the tile centred on (cx, cy).
 * `facing` is the direction the monitor faces: +x (down-right) or +y
 * (down-left). The screen shows the person's gradient; `data-part="screen-…"`
 * is the browser window on it, `data-part="chair-…"` the chair, whose
 * data-roll is the screen offset it travels when it rolls back.
 */
function desk(iso: Iso, cx: number, cy: number, who: PersonKey, { facing = "y" as Facing, part = who as string } = {}): Desk {
	const b = iso.box.bind(iso);
	let monitorTop: Pt;
	let roll: Pt;
	iso.open(`data-part="desk-${part}"`);
	if (facing === "x") {
		const x0 = cx - 42.5;
		const yc = cy;
		b(x0 + 4, x0 + 48, yc - 28, yc - 25, 0, 27, { sw: W2 });
		b(x0 + 4, x0 + 48, yc + 25, yc + 28, 0, 27, { sw: W2 });
		b(x0, x0 + 52, yc - 30, yc + 30, 27, 30);
		b(x0 + 8, x0 + 20, yc - 9, yc + 9, 30, 31.5, { sw: W2 });
		b(x0 + 12, x0 + 15, yc - 2, yc + 2, 31.5, 40, { sw: W2 });
		b(x0 + 11, x0 + 15, yc - 31, yc + 31, 40, 80);
		iso.add(`<g transform="${iso.planeX(x0 + 15, yc + 31, 80)}">${screenFace(iso, who, part)}</g>`);
		b(x0 + 26, x0 + 38, yc - 15, yc + 15, 30, 31.5, { sw: W2 });
		iso.seg([x0 + 32, yc - 12, 31.5], [x0 + 32, yc + 12, 31.5]);
		iso.close();
		roll = iso.delta(22, 9);
		chair(iso, x0 + 69, yc - 4, "x", part, roll);
		monitorTop = iso.P(x0 + 13, yc, 80);
	} else {
		const xc = cx;
		const y0 = cy - 42.5;
		b(xc - 28, xc - 25, y0 + 4, y0 + 48, 0, 27, { sw: W2 });
		b(xc + 25, xc + 28, y0 + 4, y0 + 48, 0, 27, { sw: W2 });
		b(xc - 30, xc + 30, y0, y0 + 52, 27, 30);
		b(xc - 9, xc + 9, y0 + 8, y0 + 20, 30, 31.5, { sw: W2 });
		b(xc - 2, xc + 2, y0 + 12, y0 + 15, 31.5, 40, { sw: W2 });
		b(xc - 31, xc + 31, y0 + 11, y0 + 15, 40, 80);
		iso.add(`<g transform="${iso.planeY(y0 + 15, xc - 31, 80)}">${screenFace(iso, who, part)}</g>`);
		b(xc - 15, xc + 15, y0 + 26, y0 + 38, 30, 31.5, { sw: W2 });
		iso.seg([xc - 12, y0 + 32, 31.5], [xc + 12, y0 + 32, 31.5]);
		iso.close();
		roll = iso.delta(-9, 22);
		chair(iso, xc - 4, y0 + 69, "y", part, roll);
		monitorTop = iso.P(xc, y0 + 13, 80);
	}
	return { monitorTop, roll };
}

function screenFace(iso: Iso, who: PersonKey, part: string) {
	return `${gradientRect(iso, who, 2, 2, 58, 36, 1.5)}<g data-part="screen-${part}">${screenWindow()}</g><rect class="s-struct" x="2" y="2" width="58" height="36" rx="1.5" fill="none" stroke-width="${W2}" vector-effect="non-scaling-stroke"/>`;
}

function chair(iso: Iso, cx: number, cy: number, facing: Facing, part: string, roll: Pt) {
	const b = iso.box.bind(iso);
	iso.open(`data-part="chair-${part}" data-roll="${f(roll[0])} ${f(roll[1])}"`);
	b(cx - 1, cx + 1, cy - 1, cy + 1, 0, 16, { sw: W2 });
	b(cx - 8, cx + 8, cy - 8, cy + 8, 16, 19);
	if (facing === "x") b(cx + 6, cx + 9, cy - 8, cy + 8, 19, 34);
	else b(cx - 8, cx + 8, cy + 6, cy + 9, 19, 34);
	iso.close();
}

/**
 * A person's desk on its own floor tile, `data-part="isl-<part>"`, centred on
 * (cx, cy). With `props`, a plant stands on the tile's `plant` corner (keep it
 * away from the tile's links; "none" leaves the floor bare) and a mug or a
 * succulent sits on the desk. `half` is the tile's half side: DESK_TILE, or
 * down to 48 for tight phone layouts, which leaves no room for the plant.
 */
export function deskTile(
	iso: Iso,
	cx: number,
	cy: number,
	who: PersonKey,
	{
		facing = "y" as Facing,
		part = who as string,
		props = true,
		plant: corner = "left" as "left" | "right" | "none",
		desktop = "mug" as "mug" | "succulent",
		half = DESK_TILE,
	} = {},
) {
	let t: Tile | undefined;
	let d: Desk | undefined;
	iso.group(`data-part="isl-${part}"`, () => {
		t = tile(iso, cx, cy, half, half);
		if (props) {
			if (corner === "left") plant(iso, cx - half + 14, cy + half - 14);
			else if (corner === "right") plant(iso, cx + half - 14, cy - half + 14);
		}
		d = desk(iso, cx, cy, who, { facing, part });
		if (props) {
			const [x, y] = facing === "y" ? [cx - 20, cy - 2.5] : [cx - 2.5, cy + 20];
			if (desktop === "succulent") succulent(iso, x, y);
			else mug(iso, x, y);
		}
	});
	return { tile: t!, desk: d! };
}

/** A mug on a desk top (z 30). */
function mug(iso: Iso, x: number, y: number) {
	iso.cylinder(x, y, 3.6, 30, 38, { sw: W2 });
}

/** A small succulent in a pot on a desk top. */
function succulent(iso: Iso, x: number, y: number) {
	const pot = iso.cylinder(x, y, 4.2, 30, 36, { sw: W2 });
	const k = iso.k;
	for (const [dx, h, lean] of [
		[-2.6, 7, -0.5],
		[2.4, 8, 0.45],
		[0, 10, 0],
	] as const) {
		const bx = pot.cx + dx * k;
		const by = pot.top;
		const tx = bx + lean * h * 0.6 * k;
		const ty = by - h * k;
		iso.add(
			`<path class="f-top s-struct" d="M${f(bx - 2 * k)} ${f(by)} Q${f(bx - 2.4 * k)} ${f(by - h * 0.6 * k)} ${f(tx)} ${f(ty)} Q${f(bx + 2.4 * k)} ${f(by - h * 0.6 * k)} ${f(bx + 2 * k)} ${f(by)} Z" stroke-width="${W2}" stroke-linejoin="round"/>`,
		);
	}
}

/** A floor plant: a pot and upright leaves. */
function plant(iso: Iso, x: number, y: number, { r = 8, potH = 16, leafH = 44 } = {}) {
	const k = iso.k;
	const pot = iso.cylinder(x, y, r, 0, potH);
	const soil = r * 0.78;
	iso.add(`<ellipse class="f-fx s-struct" cx="${f(pot.cx)}" cy="${f(pot.top)}" rx="${f(soil * Math.SQRT2 * 0.866 * k)}" ry="${f(soil * Math.SQRT2 * 0.5 * k)}" stroke-width="${W2}"/>`);
	const leaves = [
		[-0.55, 0.78, -0.16],
		[0.5, 0.86, 0.14],
		[-0.2, 1, -0.05],
		[0.15, 0.7, 0.2],
		[-0.62, 0.55, -0.3],
		[0.66, 0.6, 0.32],
	] as const;
	for (const [dx, hh, lean] of leaves) {
		const bx = pot.cx + dx * pot.rx * 0.7;
		const by = pot.top + 1;
		const h = leafH * hh * k;
		const tx = bx + lean * h * 0.35;
		const ty = by - h;
		const w = r * 0.42 * k;
		iso.add(
			`<path class="f-top s-struct" d="M${f(bx - w)} ${f(by)} C${f(bx - w)} ${f(by - h * 0.45)} ${f(tx - 1)} ${f(ty + h * 0.25)} ${f(tx)} ${f(ty)} C${f(tx + 1)} ${f(ty + h * 0.25)} ${f(bx + w)} ${f(by - h * 0.45)} ${f(bx + w)} ${f(by)} Z" stroke-width="${W1}" stroke-linejoin="round"/>`,
		);
		iso.add(`<path class="s-detail" d="M${f(bx)} ${f(by - 2)} Q${f(bx + (tx - bx) * 0.4)} ${f(by - h * 0.5)} ${f(tx)} ${f(ty + 4)}" fill="none" stroke-width="${W2}"/>`);
	}
}

// ---------- Infrastructure ----------

export interface Thing {
	/** Screen point at the top centre of the object. */
	top: Pt;
}

/**
 * A server: a rack of `units` units on a plinth. `data-part="<part>-leds"`
 * holds one status light per unit; set --led on it to light them.
 */
export function server(iso: Iso, x: number, y: number, { w = 40, h = 58, units = 3, part = "server" } = {}): Thing {
	iso.open(`data-part="${part}"`);
	const x0 = x - w / 2;
	const y0 = y - w / 2;
	const x1 = x + w / 2;
	const y1 = y + w / 2;
	iso.box(x0, x1, y0, y1, 0, 4, { sw: W2 });
	iso.box(x0 + 1, x1 - 1, y0 + 1, y1 - 1, 4, h);
	const uh = (h - 4) / units;
	for (let i = 1; i < units; i++) {
		const z = 4 + uh * i;
		iso.seg([x0 + 1, y1 - 1, z], [x1 - 1, y1 - 1, z], "s-struct", W2);
		iso.seg([x1 - 1, y1 - 1, z], [x1 - 1, y0 + 1, z], "s-struct", W2);
	}
	const leds: string[] = [];
	for (let i = 0; i < units; i++) {
		const zMid = 4 + uh * i + uh / 2;
		iso.add(`<g transform="${iso.planeY(y1 - 1, x0 + 1, zMid + 3)}">`);
		for (let v = 0; v < 4; v++) iso.add(`<path class="s-detail" d="M${5 + v * 4} 0 V6" stroke-width="${W1}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`);
		iso.add(`</g>`);
		leds.push(`<g transform="${iso.planeY(y1 - 1, x0 + 1, zMid + 3)}"><circle class="f-led" cx="${w - 8}" cy="3" r="1.7"/></g>`);
		iso.add(`<g transform="${iso.planeX(x1 - 1, y1 - 1, zMid + 2)}"><path class="s-detail" d="M5 2 H${w - 8}" stroke-width="${W2}" vector-effect="non-scaling-stroke"/></g>`);
	}
	iso.add(`<g data-part="${part}-leds">${leds.join("")}</g>`);
	iso.close();
	return { top: iso.P(x, y, h) };
}

/**
 * The EmDash room: two walls with the mark on the back one, and the shared
 * document on its floor. Sits on a tile of the same size or larger.
 */
export function room(iso: Iso, x: number, y: number, mark: { ring: string; bar: string }, { size = 72, wall = 40, part = "room", doc = true } = {}): Thing {
	iso.open(`data-part="${part}"`);
	const x0 = x - size / 2;
	const y0 = y - size / 2;
	const x1 = x + size / 2;
	const y1 = y + size / 2;
	const tw = 4;
	iso.face([[x0 - tw, y1, 0], [x1, y1, 0], [x1, y1, -4], [x0 - tw, y1, -4]], "f-fy");
	iso.face([[x1, y0 - tw, 0], [x1, y1, 0], [x1, y1, -4], [x1, y0 - tw, -4]], "f-fx");
	iso.face([[x0 - tw, y0 - tw, 0], [x1, y0 - tw, 0], [x1, y1, 0], [x0 - tw, y1, 0]], "f-room");
	for (let i = 1; i < 4; i++) {
		const g = (size / 4) * i;
		iso.seg([x0 + g, y0, 0], [x0 + g, y1, 0], "s-roomgrid");
		iso.seg([x0, y0 + g, 0], [x1, y0 + g, 0], "s-roomgrid");
	}
	iso.face([[x0, y0, 0], [x0, y1, 0], [x0, y1, wall], [x0, y0, wall]], "f-wallx");
	iso.face([[x0, y0, 0], [x1, y0, 0], [x1, y0, wall], [x0, y0, wall]], "f-wally");
	iso.face([[x0 - tw, y1, 0], [x0, y1, 0], [x0, y1, wall], [x0 - tw, y1, wall]], "f-fy");
	iso.face([[x1, y0 - tw, 0], [x1, y0, 0], [x1, y0, wall], [x1, y0 - tw, wall]], "f-fx");
	iso.face([[x0 - tw, y0 - tw, wall], [x1, y0 - tw, wall], [x1, y0, wall], [x0, y0, wall], [x0, y1, wall], [x0 - tw, y1, wall]], "f-top");
	const m = Math.min(28, wall - 10);
	const k = m / 118;
	const mx = x0 + (size - m) / 2;
	const mz = wall - (wall - m) / 2 + 1;
	iso.open(`data-part="${part}-mark"`);
	for (let d = 0; d < 2.4; d += 0.4) iso.add(`<g transform="${iso.planeY(y0 + d, mx, mz)}"><g transform="scale(${f(k)})">${markShape(mark.ring, mark.bar)}</g></g>`);
	iso.add(`<g opacity="0.32">`);
	for (let d = 0; d < 2.4; d += 0.4) iso.add(`<g transform="${iso.planeY(y0 + d, mx, mz)}"><g transform="scale(${f(k)})">${markShape("#000", "#000")}</g></g>`);
	iso.add(`</g>`);
	iso.add(`<g transform="${iso.planeY(y0 + 2.4, mx, mz)}"><g transform="scale(${f(k)})">${markShape(mark.ring, mark.bar, `class="s-struct" stroke-width="${W2}" vector-effect="non-scaling-stroke"`)}</g></g>`);
	iso.close();
	if (doc) {
		iso.open(`data-part="${part}-doc"`);
		const px0 = x0 + 16;
		const py0 = y0 + 16;
		const pw = 38;
		const pd = 42;
		iso.face([[px0, py0 + pd, 0], [px0 + pw, py0 + pd, 0], [px0 + pw, py0 + pd, 3], [px0, py0 + pd, 3]], "f-paperY", "s-hero", W2);
		iso.face([[px0 + pw, py0, 0], [px0 + pw, py0 + pd, 0], [px0 + pw, py0 + pd, 3], [px0 + pw, py0, 3]], "f-paperX", "s-hero", W2);
		iso.face([[px0, py0, 3], [px0 + pw, py0, 3], [px0 + pw, py0 + pd, 3], [px0, py0 + pd, 3]], "f-paper", "s-hero", W1);
		iso.add(`<g transform="${iso.planeZ(3, px0, py0)}" stroke-linecap="round">`);
		iso.add(`<path class="s-hero" d="M6 8 H22" stroke-width="2" vector-effect="non-scaling-stroke"/>`);
		for (const [v, len] of [
			[16, 26],
			[22, 22],
			[28, 16],
			[35, 24],
		] as const)
			iso.add(`<path class="s-content" d="M6 ${v} h${len}" stroke-width="${W1}" vector-effect="non-scaling-stroke"/>`);
		iso.add(`</g>`);
		iso.close();
	}
	iso.close();
	return { top: iso.P(x0, y0, wall) };
}

/**
 * A round badge floating at a world point, with a crescent moon: an object
 * that sleeps between messages (a hibernating Durable Object). Hidden until a
 * scene shows it: `data-part="<part>"`, whose own transform scales it about
 * its centre.
 */
export function sleepBadge(iso: Iso, x: number, y: number, z: number, { part = "sleep", r = 11 } = {}) {
	const [cx, cy] = iso.P(x, y, z);
	const moon = `<path class="i-moon" d="M-0.6 -5.97 A6 6 0 1 0 5.76 1.67 A5 5 0 0 1 -0.6 -5.97 Z"/>`;
	const k = r / 11;
	iso.add(`<g transform="translate(${f(cx)} ${f(cy)})"><g class="i-sleep" data-part="${part}" style="opacity:0;visibility:hidden"><circle r="${r}"/><g transform="scale(${f(k)})">${moon}</g></g></g>`);
	return { at: [cx, cy] as Pt };
}

/**
 * A database: three stacked platters. `data-part="<part>-flash"` is a copy of
 * the top platter's lid; give it a fill and opacity to flash it on a write.
 */
export function database(iso: Iso, x: number, y: number, { r = 22, part = "db" } = {}): Thing {
	iso.open(`data-part="${part}"`);
	let lid = { cx: 0, top: 0, rx: 0, ry: 0, bottom: 0 };
	for (const [z0, z1] of [
		[0, 12],
		[15, 27],
		[30, 42],
	] as const)
		lid = iso.cylinder(x, y, r, z0, z1);
	iso.add(`<ellipse data-part="${part}-flash" class="i-flash" cx="${f(lid.cx)}" cy="${f(lid.top)}" rx="${f(lid.rx)}" ry="${f(lid.ry)}"/>`);
	iso.close();
	return { top: [lid.cx, lid.top - lid.ry] };
}

/** Content save: a gate edits pass through, with a light per check on its lintel. Lights are `data-part="<part>-light-<i>"`. */
export function gate(iso: Iso, x: number, y: number, { part = "gate", lights = 4, span = 24, h = 44 } = {}): Thing {
	iso.open(`data-part="${part}"`);
	const d = 7;
	iso.box(x - span - 4, x - span + 4, y - d, y + d, 0, h);
	iso.box(x + span - 4, x + span + 4, y - d, y + d, 0, h);
	iso.box(x - span - 6, x + span + 6, y - d - 2, y + d + 2, h, h + 10);
	iso.add(`<g transform="${iso.planeY(y + d + 2, x - span - 6, h + 10)}">`);
	const len = span * 2 + 12;
	for (let i = 0; i < lights; i++) {
		const u = (len / (lights + 1)) * (i + 1);
		iso.add(`<circle data-part="${part}-light-${i}" class="f-led s-struct" cx="${f(u)}" cy="5" r="2.4" stroke-width="${W2}" vector-effect="non-scaling-stroke"/>`);
	}
	iso.add(`</g>`);
	iso.close();
	return { top: iso.P(x, y, h + 10) };
}

/** An agent: a small machine with a face, an antenna and a status light. */
export function agent(iso: Iso, x: number, y: number, { part = "agent", s = 16 } = {}): Thing {
	iso.open(`data-part="${part}"`);
	iso.box(x - s, x + s, y - s, y + s, 0, 4, { sw: W2 });
	iso.box(x - s + 3, x + s - 3, y - s + 3, y + s - 3, 4, 34);
	iso.add(`<g transform="${iso.planeY(y + s - 3, x - s + 3, 30)}">`);
	const w = (s - 3) * 2;
	iso.add(`<rect class="f-glass" x="4" y="4" width="${w - 8}" height="16" rx="2.5"/>`);
	iso.add(`<circle cx="${f(w / 2 - 5.5)}" cy="12" r="2.1" fill="#fff"/><circle cx="${f(w / 2 + 5.5)}" cy="12" r="2.1" fill="#fff"/>`);
	iso.add(`</g>`);
	const [ax, ay] = iso.P(x, y, 34);
	iso.add(`<path class="s-struct" d="M${f(ax)} ${f(ay)} V${f(ay - 11 * iso.k)}" stroke-width="${W1}"/>`);
	iso.add(`<circle data-part="${part}-light" class="f-top s-struct" cx="${f(ax)}" cy="${f(ay - 13.4 * iso.k)}" r="${f(2.6 * iso.k)}" stroke-width="${W1}"/>`);
	iso.close();
	return { top: iso.P(x, y, 48) };
}

/**
 * A floor plate that is a server: a thick tile with drive bays on its long
 * face and a status light per bay, for things that run inside one machine.
 * `data-part="<part>-leds"` holds the lights; set --led on it to light them.
 */
export function chassis(iso: Iso, cx: number, cy: number, hx: number, hy = hx, { part = "chassis", t = 18, grid = 23, bays = 3 } = {}): Tile {
	const x0 = cx - hx;
	const x1 = cx + hx;
	const y0 = cy - hy;
	const y1 = cy + hy;
	iso.open(`data-part="${part}"`);
	iso.floor(x0, x1, y0, y1, { t, grid });
	const long = x1 - x0;
	const bay = Math.min(30, (long - 24) / (bays + 2));
	const leds: string[] = [];
	iso.add(`<g transform="${iso.planeY(y1, x0, 0)}" fill="none" stroke-linecap="round">`);
	for (let i = 0; i < bays; i++) {
		const u = 10 + i * (bay + 6);
		iso.add(`<rect class="s-detail" x="${f(u)}" y="4" width="${f(bay)}" height="${f(t - 8)}" rx="1.5" stroke-width="${W2}" vector-effect="non-scaling-stroke"/>`);
		for (let v = 0; v < 3; v++) iso.add(`<path class="s-detail" d="M${f(u + 5 + v * 3)} 7.5 V${f(t - 7.5)}" stroke-width="${W2}" vector-effect="non-scaling-stroke"/>`);
		leds.push(`<circle class="f-led" cx="${f(u + bay - 5)}" cy="${f(t / 2)}" r="1.7"/>`);
	}
	iso.add(`<g data-part="${part}-leds">${leds.join("")}</g>`);
	for (let v = 0; v < 6; v++) iso.add(`<path class="s-detail" d="M${f(long - 12 - v * 4)} 6 V${f(t - 6)}" stroke-width="${W2}" vector-effect="non-scaling-stroke"/>`);
	iso.add(`</g>`);
	iso.add(`<g transform="${iso.planeX(x1, y1, 0)}" fill="none" stroke-linecap="round">`);
	for (let v = 0; v < 5; v++) iso.add(`<path class="s-detail" d="M${f(10 + v * 4)} 6 V${f(t - 6)}" stroke-width="${W2}" vector-effect="non-scaling-stroke"/>`);
	iso.add(`</g>`);
	iso.close();
	return tileAt(iso, x0, x1, y0, y1, t);
}
