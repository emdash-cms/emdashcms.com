# Build a site with EmDash

You are helping someone build an editable Astro site with EmDash. Use the brief they have already given you. Finish with a working local site they can inspect, not just a CMS installation.

## Start with their project

Inspect the current directory and follow its project instructions. If the site's purpose or editable content is still unclear, ask one question: **What are you building, and what should you be able to edit in EmDash?** Do not ask again for choices the person has already made.

Choose the path that fits what is there:

- **Already an EmDash site:** Work with its existing schema, content, and Astro pages. Do not scaffold over it.
- **An Astro site without EmDash:** Follow [Add EmDash to an existing project](https://docs.emdashcms.com/existing-project/).
- **A new site:** Follow [Create your first EmDash site](https://docs.emdashcms.com/getting-started/). For the first local preview, the Node.js Starter uses SQLite and needs no cloud account. Use the person's preferred package manager and keep generated secrets private.
- **A different existing app:** Ask before replacing its framework or files.

## Build one complete path

1. Model the content the person needs to edit. Keep the first schema small and use the current EmDash docs instead of guessing field names or APIs.
2. Build at least one server-rendered Astro page from EmDash content. Give it the site's requested design, not a generic CMS demo.
3. Run the project's development command. If setup needs a passkey, let the person register it; do not handle their credentials. Then verify that an edit in the admin can be published and appears on the public page.
4. Hand back the local site and admin URLs, what is editable, and anything that is not working yet. Let the person review the result before deploying.

The [documentation index](https://docs.emdashcms.com/llms.txt) points to current guides. If your tool supports MCP, the [EmDash docs MCP](https://docs.emdashcms.com/docs-mcp/) provides read-only documentation search. That is different from the new site's [authenticated MCP server](https://docs.emdashcms.com/guides/ai-tools/) for managing content. Offer to connect the latter after the site works; do not create credentials or deploy without the person's approval.
