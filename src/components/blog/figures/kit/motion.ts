/**
 * Time helpers for figure scenes. Every frame is a function of t (seconds),
 * so nothing here keeps state: seeking, replaying and screenshots all land on
 * the same frame.
 */

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 0 before a, 1 after b, linear between. */
export const prog = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

/** CSS-style cubic-bezier easing. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
	const sy = (u: number) => ((ay * u + by) * u + cy) * u;
	const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
	return (p: number) => {
		if (p <= 0) return 0;
		if (p >= 1) return 1;
		let u = p;
		for (let i = 0; i < 8; i++) {
			const err = sx(u) - p;
			const d = dx(u);
			if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break;
			u -= err / d;
		}
		return sy(clamp(u));
	};
}

export const ease = {
	linear: (p: number) => p,
	/** Quick start, long settle: things arriving. */
	out: bezier(0.16, 1, 0.3, 1),
	/** Symmetric: things travelling between two places. */
	inOut: bezier(0.45, 0, 0.2, 1),
	/** Slow start: things leaving. */
	in: bezier(0.55, 0, 0.9, 0.3),
};

/**
 * A damped spring from 0 to 1, as a function of seconds since it was let go.
 * Critically damped springs never overshoot; `bounce` above 0 lets it.
 */
export function spring(s: number, { duration = 0.5, bounce = 0.15 } = {}) {
	if (s <= 0) return 0;
	const omega = (2 * Math.PI) / duration;
	const zeta = 1 - clamp(bounce, 0, 0.9);
	if (zeta >= 1) return 1 - (1 + omega * s) * Math.exp(-omega * s);
	const wd = omega * Math.sqrt(1 - zeta * zeta);
	const decay = Math.exp(-zeta * omega * s);
	return 1 - decay * (Math.cos(wd * s) + ((zeta * omega) / wd) * Math.sin(wd * s));
}

/** A value that steps between states at given times: the last entry at or before t wins. */
export function stateAt<S>(track: ReadonlyArray<readonly [number, S]>, t: number): { state: S; since: number; prev: S | undefined } {
	let i = 0;
	while (i + 1 < track.length && track[i + 1]![0] <= t) i++;
	const [since, state] = track[i]!;
	return { state, since: t - since, prev: i > 0 ? track[i - 1]![1] : undefined };
}

function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let x = a;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/** When each character of `text` lands, typed between start and end with a human rhythm. */
export function typingTimes(text: string, start: number, end: number, seed = 1) {
	const r = rng(seed);
	const weights = [...text].map((ch, i) => {
		let w = 0.65 + r() * 0.7;
		if (ch === " ") w *= 1.25;
		if (",.".includes(ch)) w *= 1.9;
		if (i > 0 && text[i - 1] === " ") w *= 1.1;
		return w;
	});
	const total = weights.reduce((a, b) => a + b, 0);
	const times: number[] = [];
	let acc = 0;
	for (const w of weights) {
		acc += w;
		times.push(start + ((acc - w * 0.5) / total) * (end - start));
	}
	return times;
}

/** How many of the characters timed by `times` have landed at t. */
export function typedCount(times: readonly number[], t: number) {
	let n = 0;
	while (n < times.length && times[n]! <= t) n++;
	return n;
}
