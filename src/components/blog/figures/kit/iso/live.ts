/**
 * The client half of the isometric kit: links that light up and break,
 * packets that travel along them, and render helpers for the floating cards.
 * Geometry comes from the markup (links.ts writes each link's screen points
 * into data-pts), so nothing here measures layout. Every function sets the
 * stage for a time t and keeps no state of its own.
 */
import { attr, css, n, show } from "../dom";
import { clamp, ease, prog, stateAt } from "../motion";
import { renderStatus, type StatusTrack } from "../parts";

export type Pt = [number, number];

/** A polyline in screen space, measured once. */
export class Route {
	readonly pts: Pt[];
	readonly lens: number[];
	readonly total: number;

	constructor(pts: Pt[]) {
		this.pts = pts;
		this.lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
		this.total = this.lens.reduce((a, b) => a + b, 0);
	}

	static parse(data: string) {
		return new Route(
			data
				.trim()
				.split(/\s+/)
				.map((pair) => pair.split(",").map(Number) as Pt),
		);
	}

	/** The point a distance `d` along the route, clamped to its ends. */
	atLength(d: number): Pt {
		let left = clamp(d, 0, this.total);
		for (let i = 0; i < this.lens.length; i++) {
			const len = this.lens[i]!;
			if (left <= len || i === this.lens.length - 1) {
				const a = this.pts[i]!;
				const b = this.pts[i + 1]!;
				const k = len ? Math.min(1, left / len) : 0;
				return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
			}
			left -= len;
		}
		return this.pts[0]!;
	}

	at(fraction: number): Pt {
		return this.atLength(clamp(fraction) * this.total);
	}

	/** The path data with a gap of `gap` px centred on the middle. */
	path(gap = 0) {
		const fmt = (p: Pt) => `${n(p[0], 2)} ${n(p[1], 2)}`;
		if (gap <= 0.01) return `M${this.pts.map(fmt).join(" L")}`;
		const half = (this.total - gap) / 2;
		const run = (from: number, to: number) => {
			const out: Pt[] = [this.atLength(from)];
			let acc = 0;
			for (let i = 0; i < this.lens.length; i++) {
				acc += this.lens[i]!;
				if (acc > from && acc < to) out.push(this.pts[i + 1]!);
			}
			out.push(this.atLength(to));
			return `M${out.map(fmt).join(" L")}`;
		};
		return `${run(0, half)} ${run(half + gap, this.total)}`;
	}
}

export interface LinkState {
	/** Overall opacity, for entrances. */
	on?: number;
	/** 0 resting, 1 lit in `color`: the link is carrying something, or just has. */
	lit?: number;
	/** CSS colour of the lit link: a person's caret colour, or var(--fig-brand). */
	color?: string;
	/** Seconds the lit dots have marched so far; they move only while this grows. */
	march?: number;
	/** Which way they march: 1 from the link's start to its end, -1 back. */
	dir?: 1 | -1;
	/** 0 whole, 1 broken: a gap opens at the middle and the badge shows. */
	broken?: number;
	/** 0 connected, 1 gone: the resting path fades to a ghost. */
	gone?: number;
}

const GAP = 30;
const PERIOD = 6;
const SPEED = 26;

/** One link (links.ts's link()), with its resting path, lit path and badge. */
export class IsoLink {
	readonly route: Route;
	readonly rest: SVGPathElement;
	readonly lit: SVGPathElement;
	readonly badge: SVGGElement | null;

	constructor(readonly group: SVGGElement) {
		this.route = Route.parse(group.dataset.pts ?? "");
		this.rest = group.querySelector<SVGPathElement>(".il-rest")!;
		this.lit = group.querySelector<SVGPathElement>(".il-lit")!;
		this.badge = group.querySelector<SVGGElement>("[data-badge]");
	}

	render({ on = 1, lit = 0, color, march = 0, dir = 1, broken = 0, gone = 0 }: LinkState) {
		show(this.group, on);
		const b = clamp(broken);
		const d = this.route.path(GAP * ease.out(b));
		attr(this.rest, "d", d);
		attr(this.lit, "d", d);
		css(this.rest, "opacity", 1 - 0.7 * clamp(gone));
		const k = clamp(lit);
		css(this.lit, "opacity", k);
		css(this.lit, "visibility", k <= 0.001 ? "hidden" : null);
		if (color) css(this.lit, "--lit", color);
		css(this.lit, "stroke-dashoffset", n(-((march * SPEED * dir) % PERIOD), 2));
		if (this.badge) {
			const s = ease.out(b);
			show(this.badge, s, s < 1 ? `scale(${n(0.6 + 0.4 * s)})` : "");
		}
	}
}

