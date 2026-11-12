import { all, css, ease, entered, flagAfterMove, PEOPLE, prog, renderCaret, renderPresence, renderRun, type Scene, show, type StatusTrack, typedCount, typingTimes } from "./kit";
import { n } from "./kit/dom";
import {
	IsoLink,
	type IsoPacket,
	IsoPackets,
	landed,
	renderBar,
	renderFlash,
	renderModeOnly,
	renderRise,
	renderSaveButton,
	renderStem,
	renderTick,
	renderTint,
	trip,
	visibleComposition,
} from "./kit/iso/live";
import { EDITORS, info, type ModeId, T, TEXT } from "./how-the-parts-fit";

const NOAH = PEOPLE.noah.caret;
const BRAND = "var(--fig-brand)";
/** Writes from outside the room travel in a neutral ink: no person, no cursor. */
const INK = "var(--hpf-ink)";
const OK = "var(--c-ok)";
/** The checks Content save runs, one light on its gate each. */
const CHECKS = 4;
/** How long a document waits in Content save while its checks run. */
const GATE = 0.62;

const typed = typingTimes(TEXT.typed, T.typing[0], T.typing[1], 11);

type Editor = (typeof EDITORS)[number];
type LinkId = Editor | "save" | "write" | "agent" | "notify";
type Links = Record<LinkId, IsoLink>;

/** A keystroke's update crosses a link in about this long; a whole document takes longer. */
const hop = (l: IsoLink) => 0.14 + l.route.total / 680;
const docHop = (l: IsoLink) => 0.3 + l.route.total / 460;

/** A stretch of time a link is lit: rising at `from`, falling at `until`, its dots marching while packets fly. */
interface Lit {
	from: number;
	until?: number;
	color: string;
	dir: 1 | -1;
	march: readonly [number, number];
}

/** A save passing through Content save: when it arrives, and when it commits. */
interface Pass {
	arrive: number;
	commit: number;
	color: string;
}

interface Plan {
	packets: IsoPacket[];
	/** When Noah's typing reaches Matt's and Ana's editors, a few characters at a time. */
	delivered: Array<{ at: number; chars: number }>;
	passes: [Pass, Pass];
	/** When the merged excerpt lands in each editor. */
	excerpt: Record<Editor, number>;
	/** Stretches the room is awake: on Cloudflare it sleeps in between. */
	awake: Array<readonly [number, number]>;
	/** Packets reaching or leaving the room, for the site server's lights on Node.js. */
	room: Array<{ at: number; color: string }>;
	noah: StatusTrack;
	agent: readonly [number, number];
	lit: Record<LinkId, Lit[]>;
}

const span = (specs: readonly IsoPacket[]): readonly [number, number] => [Math.min(...specs.map((s) => s.t0)), Math.max(...specs.map((s) => s.t0 + s.dur))];

