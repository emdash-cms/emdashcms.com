# Release Research

Use GitHub as the source of truth for the target release. Do not rely on a possibly stale local branch or on training-data recall.

## Resolve the exact release

Start from a version, tag, release URL, or commit supplied by the user. For a published core release, verify it with:

```bash
gh release view 'emdash@<version>' \
  --repo emdash-cms/emdash \
  --json name,tagName,publishedAt,url,body,targetCommitish
```

Resolve the tag to an exact commit SHA. Confirm which package tags point to that same commit; lightweight release tags can be inventoried with:

```bash
git ls-remote --tags https://github.com/emdash-cms/emdash.git | rg '^<commit-sha>\s'
```

If the release is not published, label the work as a draft or upcoming release and pin the exact proposed commit. Do not invent a release date, final package set, or GA status.

## Fetch changelogs from GitHub

Fetch files at the pinned SHA with the GitHub Contents API and the raw media type. At minimum, retrieve:

- `packages/core/CHANGELOG.md`
- `packages/admin/CHANGELOG.md`
- `packages/cloudflare/CHANGELOG.md`

Also retrieve the changelog for every package tag found at the release commit. Read the exact version section, stopping at the next version heading. Do not use only the top-level release body: it can omit package-specific changes.

Create a working ledger with one row per distinct change:

| Change | Packages | PR | Kind | DB migration | User impact | Action needed | Contributor | Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

`Destination` is either a named headline section or the smaller-changes roundup. Collapse duplicate entries carrying the same PR across core, admin, and adapter changelogs.

## Determine database-migration status

Compare the previous release commit with the pinned release commit. A release includes a database migration when it adds or changes a numbered migration under `packages/core/src/database/migrations/`. Changes under `packages/core/src/migrations/` or adapter migration executors are migration tooling changes, not by themselves a new database migration.

Inspect every changed numbered migration and its source PR. Record:

- the migration number and purpose;
- whether it changes schema, indexes, or existing data;
- which database backends or deployment adapters run it;
- whether normal startup or deployment applies it automatically;
- any ordering, downtime, backfill, compatibility, or rollback implication;
- any action required before or after updating packages.

The final post must contain an explicit statement. Use the substance of one of these forms, adapted to the evidence:

- **Database migrations:** None in this release.
- **Database migrations:** Included. Explain what runs, when it runs, and what the operator must do.

Do not infer migration status only from changelog prose. Verify the release diff. If the GitHub compare response is truncated, inspect the exact release trees or diff the pinned commits rather than treating missing files as proof that there are no migrations.

## Inspect source PRs

For every headline candidate and every entry whose impact or migration is unclear, inspect the merged PR at its current GitHub URL:

```bash
gh pr view <number> --repo emdash-cms/emdash \
  --json number,title,url,author,body,mergedAt,mergeCommit,files
gh api --paginate repos/emdash-cms/emdash/issues/<number>/comments
gh api --paginate repos/emdash-cms/emdash/pulls/<number>/reviews
```

Use the PR and merged diff to determine behavior; use linked current docs to verify the public usage instructions. Changeset prose is a useful lead, not independent proof.

For admin UI screenshots, inspect Markdown images and HTML `img` elements in the PR body, issue comments, and review bodies. Prefer an attachment explicitly labelled `after`, `new`, or otherwise clearly showing the final state. Open it before use. Preserve:

- the PR URL;
- the original GitHub attachment URL;
- the original context or caption;
- a locally meaningful filename if the image is downloaded for publication.

Do not use an image when its before/after identity or shipped-state relevance is ambiguous.

## Establish context

Compare the release with the immediately preceding published core release. Useful evidence includes release dates, semantic-version position, the number and kind of distinct changes, and repeated themes across PRs. Context should explain why the release feels the way it does, not merely call it important.

## Contributors and completeness

Collect the credited human GitHub handle for every distinct changelog entry, then verify it against the source PR author or explicit co-author evidence. Exclude `@ascorbic` (the invoking user by default) and bot accounts. Link every remaining handle as `https://github.com/<handle>` and thank each person at least once.

Before drafting, reconcile the ledger against every fetched version section. A long changelog entry may be summarized, but none may disappear.