export interface IsoPacket {
	link: IsoLink;
	/** When it leaves, and how long the trip takes. */
	t0: number;
	dur: number;
	/** CSS colour: the author's caret colour, or var(--fig-brand). */
	color: string;
	/** A dot is an update; a doc is a whole copy of the document. */
	kind?: "dot" | "doc";
	/** Travel from the link's end to its start. */
	reverse?: boolean;
	/** A ring where it lands. */
	pulse?: boolean;
	/** Whom a document travels for: the href of a markDef() avatar, worn on its corner. */
	mark?: string;
}

/** A trip over several links, one after another, with a short pause at each stop. */
export function trip(
	links: ReadonlyArray<{ link: IsoLink; reverse?: boolean }>,
	t0: number,
	opts: Omit<IsoPacket, "link" | "t0" | "reverse"> & { pause?: number },
): IsoPacket[] {
	const { pause = 0.06, ...rest } = opts;
	let at = t0;
	return links.map(({ link, reverse }) => {
		const spec: IsoPacket = { ...rest, link, reverse, t0: at };
		at += rest.dur + pause;
		return spec;
	});
}

/** When the last hop of a trip lands. */
export const landed = (specs: readonly IsoPacket[]) => {
	const last = specs[specs.length - 1];
	return last ? last.t0 + last.dur : 0;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const TRAIL = [6, 11, 15];
const RING = 0.55;

/** Draws the packets in flight at t, and their landing rings. Elements are pooled. */
export class IsoPackets {
	private items: SVGGElement[] = [];
	private rings: SVGCircleElement[] = [];

	constructor(private readonly layer: SVGGElement) {}

	private item(i: number) {
		let g = this.items[i];
		if (!g) {
			g = document.createElementNS(SVG_NS, "g");
			g.setAttribute("class", "ip");
			g.innerHTML =
				TRAIL.map((_, j) => `<circle class="ip-trail" data-trail="${j}" r="${[2.4, 1.8, 1.3][j]}"/>`).join("") +
				'<g class="ip-head"><circle class="ip-dot" r="4"/><g class="ip-doc"><path d="M-7.5 -9.5 H3.5 L7.5 -5.5 V9.5 H-7.5 Z"/><path class="ip-lines" d="M-4 -3.5 H4 M-4 0.5 H4 M-4 4.5 H1.5"/></g><use class="ip-mark" x="7" y="7" style="display:none"/></g>';
			this.layer.appendChild(g);
			this.items[i] = g;
		}
		return g;
	}

	private ring(i: number) {
		let c = this.rings[i];
		if (!c) {
			c = document.createElementNS(SVG_NS, "circle");
			c.setAttribute("class", "ip-ring");
			this.layer.insertBefore(c, this.layer.firstChild);
			this.rings[i] = c;
		}
		return c;
	}

	render(specs: readonly IsoPacket[], t: number) {
		let used = 0;
		let rings = 0;
		for (const s of specs) {
			const end = s.t0 + s.dur;
			if (t >= s.t0 && t <= end) {
				const route = s.link.route;
				const p = ease.inOut(prog(t, s.t0, end));
				const along = (s.reverse ? 1 - p : p) * route.total;
				const back = s.reverse ? 1 : -1;
				const [x, y] = route.atLength(along);
				const g = this.item(used++);
				attr(g, "data-kind", s.kind ?? "dot");
				css(g, "--packet", s.color);
				css(g, "opacity", Math.min(prog(t, s.t0, s.t0 + 0.06), 1 - prog(t, end - 0.05, end)));
				css(g, "visibility", null);
				const head = g.lastElementChild as SVGGElement;
				attr(head, "transform", `translate(${n(x, 2)} ${n(y, 2)})`);
				const mark = head.lastElementChild as SVGUseElement;
				if (s.mark) attr(mark, "href", s.mark);
				css(mark, "display", s.mark ? null : "none");
				TRAIL.forEach((gap, j) => {
					const dot = g.children[j] as SVGCircleElement;
					const td = along + back * gap * (s.kind === "doc" ? 1.4 : 1);
					const hidden = td < 0 || td > route.total;
					const [tx, ty] = route.atLength(td);
					attr(dot, "cx", n(tx, 2));
					attr(dot, "cy", n(ty, 2));
					css(dot, "opacity", hidden ? 0 : [0.55, 0.35, 0.18][j]!);
				});
			}
			if (s.pulse && t > end && t < end + RING) {
				const k = prog(t, end, end + RING);
				const [x, y] = s.link.route.at(s.reverse ? 0 : 1);
				const c = this.ring(rings++);
				attr(c, "cx", n(x, 2));
				attr(c, "cy", n(y, 2));
				attr(c, "r", n(5 + ease.out(k) * 14, 2));
				css(c, "--packet", s.color);
				css(c, "opacity", 0.5 * (1 - k));
				css(c, "visibility", null);
			}
		}
		for (let i = used; i < this.items.length; i++) css(this.items[i], "visibility", "hidden");
		for (let i = rings; i < this.rings.length; i++) css(this.rings[i], "visibility", "hidden");
	}
}

// ---------- Cards ----------

const SWAP = 0.2;

/** cards.ts's Save button: the state for t, outlined for Save and Saving…, a grey pill for Offline, quiet for Saved. */
export function renderSaveButton(el: HTMLElement | null, track: StatusTrack, t: number) {
	if (!el) return;
	renderStatus(el.querySelector(".fig-status"), track, t);
	const { state, since, prev } = stateAt(track, t);
	const k = ease.out(prog(since, 0, SWAP));
	const mix = (test: (s: string | undefined) => boolean) => {
		const from = test(prev) ? 1 : 0;
		return from + ((test(state) ? 1 : 0) - from) * k;
	};
	attr(el, "data-state", state);
	css(el, "--solid", mix((s) => s === "save" || s === "saving"));
	css(el, "--pill", mix((s) => s === "offline"));
	for (const spin of el.querySelectorAll<SVGElement>("[data-spin] .fig-icon")) css(spin, "transform", `rotate(${n((t * 360) % 360, 1)}deg)`);
}

/** A window closing (p 0 → 1): the live window fades and shrinks a little, leaving its dashed outline. */
export function renderClosed(win: HTMLElement | null, p: number) {
	if (!win) return;
	const k = clamp(p);
	const live = win.querySelector<HTMLElement>(".iw-live");
	const ghost = win.querySelector<HTMLElement>(".iw-ghost");
	const out = ease.out(prog(k, 0, 0.7));
	show(live, 1 - out, out > 0 ? `scale(${n(1 - 0.03 * out, 4)})` : "");
	show(ghost, ease.out(prog(k, 0.35, 1)));
}

/** A checklist item (cards.ts checklist with ticks): its ring gives way to a check, p 0 → 1. */
export function renderTick(item: HTMLElement | null, p: number) {
	if (!item) return;
	const k = clamp(p);
	show(item.querySelector(".ick-off"), 1 - k);
	show(item.querySelector(".ick-on"), k, k < 1 ? `scale(${n(0.6 + 0.4 * k)})` : "");
	css(item, "--tick", k);
}

/** An abstract line (cards.ts Bar) growing from its start: p 0 → 1. */
export function renderBar(el: HTMLElement | null, p: number) {
	css(el, "--grow", clamp(p));
}

/** Tints a run in its author's colour, 0 to 1. */
export function renderTint(el: HTMLElement | null, k: number) {
	css(el, "--hl", clamp(k));
}

/** An outcome mark arriving with a small pop. */
export function renderOutcome(el: HTMLElement | null, p: number) {
	const k = clamp(p);
	const pop = k < 1 ? 0.6 + 0.4 * ease.out(k) + Math.sin(k * Math.PI) * 0.08 : 1;
	show(el, ease.out(prog(k, 0, 0.6)), k < 1 ? `scale(${n(pop, 3)})` : "");
}

/** A stem from a card to its object: its opacity and, optionally, its colour. */
export function renderStem(el: SVGElement | null, on: number, color?: string) {
	show(el, on);
	if (color) css(el, "--stem", color);
}

/** A database lid flashing in a writer's colour as a save lands: `s` seconds after it landed. */
export function renderFlash(el: SVGElement | null, color: string, s: number, length = 0.9) {
	if (!el) return;
	const k = s < 0 || s > length ? 0 : 1 - ease.out(s / length);
	css(el, "--flash", color);
	css(el, "opacity", k * 0.55);
}

/** An SVG group entering: fades in while rising 8px. */
export function renderRise(el: SVGElement | HTMLElement | null, k: number, rise = 8) {
	const p = clamp(k);
	show(el, p, p < 1 ? `translateY(${n((1 - p) * rise, 2)}px)` : "");
}

/** Shows the parts of a composition that belong to one mode (links.ts modeOnly()). Pass the elements, queried once. */
export function renderModeOnly(els: ReadonlyArray<SVGElement | HTMLElement>, mode: string) {
	for (const el of els) css(el, "display", el.dataset.modeOnly === mode ? null : "none");
}

/** The composition on screen, for figures that draw one per width: the first with a layout box. */
export function visibleComposition<T extends Element>(compositions: readonly T[]): T | undefined {
	return compositions.find((c) => (c as unknown as HTMLElement).getBoundingClientRect().width > 0) ?? compositions[0];
}
