import {
	all,
	css,
	ease,
	entered,
	flagAfterMove,
	one,
	prog,
	renderArrival,
	renderCaret,
	renderEnter,
	renderPresence,
	renderRun,
	renderStatus,
	type Scene,
	show,
	type StatusTrack,
	text,
	typedCount,
} from "./kit";
import { n } from "./kit/dom";
import { renderSaveButton } from "./kit/iso/live";
import { at, AXIS, f, info, INTRO, KEYS, LATEST, R, realAt, SPEED, TEXT } from "./saved-means-saved";

/** cursors.ts keeps a name flag up for 2.5 real seconds after its caret moves. */
const FLAG_HOLD = 2.5 / SPEED;
/** How long a mark on the timeline takes to appear once the playhead reaches it. */
const POP = 0.18;

const first = (times: readonly number[]) => times[0]!;
const lastBefore = (times: readonly number[], r: number) => {
	const n = typedCount(times, r);
	return n > 0 ? at(times[n - 1]!) : Number.NEGATIVE_INFINITY;
};

/**
 * The Save button in a room (ContentEditor.tsx, EditorActions): "Save" while
 * Maya has edits no checkpoint holds, "Saved" once one does, and "Offline"
 * from 5 s after the connection drops until it's back. The room's own saves
 * wait on no one, so the button never shows "Saving..." here.
 */
const SAVE: StatusTrack = [
	[0, "saved"],
	[at(first(KEYS.maya)), "save"],
	[at(R.save1), "saved"],
	[at(R.offline), "offline"],
	[at(R.back), "save"],
	[at(R.save2), "saved"],
];

const LISTED = [at(R.save1 + R.listed), at(R.save2 + R.listed)] as const;
const LATEST_TRACK: StatusTrack = [
	[0, LATEST[0].id],
	[LISTED[0], LATEST[1].id],
	[LISTED[1], LATEST[2].id],
];

/** How many real seconds of a span from `from` to `to` the playhead has covered at r. */
const grown = (r: number, from: number, to: number) => Math.max(0, Math.min(r, to) - from);

