import {
	all,
	css,
	ease,
	entered,
	flagAfterMove,
	PEOPLE,
	prog,
	renderCaret,
	renderLost,
	renderPresence,
	renderRun,
	type Scene,
	show,
	spring,
	type StatusTrack,
	typedCount,
	typingTimes,
} from "./kit";
import { n } from "./kit/dom";
import {
	IsoLink,
	type IsoPacket,
	IsoPackets,
	landed,
	renderBar,
	renderClosed,
	renderFlash,
	renderModeOnly,
	renderOutcome,
	renderRise,
	renderSaveButton,
	renderStem,
	renderTint,
	trip,
	visibleComposition,
} from "./kit/iso/live";
import { info, type ModeId, T, TEXT } from "./relay-or-room";

const ANA = PEOPLE.ana.caret;
const NOAH = PEOPLE.noah.caret;
const BRAND = "var(--fig-brand)";
/** One link's worth of travel for a keystroke update, and for a whole document. */
const HOP = 0.36;
const DOC = 0.5;

const wholeTimes = typingTimes(TEXT.whole, T.whole[0], T.whole[1], 3);
const sentenceTimes = typingTimes(TEXT.sentence, T.sentence[0], T.sentence[1], 7);
const offlineTimes = typingTimes(TEXT.offline, T.noahTypes[0], T.noahTypes[1], 5);

type LinkId = "ana" | "noah" | "store";
type Links = Record<LinkId, IsoLink>;

/** A stretch of time a link is lit: rising at `from`, falling at `until`, its dots marching while packets fly. */
interface Lit {
	from: number;
	until?: number;
	color: string;
	dir: 1 | -1;
	march: readonly [number, number];
}

interface Plan {
	packets: IsoPacket[];
	/** When Ana's "whole " reaches Noah's editor, a few characters at a time. */
	delivered: Array<{ at: number; chars: number }>;
	/** When the stored version takes Ana's edits, then Noah's. */
	anaStored: number;
	noahStored: number;
	/** Room mode: when Ana's sentence reaches Noah's editor. */
	noahGetsSentence: number;
	outcome: number;
	ana: StatusTrack;
	noah: StatusTrack;
	lit: Record<LinkId, Lit[]>;
	/** Packets passing through the hub, for its lights. */
	hub: Array<{ at: number; color: string }>;
	/** Saves landing in the database. */
	writes: Array<{ at: number; color: string }>;
}

const span = (specs: readonly IsoPacket[]): readonly [number, number] => [Math.min(...specs.map((s) => s.t0)), Math.max(...specs.map((s) => s.t0 + s.dur))];

