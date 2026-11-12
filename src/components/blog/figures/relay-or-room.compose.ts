/**
 * Figure 1's scene, drawn once per width on the server. Ana's and Noah's
 * desks, the hub their links meet in (a server, or the EmDash room), and the
 * database with the stored version over it.
 *
 * Wide (lg, md): the desks and the hub sit in one row, the database behind
 * the hub, and saves travel up into the stored version at the top. Narrow
 * (sm): the desks sit at the back under their windows, and saves travel down
 * to the stored version at the foot.
 */
import { PEOPLE } from "./kit/cast";
import {
	type Block,
	browserWindow,
	type Composition,
	database,
	DESK_TILE as DESK,
	deskTile,
	fo,
	Iso,
	label,
	link,
	markDefs,
	modeOnly,
	packetLayer,
	type Pt,
	room,
	server,
	stem,
	storedCard,
	type Tile,
	tile,
} from "./kit/iso";
import { TEXT } from "./relay-or-room";

const SAVE = ["saved", "save", "saving", "offline"] as const;

function anaDoc(): Block[] {
	return [
		{ title: [TEXT.title] },
		{ p: [TEXT.lead, { run: "ana-whole", text: TEXT.whole, who: "ana", tint: "off", typed: true, caret: { caret: "ana-local", who: "ana", local: true } }, TEXT.rest, { caret: "noah-at-ana", who: "noah", hang: true }] },
		{ p: [{ run: "ana-sentence", text: TEXT.sentence, who: "ana", tint: "on", typed: true, caret: { caret: "ana-local-2", who: "ana", local: true } }] },
	];
}

function noahDoc(): Block[] {
	return [
		{ title: [TEXT.title] },
		{
			p: [
				TEXT.lead,
				{ run: "noah-whole", text: TEXT.whole, who: "ana", tint: "off", typed: true, caret: { caret: "ana-at-noah", who: "ana" } },
				TEXT.rest,
				{ caret: "noah-local-0", who: "noah", local: true },
				" ",
				{ run: "noah-offline", text: TEXT.offline, who: "noah", tint: "on", typed: true, caret: { caret: "noah-local", who: "noah", local: true } },
			],
		},
		{ p: [{ run: "noah-sentence", text: TEXT.sentence, who: "ana", tint: "on", typed: true }] },
	];
}

function storedDoc(): Block[] {
	return [
		{ title: [TEXT.title] },
		{
			p: [
				TEXT.lead,
				{ run: "store-whole", text: TEXT.whole, who: "ana", tint: "off", typed: true },
				`${TEXT.rest} `,
				{ run: "store-offline", text: TEXT.offline, who: "noah", tint: "on", typed: true },
			],
		},
		{ p: [{ run: "store-sentence", text: TEXT.sentence, who: "ana", tint: "on", typed: true, lost: true }] },
	];
}

/** The phone's windows: the same document as bars, each person's words in their colour. */
function barDoc(who: "ana" | "noah"): Block[] {
	const whole = { w: 14, who: "ana" as const, id: `${who}-whole`, typed: true };
	if (who === "ana") {
		return [
			{ bars: [{ w: 56 }], title: true },
			{ bars: [{ w: 46 }, { w: 18 }, whole] },
			{ bars: [] },
			{ bars: [{ w: 72, who: "ana", id: "ana-sentence", typed: true }] },
		];
	}
	return [
		{ bars: [{ w: 56 }], title: true },
		{ bars: [{ w: 46 }, { w: 18 }, whole] },
		{ bars: [{ w: 40, who: "noah", id: "noah-offline", typed: true }] },
		{ bars: [{ w: 72, who: "ana", id: "noah-sentence", typed: true }] },
	];
}

interface Dims {
	W: number;
	k: number;
	/** How far each desk sits from the hub along the row, and the database behind it, in world units. */
	q: number;
	b: number;
	win: { w: number; h: number };
	stored: { w: number; h: number };
	gap: number;
	props: boolean;
}

