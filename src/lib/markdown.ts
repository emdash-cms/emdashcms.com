/**
 * Markdown versions of the site's pages, for AI agents and answer engines.
 *
 * Each page's `.md` twin is rendered from the same CMS content as its HTML, so
 * agents get the words without the interactive figures, faux product UI, and
 * navigation that an HTML-to-Markdown converter would drag along. The twins
 * live at their own URLs (`/index.md`, `/blog.md`, `/blog/<slug>.md`,
 * `/showcase.md`), and each page also serves its twin to requests that prefer
 * `text/markdown`, answering both with `Vary: Accept` so Workers Cache keeps
 * the two apart. Origin Markdown passes through Cloudflare's own Markdown for
 * Agents conversion untouched.
 */
import { getSiteSettings, type ContentEntry, type InferCollectionData, type PortableTextBlock } from "emdash";
import { portableTextToMarkdown } from "emdash/client";
import { capabilityCards } from "../components/blocks/capabilities-copy";
import { capabilitiesDefaults } from "../plugins/marketing-blocks/index";
import { formatPostDate, postAuthors, readingMinutes } from "./posts";
import type { ShowcaseSite } from "./showcase";

export type PostEntry = ContentEntry<InferCollectionData<"posts">>;

/** Plain text from an unknown CMS value, or "" when it has none. */
function text(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

/** One line of text, for headings and list items. */
function line(value: unknown): string {
	return text(value).replace(/\s+/g, " ");
}

/** Text safe inside `[link text]` or `![alt text]`. */
function linkText(value: string): string {
	return value.replace(/[[\]\\]/g, "\\$&");
}

/** YAML frontmatter. JSON strings are valid YAML scalars, so values are JSON-encoded. */
function frontmatter(fields: Record<string, string | string[] | number | null | undefined>): string {
	const lines = Object.entries(fields).flatMap(([key, value]) => {
		if (value === null || value === undefined || value === "") return [];
		if (Array.isArray(value)) return value.length ? [`${key}: ${JSON.stringify(value)}`] : [];
		return [`${key}: ${JSON.stringify(value)}`];
	});
	return ["---", ...lines, "---"].join("\n");
}

/** Joins sections with one blank line, dropping empty ones. */
function sections(...parts: (string | false | null | undefined)[]): string {
	const kept = parts.flatMap((part) => (typeof part === "string" && part.trim() ? [part.trim()] : []));
	return `${kept.join("\n\n")}\n`;
}

interface MarkdownResponseOptions {
	/** The HTML page search engines should credit, honouring the SEO panel's canonical. */
	canonical: string;
	/** Keep the twin out of search results, as its page is (staging, or the SEO panel's noindex). */
	noindex?: boolean;
}

export function markdownResponse(body: string, { canonical, noindex = false }: MarkdownResponseOptions): Response {
	const headers = new Headers({
		"Content-Type": "text/markdown; charset=utf-8",
		Link: `<${canonical}>; rel="canonical"`,
	});
	if (noindex) headers.set("X-Robots-Tag", "noindex, nofollow");
	return new Response(body, { headers });
}

/**
 * A 503 for when the database fails, so neither a crawler nor the route cache
 * keeps an empty list as the page's content.
 */
export function unavailableResponse(): Response {
	return new Response("Temporarily unavailable\n", {
		status: 503,
		headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "30" },
	});
}

/** Whether the site is in staging, where every page asks not to be indexed. */
export async function isStaging(): Promise<boolean> {
	return (await getSiteSettings())?.staging === true;
}

/** The quality a request's Accept header gives a media type, or 0 when it isn't listed. */
function acceptQuality(accept: string, type: string): number {
	for (const part of accept.split(",")) {
		const [name, ...params] = part.split(";").map((piece) => piece.trim().toLowerCase());
		if (name !== type) continue;
		const q = params.find((param) => param.startsWith("q="));
		const value = q ? Number.parseFloat(q.slice(2)) : 1;
		return Number.isFinite(value) ? value : 0;
	}
	return 0;
}

/**
 * Whether a request asks for Markdown over HTML. Browsers never list
 * `text/markdown`; agents that list it at least as high as `text/html` get it.
 */
