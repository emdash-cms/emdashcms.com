/**
 * Figure 2's scene, drawn once per width on the server. Matt's, Noah's and
 * Ana's desks in a row at the back, their links meeting in the EmDash room;
 * Content save, the database and an agent over MCP in front of it.
 *
 * On Cloudflare the room has a tile of its own and sleeps between messages;
 * on Node.js the room and Content save stand on one server, the site's.
 */
import { PEOPLE, type PersonKey } from "./kit/cast";
import {
	agent,
	type Bar,
	type Block,
	browserWindow,
	chassis,
	checklist,
	type Composition,
	database,
	DESK_TILE as DESK,
	docHTML,
	deskTile,
	fo,
	gate,
	Iso,
	label,
	link,
	markDef,
	markDefs,
	packetLayer,
	type Pt,
	room,
	sleepBadge,
	stem,
	tile,
	type Tile,
} from "./kit/iso";
import { EDITORS, TEXT } from "./how-the-parts-fit";

type Editor = (typeof EDITORS)[number];

const OTHERS: Record<Editor, PersonKey[]> = { matt: ["noah", "ana"], noah: ["matt", "ana"], ana: ["noah", "matt"] };
const SAVE = ["saved", "save"] as const;
const CHECKS = ["Permissions", "Validation", "Hooks", "Revisions"];

/** Half sizes of the floor tiles, in world units. */
const HUB = 46;
const SMALL = 34.5;
const DB = 40;

function editorDoc(who: PersonKey): Block[] {
	const caret = who === "noah" ? { caret: "noah-local", who: "noah" as const, local: true } : { caret: `noah-at-${who}`, who: "noah" as const };
	return [
		{ title: [TEXT.title] },
		{ p: [TEXT.body] },
		{ p: [{ run: `${who}-typed`, text: TEXT.typed, who: "noah", tint: "on", typed: true, caret }], id: "added" },
		{ field: TEXT.excerptLabel, text: [{ run: `${who}-excerpt`, text: TEXT.excerpt, tint: "off", typed: true }] },
	];
}

/** What the agent writes, in a field like the editors' excerpt. */
const agentSays = () => `<div class="hpf-say" data-part="say"><span class="iw-field-box">${docHTML([{ p: [{ run: "agent-excerpt", text: TEXT.excerpt, typed: true, tint: "off" }] }])}</span></div>`;

/** The phone's small windows: the same document as bars, Noah's words in his colour and the excerpt in the agent's ink. */
function barDoc(who: PersonKey): Block[] {
	const typed: Bar = { w: 58, who: "noah", id: `${who}-typed`, typed: true };
	return [{ bars: [{ w: 62 }], title: true }, { bars: [{ w: 84 }] }, { bars: [typed] }, { fieldBars: "", bars: [{ w: 64, id: `${who}-excerpt`, typed: true }] }];
}

interface Placed {
	desks: Record<Editor, { tile: Tile; desk: { monitorTop: Pt } }>;
	room: Tile;
	gate: Tile;
	db: Tile;
	agent: Tile;
}

/** Where the room's sleep badge floats, in world units with its height, and its radius. */
type Badge = readonly [number, number, number, number];

/**
 * The scene, in world units around the room at (0, 0). The desks are at
 * (-p, 0), (-p/2, -p/2) and (0, -p): one row on screen, Noah's straight
 * behind the room. Content save is in front of the room on the right at
 * (g, 0), the database below it at (g, g), the agent behind it at (g, -a).
 * The room's save turns at Content save; the agent's write runs straight
 * through it; the database notifies the room straight up.
 */