function plan(l: Links, noahMark: string | undefined): Plan {
	const packets: IsoPacket[] = [];
	const room: Plan["room"] = [];
	const steps = info.steps.map((s) => s.at);

	// Step 1: every few keystrokes, Noah's update reaches the room, which passes it on to Matt and Ana.
	const delivered: Plan["delivered"] = [];
	const up: IsoPacket[] = [];
	const out: IsoPacket[] = [];
	for (const chars of [3, 7, 11, 15, 19, TEXT.typed.length]) {
		const sent = typed[chars - 1]! + 0.02;
		const toRoom = { link: l.noah, t0: sent, dur: hop(l.noah), color: NOAH };
		const relay = sent + toRoom.dur + 0.04;
		const toMatt = { link: l.matt, reverse: true, t0: relay, dur: hop(l.matt), color: NOAH };
		const toAna = { link: l.ana, reverse: true, t0: relay, dur: hop(l.ana), color: NOAH };
		up.push(toRoom);
		out.push(toMatt, toAna);
		room.push({ at: relay - 0.04, color: NOAH });
		delivered.push({ at: relay + toMatt.dur, chars });
	}
	packets.push(...up, ...out);

	// Step 2: the room saves as Noah. Its document waits in Content save while the checks run, then commits.
	const saveDur = docHop(l.save);
	const save = trip([{ link: l.save }, { link: l.write }], T.save, { dur: saveDur, color: BRAND, kind: "doc", pause: GATE, mark: noahMark });
	save[1]!.dur = docHop(l.write);
	room.push({ at: T.save, color: BRAND });
	const roomSave: Pass = { arrive: T.save + saveDur, commit: landed(save), color: BRAND };

	// Step 3: an agent writes the excerpt over MCP: the same checks, without the room.
	const agentDur = docHop(l.agent);
	const write = trip([{ link: l.agent }, { link: l.write }], T.agent, { dur: agentDur, color: INK, kind: "doc", pause: GATE });
	write[1]!.dur = docHop(l.write);
	const agentSave: Pass = { arrive: T.agent + agentDur, commit: landed(write), color: INK };
	packets.push(...save, ...write);

	// Step 4: after that commit, the database notifies the room, which merges the change and sends it to every editor.
	const notify: IsoPacket = { link: l.notify, t0: T.notify, dur: hop(l.notify), color: INK };
	const merged = notify.t0 + notify.dur + 0.16;
	room.push({ at: notify.t0 + notify.dur, color: INK });
	const longest = Math.max(...EDITORS.map((id) => hop(l[id])));
	const relays = EDITORS.map((id) => ({ link: l[id], reverse: true, t0: merged + longest - hop(l[id]), dur: hop(l[id]), color: INK }) satisfies IsoPacket);
	const arrived = merged + longest;
	packets.push(notify, ...relays);
	room.push({ at: merged, color: INK });

	const lit: Plan["lit"] = {
		noah: [
			{ from: up[0]!.t0 - 0.15, until: steps[1], color: NOAH, dir: 1, march: span(up) },
			{ from: relays[1]!.t0 - 0.12, color: INK, dir: -1, march: [relays[1]!.t0, arrived] },
		],
		matt: [
			{ from: out[0]!.t0 - 0.15, until: steps[1], color: NOAH, dir: -1, march: span(out) },
			{ from: merged - 0.1, color: INK, dir: -1, march: [merged, arrived] },
		],
		ana: [
			{ from: out[0]!.t0 - 0.15, until: steps[1], color: NOAH, dir: -1, march: span(out) },
			{ from: merged - 0.1, color: INK, dir: -1, march: [merged, arrived] },
		],
		save: [{ from: save[0]!.t0 - 0.15, until: steps[2], color: BRAND, dir: 1, march: [save[0]!.t0, save[0]!.t0 + save[0]!.dur] }],
		write: [
			{ from: save[1]!.t0 - 0.15, until: steps[2], color: BRAND, dir: 1, march: [save[1]!.t0, roomSave.commit] },
			{ from: write[1]!.t0 - 0.15, until: steps[3], color: INK, dir: 1, march: [write[1]!.t0, agentSave.commit] },
		],
		agent: [{ from: write[0]!.t0 - 0.15, until: steps[3], color: INK, dir: 1, march: [write[0]!.t0, write[0]!.t0 + write[0]!.dur] }],
		notify: [{ from: notify.t0 - 0.15, color: INK, dir: 1, march: [notify.t0, notify.t0 + notify.dur] }],
	};

	return {
		packets,
		delivered,
		passes: [roomSave, agentSave],
		excerpt: Object.fromEntries(EDITORS.map((id, i) => [id, landed([relays[i]!])])) as Record<Editor, number>,
		// Awake from Noah's first update through the room's save, asleep while the agent writes, woken by the notification.
		awake: [
			[up[0]!.t0 + up[0]!.dur - 0.06, steps[2]!],
			[notify.t0 + notify.dur - 0.06, Number.POSITIVE_INFINITY],
		],
		room,
		// In a room, Save reads Saved once a save holds the person's edits; the room's saves wait on no one.
		noah: [
			[0, "saved"],
			[T.typing[0], "save"],
			[roomSave.commit + 0.05, "saved"],
		],
		agent: [T.agent - 0.25, agentSave.commit + 0.3],
		lit,
	};
}

/** A link's lit state at t: the strongest of its recent stretches. */
function litAt(spans: readonly Lit[], t: number) {
	let best = { lit: 0, color: "", dir: 1 as 1 | -1, march: 0 };
	for (const s of spans) {
		if (t < s.from) continue;
		let k = ease.out(prog(t, s.from, s.from + 0.25));
		// Once its packets have landed, a lit link settles to a quieter level until it falls.
		k *= 1 - 0.3 * ease.inOut(prog(t, s.march[1] + 0.1, s.march[1] + 0.6));
		if (s.until !== undefined) k *= 1 - ease.inOut(prog(t, s.until, s.until + 0.3));
		if (k >= best.lit) best = { lit: k, color: s.color, dir: s.dir, march: Math.max(0, Math.min(t, s.march[1]) - s.march[0]) };
	}
	return best;
}

/** How awake the room is at t, 0 asleep to 1: it wakes quickly and dozes off slowly. */
function awakeAt(stretches: Plan["awake"], t: number) {
	let k = 0;
	for (const [from, to] of stretches) k = Math.max(k, ease.out(prog(t, from, from + 0.15)) * (1 - ease.inOut(prog(t, to, to + 0.4))));
	return k;
}

