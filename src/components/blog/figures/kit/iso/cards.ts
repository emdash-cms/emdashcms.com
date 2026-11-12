/**
 * The flat parts that float over an isometric scene, as HTML in a
 * foreignObject so text stays horizontal and crisp: a person's browser
 * window with EmDash's editor in it, the stored version over the database,
 * and a checklist. Text that changes over time is a run or a bar the scene
 * drives with live.ts and the kit's render helpers.
 */
import { avatarSVG } from "../avatar";
import { PEOPLE, type PersonKey, personStyle } from "../cast";
import { icon } from "../icons";
import type { Size } from "./iso";

/** Text that a scene types or reveals: `data-run="<run>"`. Without `typed`, it starts fully shown. */
export interface Run {
	run: string;
	text: string;
	/** The author, for tints and carets. */
	who?: PersonKey;
	/** Tinted in the author's colour; --hl on the run (0 to 1) sets how strongly. Set `tint: "on"` to start lit. */
	tint?: "off" | "on";
	/** Starts empty: the scene types it with renderRun(). */
	typed?: boolean;
	/** Can be struck through: --lost on the run (0 to 1), see the kit's renderLost(). */
	lost?: boolean;
	/** A caret that follows the typing. */
	caret?: Caret;
}

/** A caret inside text: `data-caret="<caret>"`. Remote carets carry a name flag above them. */
export interface Caret {
	caret: string;
	who: PersonKey;
	local?: boolean;
	/** The flag hangs back over the text, for a caret near the end of a line. */
	hang?: boolean;
}

export type Inline = string | Run | Caret;

/** One line of an abstract document (small windows): `data-bar="<id>"`, grown by renderBar(). */
export interface Bar {
	/** Width as a percentage of the line. */
	w: number;
	who?: PersonKey;
	id?: string;
	/** Starts empty. */
	typed?: boolean;
	lost?: boolean;
}

export type Block =
	| { title: Inline[] }
	| { p: Inline[]; id?: string }
	| { field: string; text: Inline[]; id?: string }
	/** A field drawn as bars; an empty label leaves only the box. */
	| { fieldBars: string; bars: Bar[]; id?: string }
	| { bars: Bar[]; id?: string; title?: boolean };

const WJ = "⁠";

function caretHTML(c: Caret) {
	if (c.local) return `<span class="fig-caret fig-caret--local" data-caret="${c.caret}">${WJ}${WJ}</span>`;
	return `<span class="fig-caret${c.hang ? " fig-caret--hang" : ""}" data-caret="${c.caret}" style="${personStyle(c.who)}">${WJ}<span class="fig-flag">${PEOPLE[c.who].name}</span>${WJ}</span>`;
}

function runHTML(r: Run) {
	const cls = ["fig-run", "iw-run", r.lost ? "fig-lost" : ""].filter(Boolean).join(" ");
	const style = [r.who ? personStyle(r.who) : "", r.tint === "on" ? "--hl:1" : ""].filter(Boolean).join(";");
	const on = r.typed ? "" : r.text;
	const off = r.typed ? r.text : "";
	return `<span class="${cls}" data-run="${r.run}"${r.tint ? " data-tint" : ""}${style ? ` style="${style}"` : ""}><span class="fig-run-on">${on}</span>${r.caret ? caretHTML(r.caret) : ""}<span class="fig-run-off">${off}</span></span>`;
}

function inlineHTML(parts: readonly Inline[]) {
	return parts
		.map((p) => {
			if (typeof p === "string") return p;
			if ("run" in p) return runHTML(p);
			return caretHTML(p);
		})
		.join("");
}

function barsHTML(bars: readonly Bar[], title = false) {
	return bars
		.map((b) => {
			const cls = ["iw-sk", title ? "iw-sk--title" : "", b.lost ? "iw-sk--lost" : ""].filter(Boolean).join(" ");
			const style = [`--w:${b.w}%`, b.who ? personStyle(b.who) : "", b.typed ? "--grow:0" : ""].filter(Boolean).join(";");
			return `<span class="${cls}"${b.id ? ` data-bar="${b.id}"` : ""}${b.who ? ` data-who="${b.who}"` : ""} style="${style}"></span>`;
		})
		.join("");
}

export function docHTML(blocks: readonly Block[]) {
	return blocks
		.map((b) => {
			if ("title" in b && !("bars" in b)) return `<div class="iw-title">${inlineHTML(b.title)}</div>`;
			if ("p" in b) return `<div class="iw-p"${b.id ? ` data-block="${b.id}"` : ""}>${inlineHTML(b.p)}</div>`;
			if ("field" in b)
				return `<div class="iw-field"${b.id ? ` data-block="${b.id}"` : ""}><span class="iw-field-label">${b.field}</span><span class="iw-field-box">${inlineHTML(b.text)}</span></div>`;
			if ("fieldBars" in b)
				return `<div class="iw-field iw-field--bars"${b.id ? ` data-block="${b.id}"` : ""}>${b.fieldBars ? `<span class="iw-field-label">${b.fieldBars}</span>` : ""}<span class="iw-field-box">${barsHTML(b.bars)}</span></div>`;
			return `<div class="iw-line${b.title ? " iw-line--title" : ""}"${b.id ? ` data-block="${b.id}"` : ""}>${barsHTML(b.bars, b.title)}</div>`;
		})
		.join("");
}

export type SaveState = "saved" | "save" | "saving" | "offline";

