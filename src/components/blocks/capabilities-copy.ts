/**
 * Card copy for the Capabilities bento. Capabilities.astro renders it next to
 * each illustration, and the home page's Markdown version (index.md) reads it
 * too, so agents get the same words as people.
 */
export const capabilityCards = {
	anchor: {
		title: "The Astro-native CMS",
		text: "First-class Astro integration. Define content types in the admin, get TypeScript types generated from your schema, and render every entry on the server from structured JSON.",
	},
	familiar: {
		title: "A spiritual WordPress successor",
		text: "Everything you love about WordPress in a fast, modern admin. Pages, posts, media, menus, widgets, and taxonomies are where you expect them, and the built-in importer brings your content over.",
	},
	editorial: {
		title: "Drafts, revisions, and scheduling",
		text: "Edit drafts while the live page stays untouched. Restore earlier revisions, schedule publishing, and share preview links before anything goes live.",
	},
	agents: {
		title: "Built with agents in mind",
		text: "Every site ships with an MCP server. Connect Claude, Codex, Cursor, or any MCP client to draft, edit, search, and schedule content with the same permissions as your team. Scripts get the same through the REST API and CLI.",
	},
	extend: {
		title: "Extend with plugins",
		text: "Add your own block types, admin pages, hooks, storage, and API routes in TypeScript. Every section on this page is a block from this site’s own plugin.",
	},
	secure: {
		title: "Plugins without the security nightmare",
		text: "Plugins you install from the admin run in their own isolated sandbox. They see no environment variables or filesystem, and get only the capabilities they declare and you approve.",
	},
} as const;
