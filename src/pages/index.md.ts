import type { APIRoute } from "astro";
import { getEmDashCollection, getEmDashEntry, getSeoMeta, getSiteSettings } from "emdash";
import { withCapabilities } from "../lib/home";
import { homeMarkdown, markdownResponse, unavailableResponse } from "../lib/markdown";

export const prerender = false;

/** The home page as Markdown, for agents. See src/lib/markdown.ts. */
export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const [home, featured, settings] = await Promise.all([
		getEmDashEntry("pages", "home"),
		getEmDashCollection("posts", {
			where: { featured_on_homepage: "1" },
			orderBy: { published_at: "desc" },
			limit: 1,
		}),
		getSiteSettings(),
	]);

	if (home.error) {
		console.error("Failed to load the home page:", home.error);
		return unavailableResponse();
	}
	// Like the hero, the page still renders without its announcement.
	if (featured.error) console.error("Failed to load the featured homepage post:", featured.error);

	if (cache?.enabled) {
		cache.set(home.cacheHint);
		cache.set(featured.cacheHint);
	}

	const page = home.entry;
	const seo = page ? getSeoMeta(page, { siteUrl: siteUrl.origin, path: "/" }) : null;
	const canonical = seo?.canonical ?? new URL("/", siteUrl).href;
	const featuredPost = featured.entries[0];
	const body = homeMarkdown(withCapabilities(page?.data.content), {
		site: siteUrl,
		canonical,
		title: settings?.title || "EmDash CMS",
		description: seo?.description || settings?.tagline || "An open source Astro CMS built for humans and agents.",
		announcement: featuredPost && {
			label: featuredPost.data.featured_pill_text || featuredPost.data.title,
			href: `/blog/${encodeURIComponent(featuredPost.id)}`,
		},
	});

	return markdownResponse(body, { canonical, noindex: Boolean(seo?.robots) || settings?.staging === true });
};
