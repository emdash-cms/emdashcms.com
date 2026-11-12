/**
 * Render helpers for the kit's primitives. Each takes elements from a
 * primitive's markup and a time, and sets them.
 */

import { css, n, show, text } from "./dom";
import { bezier, clamp, ease, prog, stateAt } from "./motion";

export type StatusTrack = ReadonlyArray<readonly [number, string]>;

const SWAP = 0.2;

/** Status.astro: the state for t, sliding 4px as it replaces the last one. Spinner icons turn. */
export function renderStatus(el: HTMLElement | null, track: StatusTrack, t: number) {
	if (!el) return;
	const { state, since, prev } = stateAt(track, t);
	const k = ease.out(prog(since, 0, SWAP));
	for (const skin of el.querySelectorAll<HTMLElement>("[data-skin]")) {
		const s = skin.dataset.skin;
		if (s === state) show(skin, k, k < 1 ? `translateY(${n((1 - k) * 4, 2)}px)` : "");
		else if (s === prev && k < 1) show(skin, 1 - k, `translateY(${n(-k * 4, 2)}px)`);
		else show(skin, 0);
	}
	for (const spin of el.querySelectorAll<SVGElement>("[data-spin] .fig-icon")) css(spin, "transform", `rotate(${n((t * 400) % 360, 1)}deg)`);
}

/** Fades and scales a presence avatar (or anything round) in and out. */
export function renderPresence(el: HTMLElement | null, p: number) {
	const k = clamp(p);
	show(el, k, k < 1 ? `scale(${n(0.75 + 0.25 * k)})` : "");
}

/**
 * A run of text being typed: `.fig-run` holding `.fig-run-on` (what's typed)
 * and `.fig-run-off` (the rest). With `reserve`, the rest is laid out but
 * invisible, so lines wrap where they'll end up and nothing reflows as it types.
 */
export function renderRun(el: HTMLElement, full: string, count: number, reserve = false) {
	const c = Math.max(0, Math.min(full.length, Math.round(count)));
	text(el.querySelector(".fig-run-on"), full.slice(0, c));
	text(el.querySelector(".fig-run-off"), reserve ? full.slice(c) : "");
}

/** A caret (remote or local): its line's opacity, and its name flag's. */
export function renderCaret(el: HTMLElement | null, on: number, flag = 0) {
	if (!el) return;
	css(el, "--caret-on", clamp(on));
	const label = el.querySelector<HTMLElement>(".fig-flag");
	if (label) show(label, clamp(flag) * clamp(on), flag < 1 ? `translateY(${n((1 - clamp(flag)) * 2, 2)}px)` : "");
}

/** cursors.ts: a name flag shows for 2.5 s after its caret last moved, then fades over 150 ms. */
export function flagAfterMove(t: number, lastMove: number, hold = 2.5) {
	if (t < lastMove) return 0;
	return 1 - prog(t, lastMove + hold, lastMove + hold + 0.15);
}

/** Tints text that just arrived in its author's colour, fading over `fade` seconds. */
export function renderArrival(el: HTMLElement | null, t: number, at: number, fade = 1.4) {
	const k = t < at ? 0 : 1 - ease.inOut(prog(t, at + 0.3, at + 0.3 + fade));
	css(el, "--hl", k);
}

/**
 * Opens or closes a `.fig-collapse` block: its height and opacity follow p,
 * with content rising 4px into place.
 */
export function renderCollapse(el: HTMLElement | null, p: number) {
	if (!el) return;
	const k = clamp(p);
	css(el, "grid-template-rows", `${n(k)}fr`);
	css(el, "opacity", k);
	css(el, "--rise", `${n((1 - k) * 4, 2)}px`);
	css(el, "visibility", k <= 0.001 ? "hidden" : null);
}

/** Text that has been lost: turns the danger colour (p 0-1), then a strike draws through it. */
export function renderLost(el: HTMLElement | null, p: number) {
	css(el, "--lost", clamp(p));
}

/** A status pill arriving: fades up 4px. */
export function renderPill(el: HTMLElement | null, p: number) {
	const k = ease.out(clamp(p));
	show(el, k, k < 1 ? `translateY(${n((1 - k) * 4, 2)}px)` : "");
}

const riseEase = bezier(0.2, 0.8, 0.2, 1);

/**
 * How far an entrance has played at t: 0 before `at`, 1 once it's done.
 * Entrances are short and staggered, like a diagram assembling itself.
 */
export function entered(t: number, at: number, dur = 0.5) {
	return riseEase(prog(t, at, at + dur));
}

/** An element entering: fades in while rising 8px (`rise`), or only fades (`fade`). */
export function renderEnter(el: HTMLElement | SVGElement | null, t: number, at: number, kind: "rise" | "fade" = "rise", dur = kind === "rise" ? 0.5 : 0.4) {
	const k = entered(t, at, dur);
	show(el, k, kind === "rise" && k < 1 ? `translateY(${n((1 - k) * 8, 2)}px)` : "");
}
