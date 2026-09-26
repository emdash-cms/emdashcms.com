# Home content handoff

The marketing redesign is rendered from the published Home entry in EmDash. Updating `seed/seed.json` alone does not change an existing site. This command is read-only: it compares the current Home entry against the reviewed seed, preserving the live Hero and any unrelated blocks.

After the stacked code PRs are merged, deployed, and verified on the production site, authenticate to the site's content API with a read-only token. Set `EMDASH_TOKEN` in the environment and, if Cloudflare Access protects the API, set `EMDASH_HEADERS` with one required header per line. Do not put credentials in the command or a tracked file. The planner refuses credentialed remote HTTP; localhost is allowed for disposable rehearsal only.

1. Generate a read-only plan and review the complete before/after values for Features, Testimonials, and FAQ:

   ```sh
   pnpm home:content --url https://emdashcms.com
   ```

2. Confirm that each preserved block's `beforeHash` and `afterHash` match, including the Hero. The command refuses missing, duplicate, or reordered marketing blocks, an existing unpublished draft, and a scheduled publication. The `revision` and `planHash` identify the reviewed snapshot; regenerate the plan if either changes.
3. In the Home editor, change only the blocks listed in `changes`. Save a draft, compare it against the plan, preview it, and publish only after approval. If the page changed, has a schedule, or another editor has it locked, stop and plan again; do not override the lock. Run the planner again afterward to confirm the published blocks match the seed.

EmDash 0.38.0 does not atomically guard a revisioned draft update against a concurrent schedule. This site repository therefore does not automate the draft write. A core-level concurrency fix should precede any automated production migration. For a disposable localhost read rehearsal, authenticate through the dev-bypass endpoint and provide its session cookie through `EMDASH_HEADERS`. Never commit the cookie.
