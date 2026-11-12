import { attr, css, ease, one, prog, renderCollapse, renderEnter, renderPill, type Scene, show, text } from "./kit";
import { n } from "./kit/dom";
import { bezier, clamp, lerp } from "./kit/motion";
import { buildRuns, finishedAt, info, type ModeId, type Runs, SIDE, T } from "./fuzz-runs";

/** Share of all runs finished, as a function of the share of fill time gone. */
const progress = bezier(0.4, 0, 0.4, 1);

/** A finished square rises to a highlight over RISE seconds, then settles to its colour by SETTLE. */
const RISE = 0.06;
const SETTLE = 0.7;
/** Shades a square passes through between finishing and settling. */
const LEVELS = 14;
const KINDS = ["done", "lost", "kept"] as const;
const DONE = 0;
const LOST = 1;
const KEPT = 2;
const PENDING_CODE = 1;
const codeOf = (kind: number, level: number) => 2 + kind * (LEVELS + 1) + level;

type RGB = readonly [number, number, number];

/**
 * The 10,000 squares on a canvas. Each square is a whole number of device
 * pixels with an even gap, so the grid stays crisp at any pixel ratio.
 * A paint compares every square's shade with the one last drawn and fills
 * only those that changed.
 */
class Grid {
	readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly probe: HTMLElement;
	private readonly scratch: CanvasRenderingContext2D;
	private readonly drawn = new Uint8Array(SIDE * SIDE);
	private readonly palette: string[] = [];
	private pitch = 0;
	private cell = 0;
	private ratio = 0;

	constructor(canvas: HTMLCanvasElement, probe: HTMLElement) {
		this.canvas = canvas;
		this.probe = probe;
		this.ctx = canvas.getContext("2d")!;
		const scratch = document.createElement("canvas");
		scratch.width = scratch.height = 1;
		this.scratch = scratch.getContext("2d", { willReadFrequently: true })!;
	}

	/** Sizes the canvas for a grid at most `max` CSS pixels wide, near `target`. Returns whether it changed. */
	size(target: number, max: number) {
		const dpr = window.devicePixelRatio || 1;
		let pitch = Math.max(3, Math.round((target * dpr) / SIDE));
		while (pitch > 3 && (pitch * SIDE) / dpr > max) pitch--;
		if (pitch === this.pitch && dpr === this.ratio) return false;
		this.pitch = pitch;
		this.ratio = dpr;
		const gap = Math.max(1, Math.round(pitch * 0.2));
		this.cell = pitch - gap;
		const px = pitch * SIDE - gap;
		this.canvas.width = this.canvas.height = px;
		css(this.canvas, "width", `${n(px / dpr, 4)}px`);
		css(this.canvas, "height", `${n(px / dpr, 4)}px`);
		this.invalidate();
		return true;
	}

	invalidate() {
		this.drawn.fill(0);
	}