/** How far check i has ticked at t: the checks tick as a save waits in Content save, and clear before the next. */
function tickAt(p: Plan, i: number, t: number) {
	const [first, second] = p.passes;
	const tick = (s: Pass) => ease.out(prog(t, s.arrive + 0.08 + i * 0.12, s.arrive + 0.2 + i * 0.12));
	const clear = 1 - ease.inOut(prog(t, second.arrive - 0.45, second.arrive - 0.2));
	return Math.max(tick(first) * clear, tick(second));
}

/** The latest event at or before t within `within` seconds, or undefined. */
function recent<E extends { at: number }>(events: readonly E[], t: number, within: number) {
	let found: E | undefined;
	for (const e of events) if (e.at <= t && t - e.at < within && (!found || e.at > found.at)) found = e;
	return found;
}

/** Text that just arrived: tinted from its arrival until a moment after. */
function arrivalTint(t: number, at: number) {
	if (t < at) return 0;
	return 1 - ease.inOut(prog(t, at + 0.6, at + 1.6));
}

function view(svg: SVGSVGElement) {
	const q = <E extends Element = HTMLElement>(selector: string) => svg.querySelector<E>(selector);
	const part = <E extends Element = HTMLElement>(name: string) => q<E>(`[data-part="${name}"]`);
	const ids: LinkId[] = ["matt", "noah", "ana", "save", "write", "agent", "notify"];
	const links = Object.fromEntries(ids.map((id) => [id, new IsoLink(q<SVGGElement>(`[data-link="${id}"]`)!)])) as Links;
	const back = new IsoPackets(q<SVGGElement>('[data-packets="back"]')!);
	const front = new IsoPackets(q<SVGGElement>('[data-packets="front"]')!);
	const noahMark = q<SVGGElement>("[data-noah-mark]")?.dataset.noahMark;
	const p = plan(links, noahMark);
	const frontLinks = new Set([links.write]);
	const layers = { back: p.packets.filter((s) => !frontLinks.has(s.link)), front: p.packets.filter((s) => frontLinks.has(s.link)) };

	const modeParts = all<SVGGElement>(svg, "[data-mode-only]");
	const win = Object.fromEntries(EDITORS.map((id) => [id, part(`win-${id}`)])) as Record<Editor, HTMLElement | null>;
	const run = (id: string) => q(`[data-run="${id}"]`);
	const bar = (id: string) => q(`[data-bar="${id}"]`);
	/** Islands and what stands on them rise together, in this order. */
	const rising = [
		["isl-matt"],
		["isl-noah"],
		["isl-ana"],
		["isl-room", "isl-site", "obj-room"],
		["isl-agent", "agent"],
		["isl-gate", "gate"],
		["isl-db", "db"],
	].map((names) => names.map((name) => part<SVGGElement>(name)));
	const cards = [win.matt, win.noah, win.ana, part("say"), part("checks")];
	const labels = [part<SVGElement>("label-room"), part<SVGElement>("label-agent")];
	const stems = EDITORS.map((id) => part<SVGGElement>(`stem-${id}`));
	const editors = EDITORS.map((id) => ({
		id,
		save: win[id]?.querySelector<HTMLElement>("[data-save]") ?? null,
		faces: [...(win[id]?.querySelectorAll<HTMLElement>("[data-presence]") ?? [])],
		typed: run(`${id}-typed`),
		typedBar: bar(`${id}-typed`),
		excerpt: run(`${id}-excerpt`),
		excerptBar: bar(`${id}-excerpt`),
		remote: q(`[data-caret="noah-at-${id}"]`),
	}));
	const el = {
		noahLocal: q('[data-caret="noah-local"]'),
		agentExcerpt: run("agent-excerpt"),
		sleep: part<SVGGElement>("room-sleep"),
		mark: part<SVGGElement>("room-mark"),
		roomDoc: part<SVGGElement>("room-doc"),
		siteLeds: part<SVGGElement>("isl-site-leds"),
		agentLight: part<SVGElement>("agent-light"),
		flash: part<SVGElement>("db-flash"),
		lights: Array.from({ length: CHECKS }, (_, i) => part<SVGElement>(`gate-light-${i}`)),
		checks: all(svg, "[data-check]"),
	};
	const saved: StatusTrack = [[0, "saved"]];
	const writes = p.passes.map((s) => ({ at: s.commit, color: s.color }));

	return {
		render(t: number, mode: ModeId) {
			renderModeOnly(modeParts, mode);

			// The scene assembles: islands, then links, then the floating cards.
			rising.forEach((group, i) => {
				const k = entered(t, i * 0.06);
				for (const g of group) renderRise(g, k, 10);
			});
			cards.forEach((c, i) => renderRise(c, entered(t, 0.3 + i * 0.06), 8));
			for (const l of labels) show(l, ease.out(prog(t, 0.55, 0.85)));
			const linksOn = ease.out(prog(t, 0.35, 0.65));
			for (const id of ids) {
				const s = litAt(p.lit[id], t);
				links[id].render({ on: linksOn, lit: s.lit, color: s.color || undefined, march: s.march, dir: s.dir });
			}
			back.render(layers.back, t);
			front.render(layers.front, t);
			const stemsOn = ease.out(prog(t, 0.5, 0.8));
			for (const s of stems) renderStem(s, stemsOn);

			// The room: on Cloudflare it sleeps between messages, its sockets still open; on Node.js it never does.
			const asleep = mode === "cloudflare" ? (1 - awakeAt(p.awake, t)) * entered(t, 0.6, 0.4) : 0;
			show(el.sleep, asleep, asleep < 1 ? `scale(${n(0.7 + 0.3 * asleep)})` : "");
			css(el.mark, "opacity", n(1 - 0.62 * asleep));
			css(el.roomDoc, "opacity", n(1 - 0.4 * asleep));
			const blink = recent(p.room, t, 0.3);
			css(el.siteLeds, "--led", mode === "node" && blink ? blink.color : null);

			// Content save: a light and a check for each, as a save waits in the gate.
			for (let i = 0; i < CHECKS; i++) {
				const k = tickAt(p, i, t);
				renderTick(el.checks[i] ?? null, k);
				css(el.lights[i], "--led", k > 0.01 ? `color-mix(in srgb, ${OK} ${n(k * 100, 1)}%, var(--i-led))` : null);
			}
			const write = recent(writes, t, 1);
			if (write) renderFlash(el.flash, write.color, t - write.at);
			else renderFlash(el.flash, "transparent", -1);
			const working = ease.out(prog(t, p.agent[0], p.agent[0] + 0.2)) * (1 - ease.inOut(prog(t, p.agent[1], p.agent[1] + 0.4)));
			css(el.agentLight, "fill", working > 0.01 ? `color-mix(in srgb, ${INK} ${n(working * 100, 1)}%, var(--i-top))` : null);
			// The agent's excerpt appears just before it leaves for Content save.
			if (el.agentExcerpt) {
				const at = T.agent - 0.2;
				const k = ease.out(prog(t, at, at + 0.25));
				renderRun(el.agentExcerpt, TEXT.excerpt, t >= at ? TEXT.excerpt.length : 0, true);
				show(el.agentExcerpt, k, k < 1 ? `translateY(${n((1 - k) * 3, 2)}px)` : "");
				renderTint(el.agentExcerpt, arrivalTint(t, at));
			}

			const caretsIn = entered(t, 0.45, 0.3);
			const count = typedCount(typed, t);
			let chars = 0;
			let moved = Number.NEGATIVE_INFINITY;
			for (const d of p.delivered) {
				if (d.at > t) break;
				chars = d.chars;
				moved = d.at;
			}
			const last = p.delivered[p.delivered.length - 1]!.at;
			for (const e of editors) {
				const noah = e.id === "noah";
				renderSaveButton(e.save, noah ? p.noah : saved, t);
				for (const face of e.faces) renderPresence(face, caretsIn);
				const shown = noah ? count : chars;
				if (e.typed) renderRun(e.typed, TEXT.typed, shown, true);
				renderBar(e.typedBar, shown / TEXT.typed.length);
				renderCaret(e.remote, caretsIn, caretsIn * (t < last ? 1 : flagAfterMove(t, moved)));
				const at = p.excerpt[e.id];
				const k = ease.out(prog(t, at, at + 0.3));
				if (e.excerpt) {
					renderRun(e.excerpt, TEXT.excerpt, t >= at ? TEXT.excerpt.length : 0, true);
					show(e.excerpt, k, k < 1 ? `translateY(${n((1 - k) * 3, 2)}px)` : "");
					renderTint(e.excerpt, arrivalTint(t, at));
				}
				renderBar(e.excerptBar, k);
			}
			renderCaret(el.noahLocal, caretsIn);
		},
	};
}

export const scene: Scene = {
	...info,
	setup(stage) {
		const views = all<SVGSVGElement>(stage, ".iso-comp").map((svg) => ({ svg, view: view(svg) }));
		let active = visibleComposition(views.map((v) => v.svg));
		return {
			layout() {
				active = visibleComposition(views.map((v) => v.svg));
			},
			render(t, modeId) {
				const mode: ModeId = modeId === "node" ? "node" : "cloudflare";
				views.find((v) => v.svg === active)?.view.render(t, mode);
			},
		};
	},
};
