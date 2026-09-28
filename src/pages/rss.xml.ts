import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

const FEED_PATH = "/rss.xml";
const BLOG_PATH = "/blog";
const SITE_TITLE = "EmDash CMS";
const FEED_DESCRIPTION = "Release announcements and product updates for EmDash CMS.";

export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const feedUrl = new URL(FEED_PATH, siteUrl);
	const blogUrl = new URL(BLOG_PATH, siteUrl);
	const { entries: posts, cacheHint } = await getEmDashCollection("posts", {
		status: "published",
		orderBy: { published_at: "desc" },
		limit: 50,
	});

	if (cache?.enabled) cache.set(cacheHint);

	const publishedPosts = posts
		.filter((post) => post.data.publishedAt)
		.toSorted(
			(a, b) =>
				(b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0),
		);
	const lastBuildDate = publishedPosts[0]?.data.publishedAt;
	const items = publishedPosts
		.map((post) => {
			const postUrl = new URL(`/blog/${encodeURIComponent(post.id)}`, siteUrl).href;

			return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${post.data.publishedAt!.toUTCString()}</pubDate>
      <description>${escapeXml(post.data.excerpt ?? "")}</description>
    </item>`;
		})
		.join("\n");

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(blogUrl.href)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <atom:link href="${escapeXml(feedUrl.href)}" rel="self" type="application/rss+xml" />
    <language>en</language>${lastBuildDate ? `
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>` : ""}${items ? `
${items}` : ""}
  </channel>
</rss>
`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
		},
	});
};

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
