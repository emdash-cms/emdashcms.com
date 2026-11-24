import type { APIRoute } from "astro";
import { getEmDashCollection, getEmDashEntry, getSiteSettings } from "emdash";
import { withCapabilities } from "../lib/home";
import { homeMarkdown, markdownResponse } from "../lib/markdown";

export const prerender = false;

/** The home page as Markdown, for agents. See src/lib/markdown.ts. */
export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const [{ entry: page, cacheHint }, featured, settings] = await Promise.all([
		getEmDashEntry("pages", "home"),
		getEmDashCollection("posts", {
			where: { featured_on_homepage: "1" },
			orderBy: { published_at: "desc" },
			limit: 1,
		}),
		getSiteSettings(),
	]);

	if (cache?.enabled) {
		cache.set(cacheHint);
		cache.set(featured.cacheHint);
	}

	const featuredPost = featured.entries[0];
	const body = homeMarkdown(withCapabilities(page?.data.content), {
		site: siteUrl,
		title: settings?.title || "EmDash CMS",
		description: settings?.tagline || "An open source Astro CMS built for humans and agents.",
		announcement: featuredPost && {
			label: featuredPost.data.featured_pill_text || featuredPost.data.title,
			href: `/blog/${encodeURIComponent(featuredPost.id)}`,
		},
	});

	return markdownResponse(body, new URL("/", siteUrl).href);
};