	/** Reads the square colours from the figure's tokens, so the grid follows light and dark. */
	recolor() {
		const read = (token: string) => {
			this.probe.style.color = `var(${token})`;
			return this.rgb(getComputedStyle(this.probe).color);
		};
		const pending = read("--fz-pending");
		const ends: Record<(typeof KINDS)[number], [RGB, RGB]> = {
			done: [read("--fz-active"), read("--fz-done")],
			lost: [read("--fz-lost"), read("--fz-lost")],
			kept: [read("--fz-kept-active"), read("--fz-kept")],
		};
		const style = ([r, g, b]: RGB) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
		const mix = (a: RGB, b: RGB, p: number): RGB => [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)];
		this.palette.length = 0;
		this.palette[PENDING_CODE] = style(pending);
		KINDS.forEach((kind, k) => {
			const [peak, rest] = ends[kind];
			for (let level = 0; level <= LEVELS; level++) {
				const age = ((level + 1) / LEVELS) * SETTLE;
				const shade = age < RISE ? mix(pending, peak, ease.out(age / RISE)) : mix(peak, rest, ease.out(clamp((age - RISE) / (SETTLE - RISE))));
				this.palette[codeOf(k, level)] = style(level === LEVELS ? rest : shade);
			}
		});
		this.invalidate();
	}

	private rgb(value: string): RGB {
		const srgb = /^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)/.exec(value);
		if (srgb) return [clamp(+srgb[1]!) * 255, clamp(+srgb[2]!) * 255, clamp(+srgb[3]!) * 255];
		const ctx = this.scratch;
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = "#000";
		ctx.fillStyle = value;
		ctx.fillRect(0, 0, 1, 1);
		const d = ctx.getImageData(0, 0, 1, 1).data;
		return [d[0]!, d[1]!, d[2]!];
	}

	/** Draws every square for time t. `lost` marks runs that lose content; null when none do. */
	paint(runs: Runs, t: number, lost: Uint8Array | null) {
		if (!this.pitch || !this.palette.length) return;
		const { ctx, drawn, palette, pitch, cell } = this;
		const { doneAt } = runs;
		const step = SETTLE / LEVELS;
		let current = "";
		for (let i = 0; i < drawn.length; i++) {
			const age = t - doneAt[i]!;
			let code = PENDING_CODE;
			if (age >= 0) {
				const kind = lost ? (lost[i] ? LOST : DONE) : KEPT;
				code = codeOf(kind, age >= SETTLE ? LEVELS : Math.min(LEVELS - 1, Math.floor(age / step)));
			}
			if (drawn[i] === code) continue;
			drawn[i] = code;
			const fill = palette[code]!;
			if (fill !== current) {
				ctx.fillStyle = fill;
				current = fill;
			}
			ctx.fillRect((i % SIDE) * pitch, Math.floor(i / SIDE) * pitch, cell, cell);
		}
	}
}

const NUMBER = new Intl.NumberFormat("en-US");

/** Calls fn whenever the device pixel ratio changes, e.g. when the window moves to another screen. */
function onRatioChange(fn: () => void) {
	const query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
	query.addEventListener(
		"change",
		() => {
			fn();
			onRatioChange(fn);
		},
		{ once: true },
	);
}

