import type { APIRoute } from "astro";
import { getEmDashCollection, getEmDashEntry, getSeoMeta } from "emdash";
import { renderSitemap } from "../lib/sitemap.mjs";

export const prerender = false;

const staticPaths = ["/blog", "/astro-cms", "/media-library", "/for-agents"];

function matchesCanonical(canonical: string | null | undefined, location: string, siteUrl: URL) {
	if (!canonical) return true;
	try {
		return new URL(canonical, siteUrl).href === location;
	} catch {
		return false;
	}
}

function seoImageUrl(image: string | null | undefined, siteUrl: URL) {
	if (!image) return null;
	return getSeoMeta({
		data: { seo: { title: null, description: null, image, canonical: null, noIndex: false } },
	}, { siteUrl: siteUrl.origin }).ogImage;
}

export const GET: APIRoute = async ({ site, cache, locals }) => {
	const db = locals.emdash?.db;
	if (!db) return new Response("Sitemap unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
	const siteUrl = site ?? new URL("https://emdashcms.com/");
	const entries: Array<{ location: string; lastmod?: string; image?: string | null }> = staticPaths.map((path) => ({ location: new URL(path, siteUrl).href }));
	const cacheTags = new Set<string>();
	let lastModified: Date | undefined;
	const addCacheHint = (hint: { tags?: string[]; lastModified?: Date }) => {
		for (const tag of hint.tags ?? []) cacheTags.add(tag);
		if (hint.lastModified && (!lastModified || hint.lastModified > lastModified)) lastModified = hint.lastModified;
	};
	let cursor: string | undefined;

	try {
		const homeResult = await getEmDashEntry("pages", "home");
		if (homeResult.error) throw homeResult.error;
		addCacheHint(homeResult.cacheHint);
		if (homeResult.entry?.data.status === "published") {
			const home = homeResult.entry;
			const seo = await db.selectFrom("_emdash_seo")
				.select(["seo_no_index", "seo_canonical", "seo_image"])
				.where("collection", "=", "pages")
				.where("content_id", "=", home.data.id)
				.executeTakeFirst();
			const location = new URL("/", siteUrl).href;
			if (seo?.seo_no_index !== 1 && matchesCanonical(seo?.seo_canonical, location, siteUrl)) {
				entries.unshift({ location, lastmod: home.data.updatedAt.toISOString(), image: seoImageUrl(seo?.seo_image, siteUrl) });
			}
		}

		do {
			const result = await getEmDashCollection("posts", {
				status: "published",
				limit: 100,
				cursor,
				orderBy: { published_at: "desc" },
			});
			if (result.error) throw result.error;
			addCacheHint(result.cacheHint);
			const ids = result.entries.map((post) => post.data.id);
			const seoRows = ids.length > 0
				? await db.selectFrom("_emdash_seo")
						.select(["content_id", "seo_no_index", "seo_canonical", "seo_image"])
						.where("collection", "=", "posts")
						.where("content_id", "in", ids)
						.execute()
				: [];
			const seoById = new Map(seoRows.map((row) => [row.content_id, row]));
			for (const post of result.entries) {
				const seo = seoById.get(post.data.id);
				if (seo?.seo_no_index === 1) continue;
				const location = new URL(`/blog/${encodeURIComponent(post.id)}`, siteUrl).href;
				if (!matchesCanonical(seo?.seo_canonical, location, siteUrl)) continue;
				entries.push({ location, lastmod: post.data.updatedAt.toISOString(), image: seoImageUrl(seo?.seo_image, siteUrl) });
			}
			if (result.nextCursor && result.nextCursor === cursor) throw new Error("Sitemap pagination did not advance");
			cursor = result.nextCursor;
		} while (cursor);
	} catch (error) {
		console.error("Unable to generate sitemap:", error);
		return new Response("Sitemap unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
	}

	if (cache?.enabled) cache.set({ tags: [...cacheTags], lastModified });
	return new Response(renderSitemap(entries), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
};