export const scene: Scene = {
	...info,
	setup(stage) {
		const q = (part: string) => one(stage, `[data-part="${part}"]`);
		const editor = q("editor");
		const history = q("history");
		const chart = q("chart");
		const parts = {
			saveButton: one(editor, "[data-save]"),
			publish: one(editor, "[data-publish]"),
			noahAvatar: one(editor, '[data-presence="noah"]'),
			anaAvatar: one(editor, '[data-presence="ana"]'),
			mayaRun: one(editor, '[data-run="maya"]'),
			mayaCaret: one(editor, '[data-caret="maya"]'),
			anaRun: one(editor, '[data-run="ana"]'),
			anaCaret: one(editor, '[data-caret="ana"]'),
			noahParagraph: one(editor, '[data-block="noah"]'),
			noahText: one(editor, '[data-run="noah"]'),
			noahCaret: one(editor, '[data-caret="noah"]'),
			noahBefore: one(editor, '[data-caret="noah-before"]'),
			latest: q("latest"),
			latestDot: q("latest-dot"),
			latestTime: one(stage, '[data-status="latest-time"]'),
			latestPeople: one(stage, '[data-status="latest-people"]'),
			now: q("now"),
			band: q("band"),
			notice: q("band-notice"),
			offlineBracket: q("bracket-offline"),
			offlineNote: q("offline-note"),
			guides: [q("guide-1"), q("guide-2")],
			brackets: [q("bracket-1"), q("bracket-2")],
		};
		const dots = all(chart, "[data-r]").map((el) => ({
			el,
			r: Number(el.dataset.r),
			offline: el.hasAttribute("data-offline"),
		}));
		const offlineDots = dots.filter((d) => d.offline);
		const saves = all(chart, "[data-save]").map((el) => ({ el, r: Number(el.dataset.save) }));
		const fills = new Map(offlineDots.map((d, i) => [d.el, at(R.back) + 0.04 + i * 0.025]));
		const fullText = TEXT.maya + TEXT.mayaOffline;

		return {
			render(t) {
				const r = realAt(t);

				// The cards rise in, then the chart fades in under them.
				renderEnter(editor, t, 0);
				renderEnter(history, t, 0.08);
				renderEnter(chart, t, 0.2, "fade");

				// Maya's editor bar. When her socket closes, the others' presence goes with it.
				renderSaveButton(parts.saveButton, SAVE, t);
				// Offline, the editor can't publish until the connection is back.
				const offline = prog(t, at(R.offline), at(R.offline) + 0.2) - prog(t, at(R.back), at(R.back) + 0.2);
				css(parts.publish, "opacity", n(1 - 0.5 * offline));
				const away = prog(t, at(R.drop), at(R.drop) + 0.25) - prog(t, at(R.back) + 0.08, at(R.back) + 0.33);
				renderPresence(parts.noahAvatar, entered(t, 0.3, 0.35) * (1 - away));
				renderPresence(parts.anaAvatar, entered(t, 0.36, 0.35) * (1 - away));

				// The document: Maya types, online and then offline; Ana's words arrive as she types;
				// Noah's, typed while Maya was away, arrive when she's back.
				const caretIn = entered(t, 0.3, 0.3);
				const typed = typedCount(KEYS.maya, r) + typedCount(KEYS.mayaOffline, r);
				renderRun(parts.mayaRun, fullText, typed, true);
				renderCaret(parts.mayaCaret, caretIn);
				renderRun(parts.anaRun, TEXT.ana, typedCount(KEYS.ana, r));
				renderCaret(parts.anaCaret, caretIn * (1 - away), flagAfterMove(t, lastBefore(KEYS.ana, r), FLAG_HOLD));
				const landed = at(R.back) + 0.05;
				show(parts.noahParagraph, prog(t, landed, landed + 0.2));
				renderArrival(parts.noahText, t, landed);
				renderCaret(parts.noahBefore, t < landed ? caretIn * (1 - away) : 0);
				renderCaret(parts.noahCaret, t >= landed ? 1 - away : 0, t >= landed ? flagAfterMove(t, landed, FLAG_HOLD) : 0);

				// Revisions: the latest autosave row is replaced after each save, and lights up as it is.
				renderStatus(parts.latestTime, LATEST_TRACK, t);
				renderStatus(parts.latestPeople, LATEST_TRACK, t);
				renderArrival(parts.latest, t, t >= LISTED[1] ? LISTED[1] : LISTED[0]);
				css(parts.latestDot, "--solo", 1 - ease.out(prog(t, LISTED[0], LISTED[0] + 0.2)));

				// The timeline. The playhead walks the axis; marks appear as it reaches them.
				css(parts.now, "--f", f(r));
				css(parts.now, "opacity", prog(t, INTRO - 0.1, INTRO + 0.1) * (1 - prog(t, at(R.save2 + 1.4), at(R.save2 + 2))));
				for (const d of dots) {
					const k = entered(t, at(d.r), POP);
					show(d.el, k, k < 1 ? `scale(${(0.4 + 0.6 * k).toFixed(3)})` : "");
					if (d.offline) css(d.el, "--fill", ease.out(prog(t, fills.get(d.el)!, fills.get(d.el)! + 0.18)));
				}
				for (const s of saves) {
					const k = entered(t, at(s.r), 0.3);
					show(s.el, k, k < 1 ? `scale(${(0.5 + 0.5 * k).toFixed(3)})` : "");
				}

				const down = grown(r, R.drop, R.back);
				show(parts.band, down > 0 ? 1 : 0);
				css(parts.band, "--w", down / AXIS);
				const notice = grown(r, R.offline, R.back);
				show(parts.notice, notice > 0 ? 1 : 0);
				css(parts.notice, "--w", notice / AXIS);
				renderBracket(parts.offlineBracket, r, t, R.drop, R.offline);
				const noted = ease.out(prog(t, at(R.offline), at(R.offline) + 0.25));
				show(parts.offlineNote, noted, noted < 1 ? `translateY(${((1 - noted) * 3).toFixed(2)}px)` : "");

				const from = [R.lastEdit, R.back];
				const to = [R.save1, R.save2];
				for (let i = 0; i < 2; i++) {
					show(parts.guides[i], ease.out(prog(t, at(from[i]!), at(from[i]!) + 0.2)));
					renderBracket(parts.brackets[i]!, r, t, from[i]!, to[i]!);
				}
			},
		};
	},
};

/** A bracket that grows with the playhead from `from` to `to`, its label counting the seconds. */
function renderBracket(el: HTMLElement, r: number, t: number, from: number, to: number) {
	const w = grown(r, from, to);
	show(el, w > 0 ? 1 : 0);
	css(el, "--w", w / AXIS);
	css(el, "--end", ease.out(prog(t, at(to), at(to) + 0.2)));
	// While it grows, the label counts the seconds; once it's whole, it reads the delay.
	const label = el.firstElementChild as HTMLElement | null;
	text(label, r >= to ? `${Math.round(to - from)} s` : `${w.toFixed(1)} s`);
	show(label, ease.out(prog(t, at(from + 0.35), at(from + 0.55))));
}