const DIMS: Record<"lg" | "md", Dims> = {
	lg: { W: 872, k: 0.92, q: 166, b: 192, win: { w: 264, h: 206 }, stored: { w: 272, h: 136 }, gap: 16, props: true },
	md: { W: 632, k: 0.68, q: 168, b: 198, win: { w: 198, h: 196 }, stored: { w: 204, h: 140 }, gap: 12, props: true },
};

const HUB = 46;
const DB = 40;

/** The hub's tile with both hubs on it: the server when browsers save, the EmDash room when the room saves. */
function hub(iso: Iso, mark: { ring: string; bar: string }) {
	let t: Tile | undefined;
	iso.group(`data-part="isl-hub"`, () => {
		t = tile(iso, 0, 0, HUB, HUB);
		iso.add(`<g data-mode-only="browsers">`);
		server(iso, 0, 0, { part: "server" });
		iso.add(`</g><g data-mode-only="room" style="display:none">`);
		room(iso, 0, 0, mark, { size: 72, wall: 40, part: "room" });
		iso.add(`</g>`);
	});
	return t!;
}

const hubLabels = (x: number, y: number, anchor: "start" | "middle" = "middle") =>
	modeOnly("browsers", label(x, y, "Server", { anchor }), true) + modeOnly("room", label(x, y, "EmDash room", { anchor }));

/**
 * Wide: one row of islands, Ana's desk, the hub and Noah's desk, linked
 * corner to corner, so an update relayed from Ana to Noah runs in one
 * straight line. The database sits behind the hub; the three documents float
 * in a row on top.
 */
function wide(size: "lg" | "md"): Composition {
	const D = DIMS[size];
	const { W, k, q, b, gap } = D;
	const probe = new Iso(0, 0, k);
	const dbLid = probe.P(-b, -b, 42)[1] - 22 * Math.SQRT2 * 0.5 * k;
	const top = dbLid - gap - D.stored.h;
	const iso = new Iso(W / 2, -top + 2, k);
	const mark = markDefs(iso);

	let db: { top: Pt } | undefined;
	iso.group(`data-part="isl-db"`, () => {
		tile(iso, -b, -b, DB, DB);
		db = database(iso, -b, -b, { part: "db" });
	});
	iso.add(link(iso, { id: "store", path: [[-HUB, -HUB, 0], [-b + DB, -b + DB, 0]] }));
	iso.add(packetLayer("back"));
	iso.add(link(iso, { id: "ana", path: [[-q + DESK, q - DESK, 0], [-HUB, HUB, 0]] }));
	iso.add(link(iso, { id: "noah", path: [[q - DESK, -q + DESK, 0], [HUB, -HUB, 0]], badge: "cloudSlash" }));
	const hubTile = hub(iso, mark);
	const ana = deskTile(iso, -q, q, "ana", { facing: "x", props: D.props, plant: "left", desktop: "succulent" });
	const noah = deskTile(iso, q, -q, "noah", { facing: "y", props: D.props, plant: "right" });
	iso.add(packetLayer("front"));

	const flat: string[] = [];
	const cardTop = 2;
	const sx = db!.top[0] - D.stored.w / 2;
	const am = ana.desk.monitorTop;
	const nm = noah.desk.monitorTop;
	// Windows sit over their monitors where they can, and clear the stored version by at least `edge`.
	const edge = 20;
	const ax = Math.min(Math.max(0, am[0] - D.win.w / 2), sx - edge - D.win.w);
	const nx = Math.max(Math.min(W - D.win.w, nm[0] - D.win.w / 2), sx + D.stored.w + edge);
	flat.push(stem(db!.top[0], cardTop + D.stored.h, db!.top[1], "stem-stored"));
	flat.push(stem(am[0], cardTop + D.win.h, am[1], "stem-ana", PEOPLE.ana.caret));
	flat.push(stem(nm[0], cardTop + D.win.h, nm[1], "stem-noah", PEOPLE.noah.caret));
	flat.push(fo(sx, cardTop, D.stored.w, D.stored.h, storedCard({ doc: storedDoc(), size, outcomes: ["lost", "kept"] }), "card-stored"));
	flat.push(fo(ax, cardTop, D.win.w, D.win.h, browserWindow({ who: "ana", size, doc: anaDoc(), presence: ["noah"], save: SAVE, closable: true }), "card-ana"));
	flat.push(fo(nx, cardTop, D.win.w, D.win.h, browserWindow({ who: "noah", size, doc: noahDoc(), presence: ["ana"], save: SAVE }), "card-noah"));
	const under = hubTile.under("front");
	flat.push(hubLabels(under[0], under[1] + 18));

	const bottom = Math.max(ana.tile.under("front")[1], noah.tile.under("front")[1], under[1] + 26);
	return { size, W, H: Math.ceil(bottom + 2), svg: `${iso}${flat.join("")}` };
}

