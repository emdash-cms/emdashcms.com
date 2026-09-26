# Home content handoff

The marketing redesign is rendered from the published Home entry in EmDash. Updating `seed/seed.json` alone does not change an existing site. This command prepares a reviewable update for the current Home entry; it does not change the Hero or publish anything.

After the stacked code PRs are merged, authenticate to the site's content API. Set `EMDASH_TOKEN` in the environment and, if Cloudflare Access protects the API, set `EMDASH_HEADERS` with one required header per line. Do not put credentials in the command or a tracked file.

1. Run a dry run and review the complete before/after values for Features, Testimonials, and FAQ:

   ```sh
   pnpm home:content --url https://emdashcms.com
   ```

2. Confirm the Hero hash and any other blocks stay unchanged. Copy `revision` and `planHash` from the output. The command refuses missing, duplicate, or reordered marketing blocks and an existing unpublished draft.
3. Create **only a draft** from the reviewed plan:

   ```sh
   pnpm home:content --url https://emdashcms.com --apply --expected-rev 'REVISION' --expected-hash 'PLAN_HASH'
   ```

4. Open the returned Home editor URL, inspect the draft and public preview, then publish through the admin when approved. If the page changed or an editor has it locked, stop and make a new plan; do not override the lock.

For a disposable localhost rehearsal, authenticate through the dev-bypass endpoint and provide its session cookie through `EMDASH_HEADERS`. Never commit the cookie or run the apply step against production before the code stack is merged and the content plan is approved.
