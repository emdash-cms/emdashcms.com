import type { ContentEntry, ImageValue, InferCollectionData } from "emdash";

export const SHOWCASE_SUBMIT_URL = "/showcase/submit";

type ShowcaseEntry = ContentEntry<InferCollectionData<"showcase">>;

export type ShowcaseCategory = NonNullable<InferCollectionData<"showcase">["category"]>;

/** `href` is always an absolute http(s) URL and `host` is derived from it. */
export interface ShowcaseSite {
	/** Database ULID: stable across slug edits, so it seeds the fallback art. */
	id: string;
	title: string;
	href: string;
	/** "example.com" or "example.com/blog": the hostname without "www.", plus any path. */
	host: string;
	screenshot: ImageValue | null;
	description: string | null;
	category: ShowcaseCategory | null;
	featured: boolean;
	quote: string | null;
	quoteAuthor: string | null;
	quoteRole: string | null;
	/** An absolute http(s) URL to a case study about the site. */
	storyUrl: string | null;
}

function parseHttpUrl(value: unknown): URL | null {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value.trim());
		return url.protocol === "http:" || url.protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

function text(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed || null;
}

export function displayHost(href: string): string {
	const url = parseHttpUrl(href);
	if (!url) return href;
	const hostname = url.hostname.replace(/^www\./, "");
	const path = url.pathname.replace(/\/+$/, "");
	return `${hostname}${path}`;
}

/** Null when the entry has no usable title or its URL is not an absolute http(s) URL. */
export function toShowcaseSite(entry: ShowcaseEntry): ShowcaseSite | null {
	const { data } = entry;
	const url = parseHttpUrl(data.url);
	const title = text(data.title);
	if (!url || !title) return null;
	const quote = text(data.quote);
	return {
		id: data.id,
		title,
		href: url.href,
		host: displayHost(url.href),
		screenshot: data.screenshot ?? null,
		description: text(data.description),
		category: data.category ?? null,
		featured: data.featured === true,
		quote,
		quoteAuthor: quote ? text(data.quote_author) : null,
		quoteRole: quote ? text(data.quote_role) : null,
		storyUrl: parseHttpUrl(data.story_url)?.href ?? null,
	};
}

/** Each group keeps the incoming order. */
export function splitFeatured(sites: ShowcaseSite[]): { featured: ShowcaseSite[]; rest: ShowcaseSite[] } {
	const featured: ShowcaseSite[] = [];
	const rest: ShowcaseSite[] = [];
	for (const site of sites) (site.featured ? featured : rest).push(site);
	return { featured, rest };
}