/** Narrow: windows on top, desks under them at the back, the hub, the database, the stored version at the foot. */
function narrow(): Composition {
	const W = 302;
	const k = 0.5;
	const win = { w: 142, h: 118 };
	const stored = { h: 132 };
	const gap = 12;
	const p = 232;
	const b = 136;
	const probe = new Iso(0, 0, k);
	const monitorY = probe.P(-p - 42.5 + 13, 0, 80)[1];
	const iso = new Iso(W / 2, win.h + gap + 2 - monitorY, k);
	const mark = markDefs(iso);

	const ana = deskTile(iso, -p, 0, "ana", { facing: "x", props: false });
	const noah = deskTile(iso, 0, -p, "noah", { facing: "y", props: false });
	iso.add(link(iso, { id: "ana", path: [[-p + DESK, 0, 0], [-HUB, 0, 0]] }));
	iso.add(link(iso, { id: "noah", path: [[0, -p + DESK, 0], [0, -HUB, 0]], badge: "cloudSlash" }));
	const hubTile = hub(iso, mark);
	iso.add(link(iso, { id: "store", path: [[HUB, HUB, 0], [b - DB, b - DB, 0]] }));
	iso.add(packetLayer("back"));
	let dbTile: Tile | undefined;
	iso.group(`data-part="isl-db"`, () => {
		dbTile = tile(iso, b, b, DB, DB);
		database(iso, b, b, { part: "db" });
	});
	iso.add(packetLayer("front"));

	const flat: string[] = [];
	const am = ana.desk.monitorTop;
	const nm = noah.desk.monitorTop;
	const a = { x: 0, y: 2, w: win.w, h: win.h };
	const n = { x: W - win.w, y: 2, w: win.w, h: win.h };
	flat.push(stem(am[0], a.y + a.h, am[1], "stem-ana", PEOPLE.ana.caret));
	flat.push(stem(nm[0], n.y + n.h, nm[1], "stem-noah", PEOPLE.noah.caret));
	flat.push(fo(a.x, a.y, a.w, a.h, browserWindow({ who: "ana", size: "sm", doc: barDoc("ana"), presence: ["noah"], save: SAVE, closable: true }), "card-ana"));
	flat.push(fo(n.x, n.y, n.w, n.h, browserWindow({ who: "noah", size: "sm", doc: barDoc("noah"), presence: ["ana"], save: SAVE }), "card-noah"));
	const right = hubTile.under("right");
	flat.push(hubLabels(right[0] + 10, right[1] - 2, "start"));
	const dbFront = dbTile!.under("front");
	const sTop = dbFront[1] + gap;
	flat.push(stem(dbFront[0], sTop, dbFront[1], "stem-stored"));
	flat.push(fo(0, sTop, W, stored.h, storedCard({ doc: storedDoc(), size: "sm", outcomes: ["lost", "kept"] }), "card-stored"));
	return { size: "sm", W, H: Math.ceil(sTop + stored.h + 2), svg: `${iso}${flat.join("")}` };
}

export function compose(): Composition[] {
	return [wide("lg"), wide("md"), narrow()];
}

