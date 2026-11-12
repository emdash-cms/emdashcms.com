/**
 * DOM writes for render functions. A render runs every frame, so each helper
 * skips the write when the value hasn't changed.
 */

const written = new WeakMap<Element, Map<string, string>>();

function changed(el: Element, key: string, value: string) {
	let map = written.get(el);
	if (!map) written.set(el, (map = new Map()));
	if (map.get(key) === value) return false;
	map.set(key, value);
	return true;
}

/** Rounds so tiny float noise doesn't count as a change. */
export const n = (v: number, digits = 3) => {
	const r = Number(v.toFixed(digits));
	return Object.is(r, -0) ? "0" : String(r);
};

/** Sets a style property or custom property; null removes it. */
export function css(el: HTMLElement | SVGElement | null | undefined, prop: string, value: string | number | null) {
	if (!el) return;
	const v = value === null ? "" : typeof value === "number" ? n(value) : value;
	if (!changed(el, `css:${prop}`, v)) return;
	if (value === null) el.style.removeProperty(prop);
	else el.style.setProperty(prop, v);
}

/** Sets an attribute; null removes it. */
export function attr(el: Element | null | undefined, name: string, value: string | number | boolean | null) {
	if (!el) return;
	const v = value === null || value === false ? "\u0000" : value === true ? "" : typeof value === "number" ? n(value) : value;
	if (!changed(el, `attr:${name}`, v)) return;
	if (v === "\u0000") el.removeAttribute(name);
	else el.setAttribute(name, v);
}

export function text(el: Element | null | undefined, value: string) {
	if (!el || !changed(el, "text", value)) return;
	el.textContent = value;
}

/** Opacity plus a transform, the most common pair; hides the element from hit testing when invisible. */
export function show(el: HTMLElement | SVGElement | null | undefined, opacity: number, transform = "") {
	css(el, "opacity", opacity);
	css(el, "transform", transform || null);
	css(el, "visibility", opacity <= 0.001 ? "hidden" : null);
}

/** Anything that can be queried. (Not ParentNode: the Workers types redefine Element and break it.) */
type Root = Element | Document | DocumentFragment;

export function one<T extends Element = HTMLElement>(root: Root, selector: string): T {
	const el = root.querySelector<T>(selector);
	if (!el) throw new Error(`Figure markup is missing ${selector}`);
	return el;
}

export function all<T extends Element = HTMLElement>(root: Root, selector: string): T[] {
	return [...root.querySelectorAll<T>(selector)];
}
