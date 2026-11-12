/**
 * Figure 1, "Relay or room": WordPress's own example. Noah's connection drops
 * while Ana keeps writing, saves and leaves. When browsers save, Noah's stale
 * copy overwrites her work. When the room saves, his edits merge into hers.
 */

import type { SceneInfo } from "./kit/scene";

export const TEXT = {
	title: "Write together",
	lead: "Edit one post with your",
	whole: " whole",
	rest: " team.",
	offline: "Even offline.",
	sentence: "Everyone gets a cursor.",
};

/** When each beat happens, in seconds. Both modes share them. */
export const T = {
	intro: 0.9,
	whole: [1.05, 1.95] as const,
	offline: 2.75,
	sentence: [3.85, 5.55] as const,
	noahTypes: [4.05, 5.2] as const,
	save: 6.35,
	leave: 7.75,
	online: 8.75,
};

export const info: SceneInfo = {
	duration: 12.9,
	intro: T.intro,
	steps: [
		{ at: 0, label: "Both editing" },
		{ at: 2.6, label: "Noah goes offline" },
		{ at: 3.6, label: "Both keep writing" },
		{ at: 6.2, label: "Ana saves and leaves" },
		{ at: 8.6, label: "Noah comes back" },
	],
	modes: [
		{ id: "browsers", label: "Browsers save" },
		{ id: "room", label: "The room saves" },
	],
	modesLabel: "Who saves",
};

export type ModeId = "browsers" | "room";