function draw(iso: Iso, p: number, g: number, a: number, small: boolean, badge: Badge): Placed {
	const mark = markDefs(iso);
	const noahMark = markDef(iso, "noah", small ? 10 : 12);
	iso.add(`<g data-noah-mark="${noahMark}"></g>`);

	const half = small ? 48 : DESK;
	const matt = deskTile(iso, -p, 0, "matt", { facing: "x", props: !small, plant: "left", desktop: "succulent", half });
	const noah = deskTile(iso, -p / 2, -p / 2, "noah", { facing: "y", props: !small, plant: "none", half });
	const ana = deskTile(iso, 0, -p, "ana", { facing: "y", props: !small, plant: "right", half });

	// Floors. On Cloudflare the room is an island of its own; on Node.js it shares the site's server with Content save.
	let roomTile: Tile | undefined;
	let gateTile: Tile | undefined;
	iso.add(`<g data-mode-only="cloudflare">`);
	iso.group(`data-part="isl-room"`, () => {
		roomTile = tile(iso, 0, 0, HUB, HUB);
	});
	iso.group(`data-part="isl-gate"`, () => {
		gateTile = tile(iso, g, 0, SMALL, SMALL);
	});
	iso.add(`</g><g data-mode-only="node" style="display:none">`);
	chassis(iso, (g + SMALL - HUB) / 2, 0, (g + SMALL + HUB) / 2, HUB, { part: "isl-site", t: small ? 22 : 18 });
	iso.add(`</g>`);
	let agentTile: Tile | undefined;
	iso.group(`data-part="isl-agent"`, () => {
		agentTile = tile(iso, g, -a, SMALL, SMALL);
	});
	let dbTile: Tile | undefined;
	iso.group(`data-part="isl-db"`, () => {
		dbTile = tile(iso, g, g, DB, DB);
	});

	// Links that end behind something tall: the room's walls, the gate, the database.
	iso.add(link(iso, { id: "matt", path: [[-p + half, 0], [-HUB, 0]] }));
	iso.add(link(iso, { id: "noah", path: [[-p / 2 + half, -p / 2 + half], [-HUB, -HUB]] }));
	iso.add(link(iso, { id: "ana", path: [[0, -p + half], [0, -HUB]] }));
	iso.add(link(iso, { id: "save", path: [[HUB, 0], [g - SMALL, 0]] }));
	iso.add(link(iso, { id: "agent", path: [[g, -a + SMALL], [g, -SMALL]] }));
	iso.add(link(iso, { id: "notify", path: [[g - DB, g - DB], [HUB, HUB]] }));
	iso.add(packetLayer("back"));

	// Objects, back to front.
	iso.group(`data-part="obj-room"`, () => {
		room(iso, 0, 0, mark, { size: 72, wall: 40, part: "room" });
	});
	agent(iso, g, -a, { part: "agent" });
	gate(iso, g, 0, { part: "gate" });
	iso.add(link(iso, { id: "write", path: [[g, SMALL], [g, g - DB]] }));
	database(iso, g, g, { part: "db" });
	iso.add(packetLayer("front"));
	iso.add(`<g data-mode-only="cloudflare">`);
	sleepBadge(iso, badge[0], badge[1], badge[2], { part: "room-sleep", r: badge[3] });
	iso.add(`</g>`);

	return { desks: { matt, noah, ana }, room: roomTile!, gate: gateTile!, db: dbTile!, agent: agentTile! };
}

/** The world distance p that puts the desks `s` px apart on screen. */
const spacing = (s: number, k: number) => s / (Math.cos(Math.PI / 6) * k);

/** The y at which the room's centre lands so the desks' monitors sit `top` px down the composition. */
function roomY(p: number, k: number, top: number) {
	const monitor = new Iso(0, 0, k).P(-p / 2, -p / 2 - 42.5 + 13, 80)[1];
	return top - monitor;
}

interface Dims {
	W: number;
	k: number;
	/** How far apart the desks sit on screen, in px. */
	s: number;
	/** How far Content save sits from the room, in world units. */
	g: number;
	win: { w: number; h: number };
	gap: number;
	checks: { w: number; h: number };
	/** The width of the agent's field. */
	say: number;
}

const DIMS: Record<"lg" | "md", Dims> = {
	lg: { W: 872, k: 0.72, s: 206, g: 134, win: { w: 264, h: 254 }, gap: 24, checks: { w: 200, h: 60 }, say: 152 },
	md: { W: 632, k: 0.58, s: 164, g: 140, win: { w: 198, h: 226 }, gap: 18, checks: { w: 184, h: 60 }, say: 128 },
};

