/**
 * Figure 3, "Saved means saved": Maya's browser window with EmDash's editor,
 * her Revisions panel and a timeline in real seconds. The room saves 2 s after the latest edit. When her
 * connection drops, her Save button shows Offline 5 s later; she keeps typing,
 * and her edits merge and save when she's back.
 */

import type { SceneInfo } from "./kit/scene";
import { typingTimes } from "./kit/motion";

export const TEXT = {
	title: "What's new",
	titleEnd: " in 1.5",
	lead: "Your team can now write together.",
	maya: " Invite anyone to an entry.",
	mayaOffline: " It works offline, too.",
	p2: "It's off by default",
	ana: " for now",
	p2End: ".",
	noah: "Turn it on in your config.",
};

/** The timeline's axis, in real seconds. */
export const AXIS = 20;
export const AXIS_TICKS = [0, 5, 10, 15, 20];

/** After the intro, the animation runs this many times faster than real time. */
export const SPEED = 1.5;
export const INTRO = 0.9;
/** The animation time at which `real` seconds have passed on the axis. */
export const at = (real: number) => INTRO + real / SPEED;
/** The axis time at animation time t. */
export const realAt = (t: number) => (t - INTRO) * SPEED;

/** When each character lands, in real seconds. */
export const KEYS = {
	maya: typingTimes(TEXT.maya, 0.4, 2.8, 3),
	ana: typingTimes(TEXT.ana, 1.1, 2.0, 5),
	mayaOffline: typingTimes(TEXT.mayaOffline, 11.5, 14.0, 7),
	noah: typingTimes(TEXT.noah, 12.5, 14.4, 9),
};

const last = (times: readonly number[]) => times[times.length - 1]!;

/** limits.ts: the room saves 2 s after the latest edit. session.ts: Offline shows 5 s after a drop. */
export const SAVE_DELAY = 2;
export const OFFLINE_NOTICE = 5;

/** The story's beats, in real seconds. */
export const R = {
	lastEdit: last(KEYS.maya),
	save1: last(KEYS.maya) + SAVE_DELAY,
	drop: 6.0,
	offline: 6.0 + OFFLINE_NOTICE,
	back: 15.2,
	save2: 15.2 + SAVE_DELAY,
	/** The Revisions list refetches when a save's checkpoint reaches the tab. */
	listed: 0.5,
};

/** A person's row on the chart: keystrokes at least `gap` apart, always keeping the last. */
export interface Edit {
	r: number;
	/** Hidden in the compact layout, where every other edit would crowd its neighbour. */
	thin: boolean;
	/** Hidden on a phone, which keeps every third edit. */
	sparse: boolean;
}

function edits(times: readonly number[], gap = 0.21): Edit[] {
	const kept: number[] = [];
	for (let i = times.length - 1; i >= 0; i--) {
		const r = times[i]!;
		if (!kept.length || kept[0]! - r >= gap) kept.unshift(r);
	}
	return kept.map((r, i) => ({ r, thin: (kept.length - 1 - i) % 2 === 1, sparse: (kept.length - 1 - i) % 3 !== 0 }));
}

export const EDITS = {
	maya: edits(KEYS.maya),
	mayaOffline: edits(KEYS.mayaOffline),
	ana: edits(KEYS.ana),
	noah: edits(KEYS.noah),
};

/** Where a real time sits on the axis, 0 to 1. */
export const f = (real: number) => Math.min(1, Math.max(0, real / AXIS));

/**
 * The Revisions panel's latest row. A room save is an autosave, and an autosave
 * replaces the autosave before it, naming the save's editors and then the ones it
 * carried, latest first (revisionCredit in emdash-runtime.ts). people() in
 * revision-format.ts names two, then "and N other person".
 */
export const LATEST = [
	{ id: "before", time: "10:38 AM", people: "Ana" },
	{ id: "first", time: "10:41 AM", people: "Maya and Ana" },
	{ id: "merged", time: "10:42 AM", people: "Maya, Noah, and 1 other person" },
] as const;

const step = (real: number) => at(real);

export const info: SceneInfo = {
	duration: 14.6,
	intro: INTRO,
	steps: [
		{ at: 0, label: "Maya types" },
		{ at: step(R.lastEdit), label: "Saved 2 s later" },
		{ at: step(5.75), label: "Connection drops" },
		{ at: step(8.6), label: "Offline after 5 s" },
		{ at: step(11.3), label: "She keeps typing" },
		{ at: step(14.9), label: "Merged and saved" },
		{ at: step(R.save2 + 0.4), label: "In the history" },
	],
};
