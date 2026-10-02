---
name: writing-changelog-posts
description: Research and write EmDash release and changelog blog posts from GitHub release evidence. Use for version announcements, release notes, upgrade posts, and changelog entries that must cover core, admin, adapters, migrations, screenshots, and contributor credit.
---

# Writing EmDash Changelog Posts

Produce a blog-ready account of an EmDash release, not a reformatted package changelog. Lead with what changed for users, explain how to adopt it, and retain complete coverage of the underlying release.

First present the complete post draft and evidence list in chat. Do not create a CMS entry or upload media until the user explicitly approves that version for CMS drafting. Approval to create the CMS draft does not authorize publishing it.

After that approval, read [references/posting-approved-draft.md](references/posting-approved-draft.md) and use the site's EmDash MCP to create and verify an unpublished draft. Return a review link. Publishing the post live is a separate action that always requires a new, explicit user request.

## Research the release

Read [references/release-research.md](references/release-research.md) before gathering evidence. Fetch release data and changelog sections from `emdash-cms/emdash` on GitHub at the exact release commit. A local checkout may help navigate, but it is not release truth.

Always cover the released sections for:

- `packages/core/CHANGELOG.md` (`emdash`)
- `packages/admin/CHANGELOG.md` (`@emdash-cms/admin`)
- `packages/cloudflare/CHANGELOG.md` (`@emdash-cms/cloudflare`)
- every other package tag attached to the same release commit, especially adapter, runtime, deployment, and integration packages

Deduplicate entries repeated across package changelogs by PR number or commit. Treat one cross-package change as one user-facing story. Keep a coverage ledger so every changelog item ends up under a headline section or in the smaller-changes roundup.

For every release, determine whether it includes database migrations. State the result explicitly in the post even when there are none. When migrations are present, explain what they change, which deployments or adapters are affected, whether they run automatically, and any required deployment order or operator action.

Use the release history, the previous release, linked issues, and the distribution of changes to establish context. Make context specific and evidenced: for example, the first release since 1.0, a bug-fix-heavy stabilization release, or a release concentrated on images. Do not force a theme that the changes do not support.

## Choose the story

Read [references/editorial-patterns.md](references/editorial-patterns.md) before drafting.

Start with a short introduction that names the version, its place in the project, and the two or three outcomes that best characterize it. Follow with a compact linked highlights list when the post has several headline sections.

Give each headline change its own section. Organize by user outcome rather than package boundaries. For each new feature, answer:

1. What can the user do now, or what problem went away?
2. Who benefits and under what availability or prerequisites?
3. Is it automatic, or what exact config, command, package update, or UI action enables it?

For a breaking change or deprecation, say plainly who is affected, what continues to work, when behavior changes, and the exact migration required. Give a concrete before/after or command when useful. Do not bury required action in the final roundup.

Separate maturity labels such as experimental, beta, and generally available. State limitations or known differences that materially affect adoption.

## Use original UI evidence

For a headline feature with meaningful admin UI, inspect its original merged PR. Search the PR body, issue comments, and review bodies for an explicitly identified after screenshot. Use the original after image rather than recreating the UI, generating a mockup, or substituting a before image.

Verify that the screenshot shows the shipped state and is relevant to the section. Record its source PR and original attachment URL. Give it specific alt text and a short caption when context is not self-evident. If the PR has no unambiguous after screenshot, omit the image and state that no suitable original was found; never guess.

## Credit contributors

Build the contributor set from every covered changelog entry and its source PR. Thank every human contributor except the invoking user, and link their GitHub profile. For this project, treat `@ascorbic` as the user unless they specify another handle. Omit bots.

Credit a contributor naturally in the relevant headline section or smaller-change bullet. Ensure each external contributor is thanked at least once, without repeating formulaic thanks throughout the post.

## Finish with complete coverage

End with a section such as **Smaller improvements and fixes**. Enumerate everything not already covered as a headline, grouped only when grouping improves comprehension. Each bullet should describe observable behavior, link the PR, and credit any external contributor.

Then include:

- the exact upgrade command or version guidance;
- an explicit database-migration status: either that the release includes none, or what its migrations do and what users must do;
- a release link and relevant current documentation links;
- any required migration reminder that deserves repetition;
- the `changelog` blog tag when preparing CMS-ready content and that taxonomy is available.

Before handing off, verify that every released changelog item is accounted for, database-migration status is explicit, every external human contributor is linked and thanked, each screenshot is an original after image from its PR, and every opt-in, breaking change, or deprecation has an actionable instruction.

Write in EmDash's short, factual, direct voice. Prefer concrete actors and behaviors over launch language. Do not claim performance, safety, compatibility, or availability beyond the evidence.