function plan(mode: ModeId, l: Links): Plan {
	const packets: IsoPacket[] = [];
	const up = { link: l.ana };
	const toNoah = { link: l.noah, reverse: true };
	const fromNoah = { link: l.noah };
	const store = { link: l.store };
	const hub: Plan["hub"] = [];

	// Step 1: each pair of Ana's keystrokes travels to the hub and on to Noah.
	const relayed = [1, 3, 5].map((i) => trip([up, toNoah], wholeTimes[i]!, { dur: HOP, color: ANA, pause: 0.04 }));
	const delivered = relayed.map((hops, i) => ({ at: landed(hops), chars: [2, 4, 6][i]! }));
	for (const hops of relayed) hub.push({ at: hops[0]!.t0 + HOP, color: ANA });
	packets.push(...relayed.flat());
	const relayFirst = relayed.flat().filter((p) => p.link === l.ana);
	const relayOn = relayed.flat().filter((p) => p.link === l.noah);

	// Step 3: her sentence reaches the hub and goes no further.
	const sentence = [3, 9, 15, 21].map((i) => trip([up], sentenceTimes[i]!, { dur: HOP, color: ANA }));
	for (const hops of sentence) hub.push({ at: landed(hops), color: ANA });
	packets.push(...sentence.flat());

	const lit: Plan["lit"] = {
		ana: [{ from: relayFirst[0]!.t0 - 0.2, until: info.steps[1]!.at + 0.05, color: ANA, dir: 1, march: span(relayFirst) }],
		noah: [{ from: relayOn[0]!.t0 - 0.2, until: T.offline, color: ANA, dir: -1, march: span(relayOn) }],
		store: [],
	};
	const sentenceSpan = span(sentence.flat());
	let anaStored: number;
	let noahStored: number;
	let noahGetsSentence = Number.POSITIVE_INFINITY;
	let ana: StatusTrack;
	let noah: StatusTrack;
	const writes: Plan["writes"] = [];

	if (mode === "browsers") {
		lit.ana.push({ from: sentenceSpan[0] - 0.2, until: T.save - 0.1, color: ANA, dir: 1, march: sentenceSpan });
		// Each browser sends its whole copy; the server passes it straight to the database.
		const copy = trip([up, store], T.save + 0.08, { dur: DOC, color: ANA, kind: "doc", pause: 0.08 });
		const stale = trip([fromNoah, store], T.online + 0.4, { dur: DOC, color: NOAH, kind: "doc", pause: 0.08 });
		packets.push(...copy, ...stale);
		hub.push({ at: copy[0]!.t0 + DOC, color: ANA }, { at: stale[0]!.t0 + DOC, color: NOAH });
		anaStored = landed(copy);
		noahStored = landed(stale);
		lit.ana.push({ from: T.save - 0.05, until: T.leave + 0.1, color: ANA, dir: 1, march: [copy[0]!.t0, copy[0]!.t0 + DOC] });
		lit.store.push({ from: copy[1]!.t0 - 0.15, until: info.steps[4]!.at + 0.1, color: ANA, dir: 1, march: [copy[1]!.t0, anaStored] });
		lit.noah.push({ from: stale[0]!.t0 - 0.2, color: NOAH, dir: 1, march: [stale[0]!.t0, stale[0]!.t0 + DOC] });
		lit.store.push({ from: stale[1]!.t0 - 0.15, color: NOAH, dir: 1, march: [stale[1]!.t0, noahStored] });
		noah = [
			[0, "saved"],
			[T.offline + 0.25, "offline"],
			[T.online + 0.3, "saving"],
			[noahStored + 0.05, "saved"],
		];
		ana = [
			[0, "saved"],
			[T.whole[0], "save"],
			[T.save, "saving"],
			[anaStored + 0.05, "saved"],
		];
	} else {
		lit.ana.push({ from: sentenceSpan[0] - 0.2, until: info.steps[3]!.at + 0.05, color: ANA, dir: 1, march: sentenceSpan });
		// Browsers only send updates. The room merges them and is the only thing that saves.
		const save = trip([store], T.save + 0.2, { dur: 0.6, color: BRAND, kind: "doc" });
		const buffered = [0, 1, 2].map((i) => trip([fromNoah], T.online + 0.35 + i * 0.11, { dur: 0.44, color: NOAH }));
		const merged = landed(buffered[2]!) + 0.12;
		hub.push(...buffered.map((b) => ({ at: landed(b), color: NOAH })));
		const relayedBack = [0, 1, 2].map((i) => trip([toNoah], merged + 0.12 + i * 0.11, { dur: 0.44, color: ANA }));
		noahGetsSentence = landed(relayedBack[0]!);
		const resave = trip([store], landed(relayedBack[2]!) + 0.3, { dur: 0.6, color: BRAND, kind: "doc" });
		packets.push(...save, ...buffered.flat(), ...relayedBack.flat(), ...resave);
		anaStored = landed(save);
		noahStored = landed(resave);
		lit.store.push({ from: save[0]!.t0 - 0.15, until: info.steps[4]!.at + 0.1, color: BRAND, dir: 1, march: span(save) });
		lit.noah.push({ from: buffered[0]![0]!.t0 - 0.2, until: merged, color: NOAH, dir: 1, march: span(buffered.flat()) });
		lit.noah.push({ from: merged + 0.02, until: resave[0]!.t0 - 0.1, color: ANA, dir: -1, march: span(relayedBack.flat()) });
		lit.store.push({ from: resave[0]!.t0 - 0.15, color: BRAND, dir: 1, march: span(resave) });
		// In a room, Save reads Saved once a save holds the person's edits; the room's saves wait on no one.
		noah = [
			[0, "saved"],
			[T.offline + 0.25, "offline"],
			[T.online + 0.3, "save"],
			[noahStored + 0.05, "saved"],
		];
		ana = [
			[0, "saved"],
			[T.whole[0], "save"],
			[anaStored + 0.05, "saved"],
		];
	}
	writes.push({ at: anaStored, color: mode === "room" ? BRAND : ANA }, { at: noahStored, color: mode === "room" ? BRAND : NOAH });

	return {
		packets,
		delivered,
		anaStored,
		noahStored,
		noahGetsSentence,
		outcome: noahStored + (mode === "browsers" ? 0.75 : 0.2),
		ana,
		noah,
		lit,
		hub,
		writes,
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
		if (s.until !== undefined) k *= 1 - ease.inOut(prog(t, s.until, s.until + 0.35));
		if (k >= best.lit) best = { lit: k, color: s.color, dir: s.dir, march: Math.max(0, Math.min(t, s.march[1]) - s.march[0]) };
	}
	return best;
}