export function prefersMarkdown(request: Request): boolean {
	const accept = request.headers.get("Accept");
	if (!accept) return false;
	const markdown = acceptQuality(accept, "text/markdown");
	return markdown > 0 && markdown >= acceptQuality(accept, "text/html");
}

/** Adds `Vary: Accept` to a page that answers HTML or Markdown at the same URL. */
export function varyOnAccept(headers: Headers): void {
	const vary = headers.get("Vary") ?? "";
	if (!vary.split(",").some((value) => value.trim().toLowerCase() === "accept")) headers.append("Vary", "Accept");
}

/**
 * The page's Markdown twin, for a page whose request prefers Markdown. Each
 * page calls this first, before loading anything for its HTML.
 */
export async function negotiatedMarkdown(
	request: Request,
	pathname: string,
	rewrite: (path: string) => Promise<Response>,
): Promise<Response | null> {
	if (!prefersMarkdown(request)) return null;
	const twin = await rewrite(markdownPath(pathname));
	const response = new Response(twin.body, twin);
	varyOnAccept(response.headers);
	return response;
}

/** The Markdown twin's URL for a page path: `/` → `/index.md`, `/blog` → `/blog.md`. */
export function markdownPath(pathname: string): string {
	const path = pathname.replace(/\/+$/, "");
	return `${path || "/index"}.md`;
}

// ---------------------------------------------------------------------------
// Portable Text
// ---------------------------------------------------------------------------

/** The opaque fence `portableTextToMarkdown` writes for blocks Markdown can't round-trip. */
const OPAQUE_FENCE_LINE = /^<!--ec:block .* -->$/gm;

type LooseBlock = PortableTextBlock & Record<string, unknown>;

function imageMarkdown(block: LooseBlock, origin: URL): string {
	const asset = (block.asset ?? {}) as { url?: unknown };
	const alt = line(block.alt);
	const caption = line(block.caption);
	const src = typeof asset.url === "string" && asset.url ? new URL(asset.url, origin).href : "";
	const image = src ? `![${linkText(alt)}](${src})` : alt ? `Image: ${alt}` : "";
	return sections(image, caption && `*${caption}*`).trim();
}

/** A `blog.figure` is interactive on the page; its caption and text alternative carry it here. */
function figureMarkdown(block: LooseBlock): string {
	const caption = line(block.caption);
	const description = text(block.description);
	return sections(caption && `**Figure: ${caption}**`, description).trim();
}

/** Plain cell text, for tables `portableTextToMarkdown` can't write as GFM. */
function tableFallback(block: LooseBlock): string {
	const rows = Array.isArray(block.rows) ? (block.rows as { cells?: { content?: { text?: string }[] }[] }[]) : [];
	const cells = rows.map((row) =>
		(row.cells ?? []).map((cell) =>
			line((cell.content ?? []).map((span) => span.text ?? "").join("")).replaceAll("|", "\\|"),
		),
	);
	const width = Math.max(0, ...cells.map((row) => row.length));
	if (!width) return "";
	const pad = (row: string[]) => `| ${Array.from({ length: width }, (_, index) => row[index] ?? "").join(" | ")} |`;
	const [head = [], ...body] = cells;
	return [pad(head), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...body.map(pad)].join("\n");
}

/** A heading with a line break can't be a Markdown heading, so fold the break into a space. */
function foldHeadingBreaks(block: LooseBlock): PortableTextBlock {
	if (block._type !== "block" || typeof block.style !== "string" || !block.style.startsWith("h")) return block;
	const children = Array.isArray(block.children) ? (block.children as Record<string, unknown>[]) : [];
	return {
		...block,
		children: children.map((child) =>
			typeof child.text === "string" ? { ...child, text: child.text.replace(/[\r\n]+/g, " ") } : child,
		),
	};
}

/**
 * Publishable Markdown for a Portable Text body. Standard blocks, code, and
 * tables go through EmDash's converter; images and figures get a text form;
 * other embeds have none, so they are left out rather than written as the
 * converter's opaque round-trip fences.
 */