/** Wide: three windows in a row over the three desks, the room under Noah's, the save path in front of it. */
function wide(size: "lg" | "md"): Composition {
	const D = DIMS[size];
	const { W, k, g } = D;
	const p = spacing(D.s, k);
	const cardTop = 2;
	const iso = new Iso(W / 2, roomY(p, k, cardTop + D.win.h + D.gap), k);
	const placed = draw(iso, p, g, g, false, [14, -34, 76, 11]);

	const flat: string[] = [];
	const xs: Record<Editor, number> = { matt: 0, noah: (W - D.win.w) / 2, ana: W - D.win.w };
	for (const who of EDITORS) {
		const m = placed.desks[who].desk.monitorTop;
		flat.push(stem(m[0], cardTop + D.win.h, m[1], `stem-${who}`, PEOPLE[who].caret));
		flat.push(fo(xs[who], cardTop, D.win.w, D.win.h, browserWindow({ who, size, doc: editorDoc(who), presence: OTHERS[who], save: SAVE }), `card-${who}`));
	}

	const roomLeft = placed.room.under("left");
	flat.push(label(roomLeft[0] - 12, roomLeft[1] - 10, "EmDash room", { anchor: "end", part: "label-room" }));
	const agentRight = placed.agent.under("right");
	const sayX = Math.min(agentRight[0] + 12, W - D.say);
	flat.push(label(sayX, agentRight[1] - 26, "Agent over MCP", { anchor: "start", part: "label-agent" }));
	flat.push(fo(sayX, agentRight[1] - 12, D.say, 32, agentSays(), "card-say"));
	const gateRight = placed.gate.under("right");
	const cy = gateRight[1] - 6;
	flat.push(fo(gateRight[0] + 16, cy, D.checks.w, D.checks.h, checklist("Content save", CHECKS, { part: "checks", ticks: true }), "card-checks"));

	const dbFront = placed.db.under("front");
	const H = Math.ceil(Math.max(dbFront[1], cy + D.checks.h) + 4);
	return { size, W, H, svg: `${iso}${flat.join("")}` };
}

/**
 * Narrow: Noah's window across the top in real words, Matt's and Ana's below
 * it as bars, with Noah's stem between them; the desks and the save path
 * under them, and at the foot what Content save checks and what the agent
 * writes.
 */
function narrow(): Composition {
	const W = 302;
	const k = 0.46;
	const p = spacing(96, k);
	const noahWin = { w: W, h: 226 };
	const small = { w: 128, h: 124 };
	const row2 = 2 + noahWin.h + 12;
	const iso = new Iso(W / 2, roomY(p, k, row2 + small.h + 16), k);
	const placed = draw(iso, p, 134, 134, true, [20, -85, 50, 8]);

	const flat: string[] = [];
	const nm = placed.desks.noah.desk.monitorTop;
	flat.push(stem(nm[0], 2 + noahWin.h, nm[1], "stem-noah", PEOPLE.noah.caret));
	flat.push(fo(0, 2, noahWin.w, noahWin.h, browserWindow({ who: "noah", size: "md", doc: editorDoc("noah"), presence: OTHERS.noah, save: SAVE }), "card-noah"));
	for (const who of ["matt", "ana"] as const) {
		const m = placed.desks[who].desk.monitorTop;
		flat.push(stem(m[0], row2 + small.h, m[1], `stem-${who}`, PEOPLE[who].caret));
		flat.push(fo(who === "matt" ? 0 : W - small.w, row2, small.w, small.h, browserWindow({ who, size: "sm", doc: barDoc(who), presence: OTHERS[who], save: SAVE }), `card-${who}`));
	}

	const roomLeft = placed.room.under("left");
	flat.push(label(roomLeft[0] - 8, roomLeft[1] - 10, "EmDash room", { anchor: "end", part: "label-room" }));
	const foot = placed.db.under("front")[1] + 20;
	const col = 142;
	flat.push(fo(0, foot, col, 100, checklist("Content save", CHECKS, { part: "checks", ticks: true }), "card-checks"));
	flat.push(label(W - col, foot + 8, "Agent over MCP", { anchor: "start", part: "label-agent" }));
	flat.push(fo(W - col, foot + 24, col, 32, agentSays(), "card-say"));
	return { size: "sm", W, H: Math.ceil(foot + 100), svg: `${iso}${flat.join("")}` };
}

export function compose(): Composition[] {
	return [wide("lg"), wide("md"), narrow()];
}