/** The latest event at or before t within `within` seconds, or undefined. */
function recent<E extends { at: number }>(events: readonly E[], t: number, within: number) {
	let found: E | undefined;
	for (const e of events) if (e.at <= t && t - e.at < within && (!found || e.at > found.at)) found = e;
	return found;
}

function view(svg: SVGSVGElement) {
	const q = <E extends Element = HTMLElement>(selector: string) => svg.querySelector<E>(selector);
	const part = <E extends Element = HTMLElement>(name: string) => q<E>(`[data-part="${name}"]`);
	const linkEl = (id: LinkId) => new IsoLink(q<SVGGElement>(`[data-link="${id}"]`)!);
	const links: Links = { ana: linkEl("ana"), noah: linkEl("noah"), store: linkEl("store") };
	const back = new IsoPackets(q<SVGGElement>('[data-packets="back"]')!);
	const front = new IsoPackets(q<SVGGElement>('[data-packets="front"]')!);
	const plans: Record<ModeId, Plan> = { browsers: plan("browsers", links), room: plan("room", links) };
	const split = (p: Plan) => ({ back: p.packets.filter((s) => s.link === links.store), front: p.packets.filter((s) => s.link !== links.store) });
	const layers = { browsers: split(plans.browsers), room: split(plans.room) };

	const modeParts = all<SVGGElement>(svg, "[data-mode-only]");
	const winAna = part("win-ana");
	const winNoah = part("win-noah");
	const stored = part("stored");
	const run = (id: string) => q(`[data-run="${id}"]`);
	const bar = (id: string) => q(`[data-bar="${id}"]`);
	const caret = (id: string) => q(`[data-caret="${id}"]`);
	const chair = part<SVGGElement>("chair-ana");
	const roll = (chair?.dataset.roll ?? "0 0").split(" ").map(Number) as [number, number];
	const islands = ["isl-db", "isl-hub", "isl-ana", "isl-noah"].map((id) => part<SVGGElement>(id));
	const cards = [stored, winAna, winNoah];
	const stems = { ana: part<SVGGElement>("stem-ana"), noah: part<SVGGElement>("stem-noah"), stored: part<SVGGElement>("stem-stored") };
	const el = {
		anaSave: winAna?.querySelector<HTMLElement>("[data-save]") ?? null,
		noahSave: winNoah?.querySelector<HTMLElement>("[data-save]") ?? null,
		noahPublish: winNoah?.querySelector<HTMLElement>("[data-publish]") ?? null,
		noahAtAnaFace: winAna?.querySelector<HTMLElement>('[data-presence="noah"]') ?? null,
		anaAtNoahFace: winNoah?.querySelector<HTMLElement>('[data-presence="ana"]') ?? null,
		anaWhole: run("ana-whole"),
		anaSentence: run("ana-sentence"),
		noahWhole: run("noah-whole"),
		noahOffline: run("noah-offline"),
		noahSentence: run("noah-sentence"),
		storeWhole: run("store-whole"),
		storeOffline: run("store-offline"),
		storeSentence: run("store-sentence"),
		barAnaWhole: bar("ana-whole"),
		barAnaSentence: bar("ana-sentence"),
		barNoahWhole: bar("noah-whole"),
		barNoahOffline: bar("noah-offline"),
		barNoahSentence: bar("noah-sentence"),
		anaLocal: caret("ana-local"),
		anaLocal2: caret("ana-local-2"),
		noahAtAna: caret("noah-at-ana"),
		anaAtNoah: caret("ana-at-noah"),
		noahLocal0: caret("noah-local-0"),
		noahLocal: caret("noah-local"),
		screenAna: part<SVGGElement>("screen-ana"),
		leds: part<SVGGElement>("server-leds"),
		flash: part<SVGElement>("db-flash"),
		lost: stored?.querySelector<HTMLElement>('[data-outcome="lost"]') ?? null,
		kept: stored?.querySelector<HTMLElement>('[data-outcome="kept"]') ?? null,
	};

	return {
		render(t: number, mode: ModeId) {
			const p = plans[mode];
			const room = mode === "room";
			renderModeOnly(modeParts, mode);

			// The scene assembles: islands, then links, then the floating cards.
			islands.forEach((g, i) => renderRise(g, entered(t, i * 0.08), 10));
			cards.forEach((c, i) => renderRise(c, entered(t, 0.3 + i * 0.07), 8));
			const linksOn = ease.out(prog(t, 0.35, 0.65));

			const leaving = t < T.leave ? 0 : ease.inOut(prog(t, T.leave + 0.1, T.leave + 0.5));
			const cut = ease.out(prog(t, T.offline, T.offline + 0.3)) * (1 - ease.out(prog(t, T.online, T.online + 0.35)));
			for (const id of ["ana", "noah", "store"] as const) {
				const s = litAt(p.lit[id], t);
				links[id].render({
					on: linksOn,
					lit: s.lit,
					color: s.color || undefined,
					march: s.march,
					dir: s.dir,
					broken: id === "noah" ? cut : 0,
					gone: id === "ana" ? leaving : 0,
				});
			}
			back.render(layers[mode].back, t);
			front.render(layers[mode].front, t);
			const blink = recent(p.hub, t, 0.3);
			css(el.leds, "--led", blink ? blink.color : null);
			const write = recent(p.writes, t, 1);
			if (write) renderFlash(el.flash, write.color, t - write.at);
			else renderFlash(el.flash, "transparent", -1);

			// Stems: each person's in their colour; Ana's goes quiet when she leaves.
			const stemsOn = ease.out(prog(t, 0.5, 0.8));
			renderStem(stems.ana, stemsOn * (1 - 0.7 * leaving));
			renderStem(stems.noah, stemsOn);
			renderStem(stems.stored, stemsOn);

			renderSaveButton(el.anaSave, p.ana, t);
			renderSaveButton(el.noahSave, p.noah, t);
			css(el.noahPublish, "opacity", n(1 - 0.5 * cut));
			const together = entered(t, 0.45, 0.3) * (1 - prog(t, T.offline + 0.1, T.offline + 0.3));
			renderPresence(el.noahAtAnaFace, together);
			renderPresence(el.anaAtNoahFace, together);

			// Ana's editor: "whole ", then a new sentence on its own line. She leaves after her save.
			const wholeCount = typedCount(wholeTimes, t);
			const sentenceCount = typedCount(sentenceTimes, t);
			renderRun0(el.anaWhole, TEXT.whole, wholeCount);
			renderRun0(el.anaSentence, TEXT.sentence, sentenceCount, true);
			renderBar(el.barAnaWhole, wholeCount / TEXT.whole.length);
			renderBar(el.barAnaSentence, sentenceCount / TEXT.sentence.length);
			const caretsIn = entered(t, 0.45, 0.3);
			renderCaret(el.anaLocal, t < T.sentence[0] - 0.15 ? caretsIn : 0);
			renderCaret(el.anaLocal2, t >= T.sentence[0] - 0.15 ? 1 : 0);
			const drop = 1 - prog(t, T.offline + 0.05, T.offline + 0.25);
			// Both just joined, so both name flags show until the connection drops.
			renderCaret(el.noahAtAna, caretsIn * drop, caretsIn * drop);
			renderClosed(winAna, prog(t, T.leave, T.leave + 0.55));
			const rolled = t < T.leave + 0.1 ? 0 : spring(t - T.leave - 0.1, { duration: 0.7, bounce: 0.12 });
			css(chair, "transform", rolled ? `translate(${n(roll[0] * rolled, 2)}px, ${n(roll[1] * rolled, 2)}px)` : null);
			show(el.screenAna, 1 - ease.out(prog(t, T.leave + 0.05, T.leave + 0.35)));

			// Noah's editor: Ana's "whole " as it arrives, then his own words while offline.
			let chars = 0;
			let moved = Number.NEGATIVE_INFINITY;
			for (const d of p.delivered) {
				if (d.at > t) break;
				chars = d.chars;
				moved = d.at;
			}
			renderRun0(el.noahWhole, TEXT.whole, chars);
			renderBar(el.barNoahWhole, chars / TEXT.whole.length);
			renderTint(el.noahWhole, arrivalTint(t, p.delivered[0]!.at, p.delivered[2]!.at));
			renderCaret(el.anaAtNoah, caretsIn * drop, Math.max(caretsIn, flagAfterMove(t, moved)) * drop);
			const offlineCount = typedCount(offlineTimes, t);
			renderRun0(el.noahOffline, TEXT.offline, offlineCount, true);
			renderBar(el.barNoahOffline, offlineCount / TEXT.offline.length);
			renderCaret(el.noahLocal0, offlineCount ? 0 : caretsIn);
			renderCaret(el.noahLocal, offlineCount ? 1 : 0);
			const gets = room && t >= p.noahGetsSentence;
			renderRun0(el.noahSentence, TEXT.sentence, gets ? TEXT.sentence.length : 0, true);
			show(el.noahSentence, gets ? ease.out(prog(t, p.noahGetsSentence, p.noahGetsSentence + 0.3)) : 0);
			renderBar(el.barNoahSentence, gets ? ease.out(prog(t, p.noahGetsSentence, p.noahGetsSentence + 0.4)) : 0);

			const anaIn = t >= p.anaStored;
			const noahIn = t >= p.noahStored;
			renderRun0(el.storeWhole, TEXT.whole, anaIn ? TEXT.whole.length : 0);
			renderTint(el.storeWhole, arrivalTint(t, p.anaStored, p.anaStored));
			renderRun0(el.storeSentence, TEXT.sentence, anaIn ? TEXT.sentence.length : 0, true);
			show(el.storeSentence, anaIn ? ease.out(prog(t, p.anaStored, p.anaStored + 0.3)) : 0);
			renderRun0(el.storeOffline, TEXT.offline, noahIn ? TEXT.offline.length : 0);
			show(el.storeOffline, noahIn ? ease.out(prog(t, p.noahStored, p.noahStored + 0.3)) : 0);
			renderLost(el.storeSentence, room ? 0 : prog(t, p.noahStored + 0.1, p.noahStored + 0.6));
			renderOutcome(el.lost, room ? 0 : prog(t, p.outcome, p.outcome + 0.45));
			renderOutcome(el.kept, room ? prog(t, p.outcome, p.outcome + 0.45) : 0);
		},
	};
}

/** Text that just arrived: tinted from its first character until a moment after its last. */
function arrivalTint(t: number, first: number, last: number) {
	if (t < first) return 0;
	return 1 - ease.inOut(prog(t, last + 0.3, last + 1.1));
}

/** renderRun for an element that only some compositions draw. */
function renderRun0(el: HTMLElement | null, full: string, count: number, reserve = false) {
	if (el) renderRun(el, full, count, reserve);
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
				const mode: ModeId = modeId === "room" ? "room" : "browsers";
				views.find((v) => v.svg === active)?.view.render(t, mode);
			},
		};
	},
};
