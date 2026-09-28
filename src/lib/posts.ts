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
	/** Decorative: shown next to the names, so it has no alt text. */
	avatar: { src: string } | null;
}

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
			avatar: byline.avatarStorageKey ? { src: `/_emdash/api/media/file/${byline.avatarStorageKey}` } : null,
		}));
}

export function formatAuthorNames(authors: PostAuthor[]) {
	const names = authors.map((author) => author.name);
	if (names.length <= 2) return names.join(" and ");
	return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}