const SAVE: Record<SaveState, { label: string; icon: "check" | "floppy" | "spinner" | "cloudSlash" }> = {
	saved: { label: "Saved", icon: "check" },
	save: { label: "Save", icon: "floppy" },
	saving: { label: "Saving…", icon: "spinner" },
	offline: { label: "Offline", icon: "cloudSlash" },
};

/**
 * The editor's Save button with every state it can show in one cell, the
 * first one visible. live.ts's renderSaveButton() picks the state for t.
 */
function saveButtonHTML(states: readonly SaveState[], size: Size) {
	const iconSize = size === "sm" ? 11 : 12;
	const skins = states
		.map((s, i) => {
			const { label, icon: name } = SAVE[s];
			const hidden = i > 0 ? ` style="opacity:0;visibility:hidden"` : "";
			return `<span data-skin="${s}"${name === "spinner" ? " data-spin" : ""}${hidden}>${icon(name, iconSize)}<span>${label}</span></span>`;
		})
		.join("");
	return `<span class="iw-save" data-save data-state="${states[0]}"><span class="fig-status">${skins}</span></span>`;
}

export interface WindowOpts {
	who: PersonKey;
	size: Size;
	doc: readonly Block[];
	/** The other people present, in the top bar: `data-presence="<who>"`. */
	presence?: readonly PersonKey[];
	/** The Save button's states, the first showing at rest. */
	save?: readonly SaveState[];
	/** Draws the closed outline under the live window, for a tab that closes: see renderClosed(). */
	closable?: boolean;
	part?: string;
}

function chromeHTML(who: PersonKey, size: Size) {
	const me = size === "sm" ? 12 : 16;
	return `<div class="iw-chrome"><span class="iw-dots"><i></i><i></i><i></i></span><span class="iw-url">${icon("lock", size === "sm" ? 8 : 10)}</span><span class="iw-me">${avatarSVG(PEOPLE[who].id, PEOPLE[who].name, me)}<span>${PEOPLE[who].name}</span></span></div>`;
}

/** A browser window: chrome with the profile chip, the editor's top bar, then the document. */
export function browserWindow({ who, size, doc, presence = [], save = ["saved"], closable = false, part = `win-${who}` }: WindowOpts) {
	const face = size === "sm" ? 14 : 18;
	const faces = presence
		.map((p) => `<span class="iw-face" data-presence="${p}">${avatarSVG(PEOPLE[p].id, PEOPLE[p].name, face)}</span>`)
		.join("");
	const back = size === "lg" ? `${icon("arrowLeft", 12)}<span>Posts</span>` : icon("arrowLeft", size === "sm" ? 10 : 12);
	const publish = size === "sm" ? icon("upload", 10) : `<span>Publish</span>`;
	const live = `<div class="iw-live">${chromeHTML(who, size)}<div class="iw-bar"><span class="iw-back">${back}</span><span class="iw-presence">${faces}</span>${saveButtonHTML(save, size)}<span class="iw-publish" data-publish>${publish}</span></div><div class="iw-doc">${docHTML(doc)}</div></div>`;
	const ghost = closable ? `<div class="iw-ghost" style="opacity:0;visibility:hidden">${chromeHTML(who, size)}</div>` : "";
	return `<div class="iw iw--${size}" data-part="${part}" data-who="${who}">${ghost}${live}</div>`;
}

/**
 * The stored version: a sheet with the document, and an outcome mark in its
 * corner for each `outcomes` entry (`data-outcome="lost"` or `"kept"`, hidden
 * until a scene shows one with renderOutcome()).
 */
export function storedCard({ doc, size, outcomes = [], part = "stored" }: { doc: readonly Block[]; size: Size; outcomes?: ReadonlyArray<"lost" | "kept">; part?: string }) {
	const marks = outcomes
		.map((o) => `<span class="is-mark" data-outcome="${o}" style="opacity:0;visibility:hidden">${icon(o === "lost" ? "xCircle" : "checkCircle", size === "sm" ? 16 : 18)}</span>`)
		.join("");
	return `<div class="is is--${size}" data-part="${part}">${marks}<div class="iw-doc">${docHTML(doc)}</div></div>`;
}

/**
 * A titled checklist (Content save's checks): `data-check="<i>"` per item.
 * With `ticks`, each item starts as an empty ring that live.ts's renderTick()
 * turns into a check.
 */
export function checklist(title: string, items: readonly string[], { part = "checks", ticks = false } = {}) {
	const mark = ticks ? `<span class="ick-tick"><span class="ick-off"></span><span class="ick-on" style="opacity:0;visibility:hidden">${icon("checkCircle", 14)}</span></span>` : icon("checkCircle", 14);
	return `<div class="ick" data-part="${part}"><div class="ick-title">${title}</div>${items.map((c, i) => `<div class="ick-item" data-check="${i}">${mark}<span>${c}</span></div>`).join("")}</div>`;
}

/** Flat HTML at a screen rectangle, inside the scene's SVG. */
export function fo(x: number, y: number, w: number, h: number, html: string, part = "") {
	return `<foreignObject${part ? ` data-part="${part}"` : ""} x="${+x.toFixed(2)}" y="${+y.toFixed(2)}" width="${+w.toFixed(2)}" height="${+h.toFixed(2)}"><div xmlns="http://www.w3.org/1999/xhtml" class="ifo">${html}</div></foreignObject>`;
}
