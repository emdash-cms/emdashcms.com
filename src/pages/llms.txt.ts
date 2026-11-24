import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";
import { markdownPath } from "../lib/markdown";

export const prerender = false;

/**
 * llms.txt (https://llmstxt.org): a Markdown map of the site for language
 * models. Links point at each page's Markdown twin (see src/lib/markdown.ts),
 * which names the HTML page to cite in its frontmatter.
 */
export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const abs = (path: string) => new URL(path, siteUrl).href;
	const [{ entries: posts, cacheHint }, settings] = await Promise.all([
		getEmDashCollection("posts", { status: "published", orderBy: { published_at: "desc" }, limit: 50 }),
		getSiteSettings(),
	]);

	if (cache?.enabled) cache.set(cacheHint);

	const title = settings?.title || "EmDash CMS";
	const postLines = posts.map((post) => {
		const excerpt = post.data.excerpt?.trim().replace(/\s+/g, " ");
		const title = post.data.title.trim().replace(/[[\]]/g, "\\$&");
		return `- [${title}](${abs(markdownPath(`/blog/${encodeURIComponent(post.id)}`))})${excerpt ? `: ${excerpt}` : ""}`;
	});

	const body = `# ${title}

> EmDash is an open source (MIT), full-stack TypeScript CMS for Astro and the spiritual successor to WordPress. Every site ships with an admin, an MCP server, a REST API and a CLI, and plugins run in isolated sandboxes. It runs on Cloudflare (D1, R2, Workers) or Node.js (SQLite, libSQL, PostgreSQL).

- Start a project: \`npm create emdash@latest\`
- Try it without installing: https://try.emdashcms.com
- Source code: https://github.com/emdash-cms/emdash
- Package: https://www.npmjs.com/package/emdash

## Site

- [Home](${abs("/index.md")}): what EmDash is, what it does, and answers to common questions
- [Build a site with EmDash](${abs("/start.md")}): step-by-step instructions for coding agents
- [Blog](${abs("/blog.md")}): release notes and product updates
- [Showcase](${abs("/showcase.md")}): sites in production built with EmDash

## Documentation

- [EmDash docs](https://docs.emdashcms.com/llms.txt): the full documentation index for language models
- [Docs MCP server](https://docs.emdashcms.com/mcp): search the live docs from any MCP client
- [Plugin registry](https://plugins.emdashcms.com): plugins you can install from the admin
${postLines.length > 0 ? `\n## Blog posts\n\n${postLines.join("\n")}\n` : ""}
## Optional

- [RSS feed](${abs("/rss.xml")})
- [AI catalog](${abs("/.well-known/ai-catalog.json")})
- [Agent skills](${abs("/.well-known/agent-skills/index.json")})
`;

	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
