/**
 * Figure 2, "How the parts fit": three editors share one entry's room. Noah's
 * edits travel through it, the room saves as Noah through Content save, and
 * an agent's write over MCP notifies the room, which merges it into every
 * open editor. On Cloudflare the room sleeps between messages; on Node.js it
 * runs in the site's own process.
 */

import type { SceneInfo } from "./kit/scene";

export const TEXT = {
	title: "Write together",
	body: "Edit one post as a team.",
	typed: "Everyone sees it live.",
	excerptLabel: "Excerpt",
	excerpt: "New in EmDash 1.5.",
};

/** When each beat happens, in seconds. The same beats play in both modes. */
export const T = {
	intro: 0.9,
	typing: [1.15, 2.85] as const,
	/** The room wakes for its save, which leaves for Content save. */
	save: 4.25,
	/** The agent's write leaves over MCP. */
	agent: 6.95,
	/** The database commit notifies the room. */
	notify: 9.1,
};

export const info: SceneInfo = {
	duration: 12.6,
	intro: T.intro,
	steps: [
		{ at: 0, label: "The room relays edits" },
		{ at: 3.95, label: "The room saves" },
		{ at: 6.65, label: "An agent writes" },
		{ at: 8.85, label: "The room merges it" },
	],
	modes: [
		{ id: "cloudflare", label: "Cloudflare" },
		{ id: "node", label: "Node.js" },
	],
	modesLabel: "Where the room runs",
};

export type ModeId = "cloudflare" | "node";

/** The three editors, left to right. Noah types; the room saves as him. */
export const EDITORS = ["matt", "noah", "ana"] as const;
