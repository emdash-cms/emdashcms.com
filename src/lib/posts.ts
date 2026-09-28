import { extractPlainText, type ContentBylineCredit, type PortableTextBlock } from "emdash";

/** Average adult silent-reading speed for technical prose. */
const WORDS_PER_MINUTE = 230;

export interface PostDate {
	datetime: string;
	label: string;
}

export function formatPostDate(date: Date | null | undefined, month: "short" | "long" = "short"): PostDate | null {
	if (!date) return null;
	return {
		datetime: date.toISOString(),
		label: date.toLocaleDateString("en-US", { year: "numeric", month, day: "numeric" }),
	};
}

/**
 * Whole minutes to read a Portable Text body, counting prose blocks only (not
 * code or embeds). Returns null for an empty or unreadable body so templates
 * can omit the label.
 */
export function readingMinutes(content: PortableTextBlock[] | undefined): number | null {
	if (!Array.isArray(content)) return null;
	try {
		const prose = content.filter((block) => block?._type === "block");
		const words = extractPlainText(prose).split(/\s+/).filter(Boolean).length;
		if (words === 0) return null;
		return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
	} catch {
		return null;
	}
}

export interface PostAuthor {
	name: string;
	initials: string;
	/**
	 * Decorative: shown next to the names, so it has no alt text.
	 * `color` is the photo's dominant colour, painted while it loads.
	 */
	avatar: { src: string; color: string | null } | null;
}

const HEX_COLOR = /^#[\da-f]{3,8}$/i;

function initialsOf(name: string) {
	return name
		.split(/\s+/)
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/** Credited bylines in display order, with avatar URLs resolved from media storage. */
export function postAuthors(bylines: ContentBylineCredit[] | undefined): PostAuthor[] {
	if (!bylines?.length) return [];
	return bylines
		.toSorted((a, b) => a.sortOrder - b.sortOrder)
		.map(({ byline }) => ({
			name: byline.displayName,
			initials: initialsOf(byline.displayName),
			avatar: byline.avatarStorageKey
				? {
						src: `/_emdash/api/media/file/${byline.avatarStorageKey}`,
						color: byline.avatarDominantColor && HEX_COLOR.test(byline.avatarDominantColor) ? byline.avatarDominantColor : null,
					}
				: null,
		}));
}

/** The joiner before the author at `index`: "A and B", "A, B, and C". */
export function authorSeparator(index: number, count: number) {
	if (index === 0) return "";
	if (count === 2) return " and ";
	return index === count - 1 ? ", and " : ", ";
}
