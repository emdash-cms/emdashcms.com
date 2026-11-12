/**
 * Plays a scene inside the frame FigureFrame.astro draws: autoplay once when
 * half in view, pause off-screen and in hidden tabs, hold the last frame, and
 * drive the control bar. Under prefers-reduced-motion nothing tweens: the
 * figure shows its outcome and each control jumps to a settled step.
 */

import { all, attr, css, one, text } from "./dom";
import { clamp } from "./motion";
import { type FigureHandle, type Scene, type SceneView, settledAt, stepAt, textFor, trackAt } from "./scene";

type Status = "idle" | "playing" | "paused" | "ended";

const LABELS = {
	play: "Play animation",
	pause: "Pause animation",
	replay: "Replay animation",
	next: "Next step",
	restart: "Back to the first step",
};

const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");

function mountFigure(root: HTMLElement, scene: Scene): FigureHandle {
	const stage = one(root, "[data-fig-stage]");
	const view: SceneView = scene.setup(stage);
	const modeButtons = all<HTMLButtonElement>(root, "[data-fig-mode]");
	const dots = all<HTMLButtonElement>(root, "[data-fig-step]");
	const fill = root.querySelector<HTMLElement>("[data-fig-fill]");
	const stepLabel = root.querySelector<HTMLElement>("[data-fig-step-label]");
	const button = one<HTMLButtonElement>(root, "[data-fig-play]");
	const locks = all(stage, "[data-fig-lock]");
	const perMode = all(root, "[data-when-mode]");

	const modes = scene.modes?.map((m) => m.id) ?? [""];
	let mode = modes[0]!;
	let t = 0;
	let status: Status = "idle";
	let started = false;
	let visible = false;
	let frame = 0;
	let last = 0;
	let reduced = motionQuery().matches;

	/** Mode-specific text (eyebrow, subtitle, labels on the stage) and the root's data-mode. */
	function showMode(m: string) {
		attr(root, "data-mode", m || null);
		for (const el of perMode) el.hidden = el.dataset.whenMode !== m;
	}

	function draw() {
		showMode(mode);
		view.render(t, mode);
		const step = stepAt(scene, t);
		css(fill, "--fill", trackAt(scene, t));
		text(stepLabel, textFor(scene.steps[step]!.label, mode));
		dots.forEach((dot, i) => {
			attr(dot, "aria-label", `Step ${i + 1} of ${dots.length}: ${textFor(scene.steps[i]!.label, mode)}`);
			attr(dot, "data-state", i < step ? "done" : i === step ? "current" : "todo");
			attr(dot, "aria-current", i === step ? "step" : null);
			attr(dot, "tabindex", i === step ? 0 : -1);
		});
		modeButtons.forEach((b) => attr(b, "aria-pressed", b.dataset.figMode === mode ? "true" : "false"));
		const icon = reduced ? (step === scene.steps.length - 1 ? "restart" : "next") : status === "playing" ? "pause" : status === "ended" ? "replay" : "play";
		attr(button, "data-icon", icon);
		attr(button, "aria-label", LABELS[icon]);
	}

	function tick(now: number) {
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		t = Math.min(scene.duration, t + dt);
		if (t >= scene.duration) {
			status = "ended";
			frame = 0;
		} else {
			frame = requestAnimationFrame(tick);
		}
		draw();
	}

	function run() {
		if (frame || reduced) return;
		last = performance.now();
		frame = requestAnimationFrame(tick);
	}

	function halt() {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
	}

	/** Runs frames only while playing, on screen and in a visible tab. */
	function sync() {
		if (status === "playing" && visible && !document.hidden) run();
		else halt();
	}

	function play() {
		started = true;
		if (reduced) return;
		if (t >= scene.duration) t = 0;
		status = "playing";
		sync();
		draw();
	}

	function pause() {
		started = true;
		if (status === "playing") status = "paused";
		halt();
		draw();
	}

	function seek(to: number) {
		started = true;
		t = clamp(to, 0, scene.duration);
		if (t >= scene.duration) {
			status = "ended";
			halt();
		} else if (status === "ended") status = "paused";
		draw();
	}

	/** A snapshot of the stage fades out over the new mode's first frame. Canvases clone blank, so their pixels are copied. */
	function crossfade() {
		if (reduced || typeof stage.animate !== "function") return;
		const ghost = stage.cloneNode(true) as HTMLElement;
		const copies = all<HTMLCanvasElement>(ghost, "canvas");
		all<HTMLCanvasElement>(stage, "canvas").forEach((canvas, i) => {
			if (canvas.width && canvas.height) copies[i]?.getContext("2d")?.drawImage(canvas, 0, 0);
		});
		ghost.removeAttribute("data-fig-stage");
		ghost.classList.add("fig-ghost");
		Object.assign(ghost.style, {
			left: `${stage.offsetLeft}px`,
			top: `${stage.offsetTop}px`,
			width: `${stage.offsetWidth}px`,
			height: `${stage.offsetHeight}px`,
		});
		stage.parentNode?.insertBefore(ghost, stage.nextSibling);
		ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }).finished.finally(() => ghost.remove());
	}

	function setMode(next: string) {
		if (!modes.includes(next) || next === mode) return;
		started = true;
		if (reduced) {
			const step = stepAt(scene, t);
			mode = next;
			t = settledAt(scene, step);
			draw();
			return;
		}
		crossfade();
		mode = next;
		t = scene.intro ?? 0;
		status = "playing";
		draw();
		sync();
	}

	/**
	 * Each lock gets the tallest height it reaches in any step of any mode, so
	 * the stage never changes size. A second pass measures again with the
	 * first pass applied, for locks nested in other locks.
	 */
	function lockHeights() {
		if (!locks.length) return;
		for (const el of locks) css(el, "min-height", null);
		const times = [0, ...scene.steps.map((_, i) => settledAt(scene, i))];
		for (let pass = 0; pass < 2; pass++) {
			const tallest = new Map<HTMLElement, number>();
			for (const m of modes) {
				showMode(m);
				for (const time of times) {
					view.render(time, m);
					for (const el of locks) tallest.set(el, Math.max(tallest.get(el) ?? 0, el.offsetHeight));
				}
			}
			for (const el of locks) css(el, "min-height", `${tallest.get(el)}px`);
		}
	}

	let width = -1;
	function relayout(force = false) {
		const w = root.offsetWidth;
		if (!force && w === width) return;
		width = w;
		lockHeights();
		// Measuring left the stage on another mode's last frame; layout measures this one.
		showMode(mode);
		view.render(t, mode);
		view.layout?.();
		draw();
	}

	// ---- Controls

	modeButtons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.figMode ?? "")));

	dots.forEach((dot, i) => {
		dot.addEventListener("click", () => {
			if (reduced) seek(settledAt(scene, i));
			else {
				seek(scene.steps[i]!.at);
				play();
			}
		});
		dot.addEventListener("keydown", (event) => {
			const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
			const target = event.key === "Home" ? 0 : event.key === "End" ? dots.length - 1 : i + delta;
			if ((!delta && event.key !== "Home" && event.key !== "End") || target < 0 || target >= dots.length) return;
			event.preventDefault();
			dots[target]!.click();
			dots[target]!.focus();
		});
	});

	button.addEventListener("click", () => {
		if (reduced) {
			const step = stepAt(scene, t);
			seek(settledAt(scene, step === scene.steps.length - 1 ? 0 : step + 1));
		} else if (status === "playing") pause();
		else play();
	});

	// ---- When to run

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry) return;
			visible = entry.isIntersecting;
			const needed = Math.min(entry.boundingClientRect.height, window.innerHeight) * 0.5;
			if (visible && !started && !reduced && entry.intersectionRect.height >= needed - 1) play();
			sync();
		},
		{ threshold: [0, 0.25, 0.5, 0.75, 1] },
	);
	observer.observe(root);

	document.addEventListener("visibilitychange", sync);

	motionQuery().addEventListener("change", (event) => {
		reduced = event.matches;
		if (reduced) {
			halt();
			status = "paused";
			t = settledAt(scene, stepAt(scene, t));
		}
		draw();
	});

	new ResizeObserver(() => relayout()).observe(root);
	// Web fonts change text metrics; measure again whenever one finishes loading.
	document.fonts?.ready.then(() => relayout(true));
	document.fonts?.addEventListener("loadingdone", () => relayout(true));

	if (reduced) {
		t = scene.duration;
		status = "ended";
	}
	relayout(true);
	attr(root, "data-ready", true);

	const handle: FigureHandle = {
		seek,
		play,
		pause,
		setMode,
		duration: scene.duration,
		get t() {
			return t;
		},
		get mode() {
			return mode;
		},
	};
	return handle;
}

declare global {
	interface HTMLElement {
		__figure?: FigureHandle;
	}
}

/** Mounts every not-yet-mounted figure root named `name` on the page. */
export function mountFigures(name: string, scene: Scene) {
	for (const root of document.querySelectorAll<HTMLElement>(`[data-figure="${name}"]`)) {
		if (root.__figure) continue;
		root.__figure = mountFigure(root, scene);
	}
}