export const scene: Scene = {
	...info,
	setup(stage) {
		const root = stage.closest<HTMLElement>(".fig") ?? stage;
		const el = (selector: string) => one(stage, selector);
		const chart = el('[data-part="chart"]');
		const counters = el('[data-part="counters"]');
		const why = el('[data-part="why"]');
		const grid = new Grid(one<HTMLCanvasElement>(stage, '[data-part="grid"]'), el('[data-part="probe"]'));
		const runs = buildRuns(progress);
		const count = {
			runs: el('[data-count="runs"]'),
			lost: el('[data-count="lost"]'),
			share: el('[data-count="share"]'),
			chars: el('[data-count="chars"]'),
			atoms: el('[data-count="atoms"]'),
		};
		const lostCounter = el('[data-counter="lost"]');
		const box = (id: string) => el(`[data-box="${id}"]`);
		const boxes = { root: box("root"), para: box("para"), list: box("list"), item: box("item") };
		const notes = { merged: el('[data-note="merged"]'), removed: el('[data-note="removed"]'), nested: el('[data-note="nested"]') };
		const rows = { para: el('[data-collapse="para"]'), list: el('[data-collapse="list"]') };
		const rule = el('[data-part="rule"]');
		const verdict = el('[data-part="verdict"]');
		const pills = el(".fz-pills");
		const paraRow = el('[data-collapse="para"] > div');
		// Where notes wrap, the paragraph's row can be taller than the verdict that takes its place.
		const reserve = () => {
			const gap = parseFloat(getComputedStyle(verdict).marginTop) || 0;
			css(pills, "min-height", `${Math.max(0, paraRow.scrollHeight - gap)}px`);
		};
		const deleted = el('[data-pill="deleted"]');
		const kept = el('[data-pill="kept"]');

		// The grid is as wide as the stage on phones, and a little over half of it beside the counters,
		// or a little under half where the counters need the room.
		const layoutEl = el(".fz");
		const fit = () => {
			const w = stage.clientWidth;
			if (root.offsetWidth < 600) return grid.size(w, w);
			const share = root.offsetWidth < 860 ? 0.46 : 0.56;
			const room = w - (parseFloat(getComputedStyle(layoutEl).columnGap) || 0);
			return grid.size(Math.min(470, room * share), Math.min(480, room * (share + 0.04)));
		};
		fit();
		reserve();
		grid.recolor();

		// Painting waits for the end of the current task, so a burst of renders (the
		// player measuring every step) paints once, with the last one's state.
		let paintT = 0;
		let paintLost: Uint8Array | null = runs.lost;
		let queued = false;
		const paint = () => {
			queued = false;
			grid.paint(runs, paintT, paintLost);
		};
		const schedule = () => {
			if (queued) return;
			queued = true;
			queueMicrotask(paint);
		};

		// Created before the player's own observer, so the canvas has its new size when the player measures.
		new ResizeObserver(() => {
			reserve();
			if (fit()) schedule();
		}).observe(root);
		onRatioChange(() => {
			fit();
			schedule();
		});
		const recolor = () => {
			grid.recolor();
			schedule();
		};
		new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor);

		const shown = new WeakMap<HTMLElement, number>();
		const setCount = (target: HTMLElement, value: number, format: (v: number) => string = (v) => NUMBER.format(v)) => {
			if (shown.get(target) === value) return;
			shown.set(target, value);
			text(target, format(value));
		};
		const note = (target: HTMLElement, p: number) => {
			const k = ease.out(clamp(p));
			show(target, k, k < 1 ? `translateY(${n((1 - k) * 3, 2)}px)` : "");
		};

		return {
			layout() {
				fit();
				reserve();
			},

			render(t, modeId) {
				const mode = (modeId === "new" ? "new" : "old") satisfies ModeId;
				const old = mode === "old";
				paintT = t;
				paintLost = old ? runs.lost : null;
				schedule();

				renderEnter(chart, t, 0, "fade");
				renderEnter(counters, t, 0.1);
				renderEnter(why, t, 0.22);

				// The counters read the same finished runs the grid draws.
				const done = finishedAt(runs.finishTimes, t);
				const lost = old ? runs.lostBy[done]! : 0;
				setCount(count.runs, done);
				setCount(count.lost, lost);
				setCount(count.share, done ? lost / done : 0, (v) => `${(v * 100).toFixed(1)}%`);
				setCount(count.chars, old ? runs.charsBy[done]! : 0);
				setCount(count.atoms, old ? runs.atomsBy[done]! : 0);
				attr(lostCounter, "data-hot", lost > 0);

				// Why: two concurrent edits, the merge, and what each schema makes of it.
				const edit = ease.out(prog(t, T.edits, T.edits + 0.45));
				const merge = ease.inOut(prog(t, T.merge, T.merge + 0.45));
				renderCollapse(rows.list, edit);
				renderCollapse(rows.para, 1 - merge);
				const touched = t < T.edits ? 0 : 1;
				css(boxes.para, "--hl", touched);
				css(boxes.list, "--hl", touched * (1 - ease.inOut(prog(t, T.merge + 0.2, T.merge + 0.9))));
				attr(boxes.para, "data-gone", t >= T.edits + 0.2);
				note(notes.removed, prog(t, T.edits + 0.15, T.edits + 0.5));
				note(notes.nested, prog(t, T.edits + 0.15, T.edits + 0.5));
				note(notes.merged, prog(t, T.merge + 0.3, T.merge + 0.65));
				css(rule, "--fire", ease.out(prog(t, T.verdict - 0.1, T.verdict + 0.3)));

				// The verdict takes the paragraph's row once it has gone, so the section is
				// never taller than at a settled step, which is what the player locks to.
				css(verdict, "display", t >= T.merge + 0.45 ? null : "none");

				// The old schema deletes the item, and everything in it with it.
				const red = old ? prog(t, T.verdict, T.verdict + 0.35) : 0;
				for (const b of [boxes.root, boxes.list, boxes.item]) css(b, "--lost", red);
				renderPill(deleted, old ? prog(t, T.verdict + 0.15, T.verdict + 0.5) : 0);
				renderPill(kept, old ? 0 : prog(t, T.verdict, T.verdict + 0.35));
			},
		};
	},
};
