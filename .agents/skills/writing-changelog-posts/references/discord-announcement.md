# Discord announcement

Draft this only when the user asks. Base it on the approved post, and present it in chat for the user to post. Never post it yourself.

## Shape

Keep it short enough to read without expanding:

1. A bold headline naming the version, such as `**EmDash 1.6 is out** 🎉`.
2. Five to seven bullets, one per headline section of the post, each with a bold lead and a short clause. Follow the post's order.
3. `**Upgrade:** \`npx upgrade-emdash@latest\``, then one line giving the database-migration status and any required post-deploy action.
4. The contributor thanks with mentions (below).
5. The post URL on its own line, `https://emdashcms.com/blog/{slug}`. If the post isn't live yet, tell the user the link won't work until it is.

Use Discord Markdown. Wrap any URL other than the post's in `<…>` so Discord doesn't add a preview for it.

## Mention contributors

Thank the same contributors the post thanks (every external human, not `@ascorbic` and not bots). Discord pings someone only for a `<@discord_id>` mention. A GitHub login, or `@login` typed as text, pings no one.

The EmDash Discord bot (`infra/discord-bot` in the `emdash-cms/emdash` checkout) stores the GitHub–Discord links contributors make. In its KV namespace (the `KV` binding in `infra/discord-bot/wrangler.jsonc`), the key `github:{numeric GitHub user ID}` holds a JSON `LinkRecord` with `discord_id` and `discord_username`. Look up each contributor read-only:

```bash
cd <emdash checkout>/infra/discord-bot
for login in <logins>; do
  id=$(gh api "users/$login" --jq .id)
  rec=$(npx wrangler kv key get --remote --namespace-id <KV id from wrangler.jsonc> "github:$id" 2>/dev/null)
  echo "$login $(echo "$rec" | jq -c '{discord_id, discord_username}' 2>/dev/null || echo none)"
done
```

Never write to or delete from this namespace.

- A contributor with a record: use `<@discord_id>`.
- A contributor without one: use `[login](<https://github.com/login>)`.

Put the mentions first, then the unlinked contributors. Under the draft, show a GitHub → Discord username table for the mentioned contributors so the user can check the pings.
