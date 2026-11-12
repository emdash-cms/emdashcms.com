/**
 * Markup for what connects the scene: links (dotted paths on the floor that
 * updates travel along), stems (hairlines from a floating card down to its
 * object), labels, and the layer packets fly in. The client half is live.ts.
 */
import type { PersonKey } from "../cast";
import { icon, type IconName } from "../icons";
import { avatarG, f, type Iso, type Pt, type V3 } from "./iso";

export interface LinkOpts {
	/** Names the link for the scene: `data-link="<id>"`. */
	id: string;
	/** World points, start to end. Packets travel start → end unless reversed. */
	path: readonly V3[];
	/** An icon shown in the gap when the link breaks, e.g. cloudSlash. */
	badge?: IconName;
}

const pts = (iso: Iso, path: readonly V3[]) => path.map(([x, y, z]) => iso.P(x, y, z ?? 0));
const d = (points: readonly Pt[]) => `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}`;

/**
 * A link: a resting dotted path, a lit copy for the moment it carries
 * something, and an optional badge for when it breaks. live.ts's IsoLink
 * reads the screen points from data-pts.
 */
export function link(iso: Iso, { id, path, badge }: LinkOpts) {
	const screen = pts(iso, path);
	const data = screen.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
	const path_ = d(screen);
	const mid = midpoint(screen);
	const badgeSvg = badge
		? `<g class="il-badge" data-badge transform="translate(${f(mid[0])} ${f(mid[1])})" style="opacity:0;visibility:hidden"><circle r="11"/><g transform="translate(-7 -7)">${icon(badge, 14)}</g></g>`
		: "";
	return `<g class="il" data-link="${id}" data-pts="${data}"><path class="il-rest" d="${path_}"/><path class="il-lit" d="${path_}" style="opacity:0"/>${badgeSvg}</g>`;
}

function midpoint(points: readonly Pt[]): Pt {
	const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
	let left = lengths.reduce((a, b) => a + b, 0) / 2;
	for (let i = 0; i < lengths.length; i++) {
		if (left <= lengths[i]!) {
			const a = points[i]!;
			const b = points[i + 1]!;
			const k = left / (lengths[i]! || 1);
			return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
		}
		left -= lengths[i]!;
	}
	return points[points.length - 1]!;
}

/** A hairline from a floating card's edge (x, from) down or up to its object (x, to), ending in a dot. Colour it with --stem. */
export function stem(x: number, from: number, to: number, part: string, color?: string) {
	return `<g class="i-stem" data-part="${part}"${color ? ` style="--stem:${color}"` : ""}><path d="M${f(x)} ${f(from)} V${f(to)}"/><circle cx="${f(x)}" cy="${f(to)}" r="2.5"/></g>`;
}

export function label(x: number, y: number, text: string, { anchor = "middle" as "start" | "middle" | "end", part = "", strong = false } = {}) {
	return `<text class="${strong ? "i-name" : "i-label"}"${part ? ` data-part="${part}"` : ""} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" dominant-baseline="central">${text}</text>`;
}

/**
 * Markup that belongs to one mode, shown by live.ts's renderModeOnly(). Pass
 * `shown` for the first mode, so the stage reads right before script runs.
 */
export const modeOnly = (mode: string, html: string, shown = false) => `<g data-mode-only="${mode}"${shown ? "" : ` style="display:none"`}>${html}</g>`;

/** The layer IsoPackets draws into. Put it above the floor and objects, below the cards. */
export const packetLayer = (id = "packets") => `<g class="i-packets" data-packets="${id}"></g>`;

/** A person's avatar, defined once per composition, for a packet to wear (live.ts IsoPacket `mark`). Returns its href. */
export function markDef(iso: Iso, who: PersonKey, size = 11) {
	const id = iso.uid(`mark-${who}`);
	iso.add(`<defs><g id="${id}">${avatarG(iso, who, 0, 0, size)}</g></defs>`);
	return `#${id}`;
}
