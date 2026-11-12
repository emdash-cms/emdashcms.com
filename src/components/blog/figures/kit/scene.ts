/**
 * The contract between a figure and the kit. A figure is a scene: a fixed
 * duration, the steps a reader can jump to, optionally two modes to compare,
 * and a render function that sets the stage for any time t. The kit owns
 * playback, controls, reduced motion and layout locking.
 */

/** Text that is the same in every mode, or differs per mode: { [modeId]: text }. */
export type PerMode = string | Readonly<Record<string, string>>;

export interface Step {
	/** When the step begins, in seconds. */
	at: number;
	/** Shown in the control bar while the step plays; also the dot's accessible name. */
	label: PerMode;
}

export interface Mode {
	id: string;
	/** The segmented switch's button text. */
	label: string;
}

/** What the server needs to draw the control bar. */
export interface SceneInfo {
	duration: number;
	/**
	 * Seconds at the start in which the figure's parts enter. Replay plays
	 * them again; switching modes starts after them, since the stage is
	 * already built.
	 */
	intro?: number;
	steps: readonly Step[];
	modes?: readonly [Mode, Mode];
	/** Names the mode switch for assistive tech, e.g. "Who saves". */
	modesLabel?: string;
}

export interface SceneView {
	/** Measure geometry (wire routes and the like). Runs on mount, on resize, and after fonts load. */
	layout?(): void;
	/** Set every element on the stage for time t. Must depend only on t, mode and the last layout. */
	render(t: number, mode: string): void;
}

export interface Scene extends SceneInfo {
	/** Query the stage's elements once and return the view that draws them. */
	setup(stage: HTMLElement): SceneView;
}

/** The public handle on each figure root, for screenshots and tests. */
export interface FigureHandle {
	seek(t: number): void;
	play(): void;
	pause(): void;
	setMode(mode: string): void;
	readonly duration: number;
	readonly t: number;
	readonly mode: string;
}

/** The text for a mode, or the first mode's when it has none of its own. */
export function textFor(value: PerMode, mode: string | undefined) {
	if (typeof value === "string") return value;
	return (mode !== undefined ? value[mode] : undefined) ?? Object.values(value)[0] ?? "";
}

/** The moment a step has fully played out: just before the next one starts, or the end. */
export function settledAt(info: SceneInfo, index: number) {
	const next = info.steps[index + 1];
	return next ? Math.max(info.steps[index]!.at, next.at - 0.02) : info.duration;
}

/** Which step is playing at t. */
export function stepAt(info: SceneInfo, t: number) {
	let i = 0;
	while (i + 1 < info.steps.length && info.steps[i + 1]!.at <= t) i++;
	return i;
}

/**
 * Where t sits on the step track, 0 to 1. Dots are spaced evenly, so each step
 * gets the same length of track whatever its duration.
 */
export function trackAt(info: SceneInfo, t: number) {
	const count = info.steps.length;
	const i = stepAt(info, t);
	const start = info.steps[i]!.at;
	const end = info.steps[i + 1]?.at ?? info.duration;
	const within = end > start ? Math.min(1, Math.max(0, (t - start) / (end - start))) : 1;
	return (i + within) / count;
}