export function portableTextBody(blocks: PortableTextBlock[] | undefined, origin: URL): string {
	if (!Array.isArray(blocks)) return "";
	const parts: string[] = [];
	let run: PortableTextBlock[] = [];
	const flush = () => {
		if (run.length) parts.push(portableTextToMarkdown(run).replace(OPAQUE_FENCE_LINE, "").trim());
		run = [];
	};
	for (const block of blocks as LooseBlock[]) {
		if (block._type === "block" || block._type === "code") {
			run.push(foldHeadingBreaks(block));
			continue;
		}
		flush();
		if (block._type === "table") {
			const table = portableTextToMarkdown([block]).trim();
			parts.push(table.startsWith("<!--ec:block") ? tableFallback(block) : table);
		} else if (block._type === "image") parts.push(imageMarkdown(block, origin));
		else if (block._type === "blog.figure") parts.push(figureMarkdown(block));
	}
	flush();
	return sections(...parts).replace(/\n{3,}/g, "\n\n");
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function postUrl(post: PostEntry, site: URL): string {
	return new URL(`/blog/${encodeURIComponent(post.id)}`, site).href;
}

function postSummaryLine(post: PostEntry, site: URL): string {
	const date = formatPostDate(post.data.publishedAt, "long");
	const excerpt = line(post.data.excerpt);
	const meta = [date?.label, excerpt].filter(Boolean).join(". ");
	return `- [${linkText(line(post.data.title))}](${postUrl(post, site)})${meta ? `: ${meta}` : ""}`;
}

/** `canonical` is the URL to credit, which the SEO panel can point elsewhere. */
export function postMarkdown(post: PostEntry, site: URL, canonical = postUrl(post, site)): string {
	const url = canonical;
	const authors = postAuthors(post.data.bylines).map((author) => author.name);
	const tags = (post.data.terms?.tag ?? []).map((tag) => tag.label);
	const published = formatPostDate(post.data.publishedAt, "long");
	const minutes = readingMinutes(post.data.content);
	const byline = [
		authors.length > 0 && `By ${new Intl.ListFormat("en", { type: "conjunction" }).format(authors)}`,
		published?.label,
		minutes && `${minutes} min read`,
	]
		.filter(Boolean)
		.join(" · ");

	return sections(
		frontmatter({
			title: line(post.data.title),
			description: line(post.data.excerpt),
			url,
			published: post.data.publishedAt?.toISOString(),
			updated: post.data.updatedAt.toISOString(),
			authors,
			tags,
		}),
		`# ${line(post.data.title)}`,
		byline,
		text(post.data.excerpt),
		portableTextBody(post.data.content, site),
		`---\n\nOriginally published at ${url}. More posts: ${new URL("/blog", site).href}`,
	);
}

export function blogMarkdown(posts: PostEntry[], site: URL): string {
	const url = new URL("/blog", site).href;
	return sections(
		frontmatter({ title: "Blog", description: "Release notes and product updates from EmDash.", url }),
		"# Release notes and product updates from EmDash",
		"This is where we announce new releases, notable improvements, and major changes to EmDash CMS.",
		posts.length > 0 ? posts.map((post) => postSummaryLine(post, site)).join("\n") : "No posts yet.",
		`RSS feed: ${new URL("/rss.xml", site).href}`,
	);
}

export function showcaseMarkdown(sites: ShowcaseSite[], site: URL): string {
	const url = new URL("/showcase", site).href;
	const entry = (item: ShowcaseSite) => {
		const summary = [item.category, line(item.description)].filter(Boolean).join(". ");
		const quote = item.quote
			? `\n  > ${line(item.quote)}${item.quoteAuthor ? ` (${[item.quoteAuthor, item.quoteRole].filter(Boolean).join(", ")})` : ""}`
			: "";
		const story = item.storyUrl ? `\n  Case study: ${item.storyUrl}` : "";
		return `- [${linkText(item.title)}](${item.href})${summary ? `: ${summary}` : ""}${quote}${story}`;
	};
	const featured = sites.filter((item) => item.featured);
	const rest = sites.filter((item) => !item.featured);
	return sections(
		frontmatter({ title: "Showcase", description: "Real sites in production, built with EmDash.", url }),
		"# Real sites, in production, built with EmDash",
		"Publications, studios, shops and docs that run on EmDash.",
		featured.length > 0 && `## Featured\n\n${featured.map(entry).join("\n")}`,
		rest.length > 0 && `## ${featured.length > 0 ? "More sites" : "Sites"}\n\n${rest.map(entry).join("\n")}`,
		sites.length === 0 && "Nothing is listed yet.",
		`Run a site on EmDash? Submit it at ${new URL("/showcase/submit", site).href}`,
	);
}

interface HomeOptions {
	title: string;
	description: string;
	site: URL;
	/** The URL to credit, which the SEO panel can point elsewhere. */
	canonical: string;
	/** The post the hero's announcement pill links to. */
	announcement?: { label: string; href: string };
}

/** Each marketing block, written as the Markdown a reader would want from it. */
function marketingBlockMarkdown(block: LooseBlock, site: URL): string {
	const link = (label: unknown, url: unknown) => {
		const target = text(url);
		return line(label) && target ? `[${linkText(line(label))}](${new URL(target, site).href})` : "";
	};
	const items = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);

	switch (block._type) {
		case "marketing.hero":
			return sections(
				line(block.headline) && `# ${line(block.headline)}`,
				text(block.subheadline),
				[
					"- Start a project: `npm create emdash@latest`",
					link(block.primaryCtaLabel, block.primaryCtaUrl) && `- ${link(block.primaryCtaLabel, block.primaryCtaUrl)}`,
					link(block.secondaryCtaLabel, block.secondaryCtaUrl) &&
						`- ${link(block.secondaryCtaLabel, block.secondaryCtaUrl)}`,
					`- Build with a coding agent: point it at ${new URL("/start.md", site).href}`,
				]
					.filter(Boolean)
					.join("\n"),
			);
		case "marketing.capabilities":
			return sections(
				`## ${line(block.headline) || capabilitiesDefaults.headline}`,
				typeof block.subheadline === "string" ? text(block.subheadline) : capabilitiesDefaults.subheadline,
				...Object.values(capabilityCards).map((card) => `### ${card.title}\n\n${card.text}`),
			);
		case "marketing.features":
			return sections(
				line(block.headline) && `## ${line(block.headline)}`,
				text(block.subheadline),
				...items(block.features).map((feature) =>
					sections(line(feature.title) && `### ${line(feature.title)}`, text(feature.description)).trim(),
				),
			);
		case "marketing.testimonials":
			return sections(
				line(block.headline) && `## ${line(block.headline)}`,
				...items(block.testimonials).map((item) => {
					const credit = [line(item.author), line(item.role), line(item.company)].filter(Boolean).join(", ");
					return text(item.quote)
						? `> ${text(item.quote).replace(/\n+/g, "\n> ")}${credit ? `\n>\n> — ${credit}` : ""}`
						: "";
				}),
			);
		case "marketing.pricing":
			return sections(
				line(block.headline) && `## ${line(block.headline)}`,
				...items(block.plans).map((plan) =>
					sections(
						line(plan.name) && `### ${[line(plan.name), [line(plan.price), line(plan.period)].join(" ").trim()].filter(Boolean).join(": ")}`,
						text(plan.description),
						text(plan.features)
							.split("\n")
							.map((feature) => feature.trim())
							.filter(Boolean)
							.map((feature) => `- ${feature}`)
							.join("\n"),
						link(plan.ctaLabel, plan.ctaUrl),
					).trim(),
				),
			);
		case "marketing.faq":
			return sections(
				`## ${line(block.headline) || "Frequently asked questions"}`,
				...items(block.items).map((item) =>
					line(item.question) && text(item.answer) ? `### ${line(item.question)}\n\n${text(item.answer)}` : "",
				),
			);
		default:
			return "";
	}
}

export function homeMarkdown(content: PortableTextBlock[] | undefined, options: HomeOptions): string {
	const { site, announcement } = options;
	const blocks = (content ?? []) as LooseBlock[];
	return sections(
		frontmatter({ title: options.title, description: options.description, url: options.canonical }),
		announcement && `Latest: [${linkText(announcement.label)}](${new URL(announcement.href, site).href})`,
		...blocks.map((block) =>
			block._type === "block" ? portableTextBody([block], site) : marketingBlockMarkdown(block, site),
		),
		[
			"## Links",
			"",
			"- Documentation: https://docs.emdashcms.com",
			"- Source code (MIT): https://github.com/emdash-cms/emdash",
			"- Playground: https://try.emdashcms.com",
			"- Plugin registry: https://plugins.emdashcms.com",
			`- Blog: ${new URL("/blog", site).href}`,
			`- Showcase: ${new URL("/showcase", site).href}`,
		].join("\n"),
	);
}
