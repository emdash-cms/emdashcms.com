/**
 * Figure 4, "Fuzz runs": 10,000 runs in which three editors make 200
 * concurrent edits, with the old editor schema or the tolerant one. Each run
 * is a square that fills in as the run finishes. The counts are the fuzzer's;
 * which squares lost content is illustrative, from a fixed-seed shuffle.
 */

import type { SceneInfo } from "./kit/scene";

/** Round 2 of the schema-safety fuzz: 10,000 runs of 200 edits, delivered in order. */
export const RESULTS = {
	runs: 10_000,
	old: { lostRuns: 1_213, chars: 16_995, atoms: 110 },
	new: { lostRuns: 0, chars: 0, atoms: 0 },
} as const;

/** Squares per side. */
export const SIDE = 100;

/** When each beat happens, in seconds. */
export const T = {
	intro: 0.7,
	/** Runs finish between these times, slowly at first and last. */
	fill: [0.8, 8.6] as const,
	/** The cause: two concurrent edits, the merge, then what the schema does with it. */
	edits: 4.05,
	merge: 5.1,
	verdict: 6.0,
};

export const info: SceneInfo = {
	duration: 9.4,
	intro: T.intro,
	steps: [
		{ at: 0, label: "Runs start" },
		{ at: 2.0, label: { old: "Counting lost content", new: "Nothing lost" } },
		{ at: 3.9, label: { old: "Why it happened", new: "Why nothing was lost" } },
		{ at: 7.0, label: "10,000 runs" },
	],
	modes: [
		{ id: "old", label: "Old schema" },
		{ id: "new", label: "New schema" },
	],
	modesLabel: "Editor schema",
};

export type ModeId = "old" | "new";

/** mulberry32: small, fast and the same on every engine. */
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

export interface Runs {
	/** When each square's run finishes, by square (row-major). */
	doneAt: Float32Array;
	/** The same times in finishing order, ascending. */
	finishTimes: Float32Array;
	/** 1 where the old schema's run lost content, by square. */
	lost: Uint8Array;
	/** Among the first k runs to finish: how many lost content, and how many characters and atoms. */
	lostBy: Uint16Array;
	charsBy: Uint32Array;
	atomsBy: Uint16Array;
}

/**
 * Lays out the runs: which squares lose content (scattered at random), how
 * much each loses (summing to the fuzzer's totals), and when each finishes.
 * Runs finish in a soft diagonal sweep with a wide, ragged front.
 */
export function buildRuns(progress: (p: number) => number): Runs {
	const n = SIDE * SIDE;
	const { lostRuns, chars, atoms } = RESULTS.old;

	// Which runs lost content: a partial Fisher-Yates shuffle.
	const pick = rng(1213);
	const cells = Array.from({ length: n }, (_, i) => i);
	for (let i = 0; i < lostRuns; i++) {
		const j = i + Math.floor(pick() * (n - i));
		[cells[i], cells[j]] = [cells[j]!, cells[i]!];
	}
	const failed = cells.slice(0, lostRuns);
	const lost = new Uint8Array(n);
	for (const cell of failed) lost[cell] = 1;

	// Characters per failed run: log-normal weights, at least 1 each, summing exactly.
	const size = rng(16995);
	const gauss = () => Math.sqrt(-2 * Math.log(1 - size())) * Math.cos(2 * Math.PI * size());
	const weights = failed.map(() => Math.exp(gauss() * 0.9));
	const total = weights.reduce((a, b) => a + b, 0);
	const spare = chars - lostRuns;
	const shares = weights.map((w) => (w / total) * spare);
	const charsOf = new Uint16Array(n);
	let given = 0;
	failed.forEach((cell, i) => {
		const whole = Math.floor(shares[i]!);
		charsOf[cell] = 1 + whole;
		given += whole;
	});
	const byRemainder = failed.map((_, i) => i).sort((a, b) => (shares[b]! % 1) - (shares[a]! % 1));
	for (let i = 0; i < spare - given; i++) {
		const cell = failed[byRemainder[i]!]!;
		charsOf[cell] = charsOf[cell]! + 1;
	}

	// One image or embed each in 110 of the failed runs.
	const atomsOf = new Uint8Array(n);
	for (const cell of failed.slice(lostRuns - atoms)) atomsOf[cell] = 1;

	// Finishing order: a diagonal sweep, bent a little, with each run's place jittered.
	const jitter = rng(200);
	const key = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const r = Math.floor(i / SIDE);
		const c = i % SIDE;
		const bend = 0.05 * Math.sin(r * 0.09 + 1.3) + 0.04 * Math.sin(c * 0.07 + 0.4);
		key[i] = ((c * 0.58 + r * 0.42) / (SIDE - 1) + bend) * 0.6 + jitter() * 0.4;
	}
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => key[a]! - key[b]!);

	// Finish times: sample the progress curve in 1/120 s batches.
	const [t0, t1] = T.fill;
	const doneAt = new Float32Array(n);
	const finishTimes = new Float32Array(n);
	let k = 0;
	for (let step = 0; k < n; step++) {
		const t = Math.min(t1, t0 + step / 120);
		const due = t >= t1 ? n : Math.round(progress((t - t0) / (t1 - t0)) * n);
		for (; k < due; k++) {
			doneAt[order[k]!] = t;
			finishTimes[k] = t;
		}
	}

	const lostBy = new Uint16Array(n + 1);
	const charsBy = new Uint32Array(n + 1);
	const atomsBy = new Uint16Array(n + 1);
	order.forEach((cell, i) => {
		lostBy[i + 1] = lostBy[i]! + lost[cell]!;
		charsBy[i + 1] = charsBy[i]! + charsOf[cell]!;
		atomsBy[i + 1] = atomsBy[i]! + atomsOf[cell]!;
	});

	return { doneAt, finishTimes, lost, lostBy, charsBy, atomsBy };
}

/** How many runs have finished at t: the first index whose finish time is after t. */
export function finishedAt(times: Float32Array, t: number) {
	let lo = 0;
	let hi = times.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (times[mid]! <= t) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}
