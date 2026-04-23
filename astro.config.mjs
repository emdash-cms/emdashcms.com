import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { access, d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	experimental: {
		cache: {
			provider: cacheCloudflare(),
		},
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			// Cloudflare Access for admin UI auth.
			// AUD is read at runtime from CF_ACCESS_AUDIENCE (wrangler secret).
			// MCP + OAuth paths are bypassed by a separate Access app so EmDash's
			// own OAuth flow remains intact.
			auth: access({
				teamDomain: "cf-emdash-cms.cloudflareaccess.com",
				autoProvision: true,
				defaultRole: 30, // Author; first user auto-promoted to Admin
			}),
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-sans",
			weights: [400, 500, 600, 700, 800],
			fallbacks: ["sans-serif"],
		},
	],
	devToolbar: { enabled: false },
});
