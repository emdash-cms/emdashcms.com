/**
 * Blog figures plugin (inline, template-local).
 *
 * Registers the `blog.figure` Portable Text block so editors can place one of
 * the site's interactive figures in a post. The figure itself is built in
 * code (src/components/blog/figures/); the block only picks which one, and
 * holds its caption and its text alternative.
 *
 * Site-side rendering goes through PostFigure.astro, wired into the post page.
 */

import { definePlugin } from "emdash";
import type { PluginDefinition } from "emdash";

/** Every figure the site can render. PostFigure.astro maps the values to components. */
export const FIGURE_OPTIONS = [
	{ label: "Relay or room", value: "relay-or-room" },
	{ label: "How the parts fit", value: "how-the-parts-fit" },
	{ label: "Saved means saved", value: "saved-means-saved" },
	{ label: "10,000 fuzz runs", value: "fuzz-runs" },
];

const definition: PluginDefinition = {
	id: "blog-figures",
	version: "0.1.0",

	admin: {
		portableTextBlocks: [
			{
				type: "blog.figure",
				label: "Figure",
				description: "Interactive figure with a caption",
				category: "Media",
				fields: [
					{
						type: "select",
						action_id: "figure",
						label: "Figure",
						options: FIGURE_OPTIONS,
						initial_value: FIGURE_OPTIONS[0]?.value,
					},
					{ type: "text_input", action_id: "caption", label: "Caption", multiline: true },
					{
						type: "text_input",
						action_id: "description",
						label: "Description (read to people who can't see the figure)",
						multiline: true,
					},
				],
			},
		],
	},
};

export function createPlugin() {
	return definePlugin(definition);
}

export default createPlugin;
