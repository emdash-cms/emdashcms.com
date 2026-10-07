# Editorial Patterns

Use these editorial principles as a starting point, adapting the structure and emphasis to the evidence for each release.

## Core rules

- Open with the release's real unifying idea and a plain-language summary of its most important user outcomes.
- Offer a compact linked highlights list when it helps readers scan several headline changes.
- Explain the previous problem or limitation before introducing a new API, option, or workflow.
- Describe the user's new capability before internal implementation details.
- Put upgrade guidance and any required action where readers will encounter it early.
- Label experimental, beta, and generally available features precisely.
- Pair opt-in features with the shortest correct command, configuration, or UI steps needed to use them.
- Give breaking changes and deprecations dedicated migration instructions, compatibility details, and timelines.
- Disclose known differences or limitations that materially affect whether someone should adopt a feature.
- For meaningful visual changes, use a verified after screenshot from the original merged PR.
- State availability, prerequisites, compatibility dates, billing effects, and affected deployment targets when relevant.
- Link directly to the release, source PRs, and current documentation.
- End with complete smaller-change coverage and contributor acknowledgement.

## Voice and level of detail

- Use the words a site builder would use, not terms from PR descriptions, changesets, or code. PR descriptions are likely to use technical jargon that should be translated into user-facing language. The focus should be on how behaviour changes for the user.
- You do not need to enumerate every changed visual detail unless they materially affect the user's experience. Just keep a representative view.
- Keep headings literal. A heading that characterizes a feature reads as a promise; put that kind of impression in a qualified sentence in the body instead.
- Include a caveat only when it changes what a reader does. Leave out limitations that are accurate but inconsequential.
- Do not feature security fixes as highlights or in the introduction. Describe them plainly in the smaller-changes roundup without labelling them as security issues, and confirm with the user whether each one belongs in the post.
- Keep the introduction short and general, in a conversational tone, with short paragraphs. A plain closing line about the usual reliability and bug fixes is enough; there is no need to list fix areas there.

## Recommended article shape

Adapt the shape to the release rather than filling headings mechanically:

1. Title and excerpt focused on the release's real theme.
2. Introduction with version context and top outcomes.
3. Linked highlights list when there are several major sections.
4. One section per headline outcome, including use instructions and original after screenshots where relevant.
5. A prominent migration or deprecation section when action is required.
6. **Smaller improvements and fixes**, accounting for the remaining ledger.
7. Upgrade guidance, release/docs links, and any final contributor acknowledgement.

Avoid generic celebration, exhaustive internal implementation detail, and headings copied from package boundaries. A user should understand both why to care and what to do next.
