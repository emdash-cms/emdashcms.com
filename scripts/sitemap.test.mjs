import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSitemap } from "../src/lib/sitemap.mjs";

test("includes CMS modification dates and escaped SEO images without inventing static dates", () => {
	const xml = renderSitemap([
		{ location: "https://emdashcms.com/blog/a&b", lastmod: "2026-09-27T10:00:00.000Z", image: "https://emdashcms.com/image?a=1&b=2" },
		{ location: "https://emdashcms.com/astro-cms" },
	]);
	assert.match(xml, /<loc>https:\/\/emdashcms\.com\/blog\/a&amp;b<\/loc>/);
	assert.match(xml, /<lastmod>2026-09-27T10:00:00\.000Z<\/lastmod>/);
	assert.match(xml, /<image:image><image:loc>https:\/\/emdashcms\.com\/image\?a=1&amp;b=2<\/image:loc><\/image:image>/);
	assert.match(xml, /<url>\s*<loc>https:\/\/emdashcms\.com\/astro-cms<\/loc>\s*<\/url>/);
});
