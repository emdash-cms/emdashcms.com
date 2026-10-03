# Posting an approved draft

Use this workflow only after the user has reviewed the complete changelog post in chat and explicitly approved creating it in the CMS. Their approval authorizes an unpublished CMS draft, not publication.

## Check the live destination

Use the site's EmDash MCP rather than editing seed data or calling an unauthenticated API.

1. Call `schema_get_collection` for `posts`. Confirm the live field names, required values, rich-text field, supported capabilities, and image shape before constructing the entry. Do not assume the repository seed and live schema are identical.
2. Call `taxonomy_list_terms` for the exact taxonomy name `tag`. Confirm that the `changelog` term exists. Do not silently create or substitute a taxonomy or term; report the missing prerequisite instead.
3. Resolve any approved byline against existing bylines when the post needs one. Do not invent an author or create a new byline without authorization.

## Prepare approved media

For each approved original PR screenshot, call `media_upload` with its public attachment URL, a useful filename, and the approved alt text. Preserve the source PR and original attachment URL in the evidence record. Use the returned media URL or ID in the form required by the live schema.

Do not upload unapproved images. If an external attachment cannot be fetched, report it rather than replacing it with a recreation or a different screenshot.

## Create and verify the CMS draft

Call `content_create` with:

- `collection: "posts"`;
- `status: "draft"` explicitly;
- the approved slug;
- a `data` object matching the live schema, including the approved title, excerpt, and post body as Markdown for the Portable Text field;
- `taxonomies: { tag: ["changelog"] }`;
- only approved byline and media values, when applicable.

Do not call `content_publish`. Do not make editorial changes while transferring the approved copy; if the schema requires a substantive change, return to the user for approval.

After creation, call `content_get` with `collection: "posts"`, the returned ID, and `markdown: true`. Verify that:

- the status is `draft`;
- the slug, title, excerpt, body, media, byline, and `changelog` tag match the approved version;
- no required field was dropped or silently transformed.

Correct only mechanical transfer errors. Read the entry again before any `content_update` and pass its current `_rev`. Ask before making substantive edits.

## Return a review link

Call `settings_get` and use the canonical site URL to construct the absolute admin editor link:

```text
{siteUrl}/_emdash/admin/content/posts/{url-encoded-content-id}
```

Return the entry's draft status and that editor link. If the available authenticated tooling can generate a signed draft-preview URL, return it as well. Otherwise, tell the user to open the editor link and select **View on site** to generate and open the preview.

Do not invent a public or signed preview URL. A collection advertising preview support does not by itself provide the signed URL, and the public `/blog/{slug}` route may not expose drafts. If preview support or authenticated preview tooling is unavailable, say so clearly and still return the editor link.

## Publish only after separate approval

Creating or approving the CMS draft never implies approval to publish. Publish only when the user later makes an explicit request to put that reviewed draft live. Immediately before publishing, call `content_get`, confirm the item and draft are the intended version, and pass its fresh `_rev` to `content_publish`. If the revision conflicts or the draft has changed, stop and reread rather than publishing stale or unreviewed content.
