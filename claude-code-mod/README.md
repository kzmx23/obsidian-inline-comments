# obsidian-comments-wake — a Claude Code mod for Agent Comments

The mod wakes an idle Claude Code session when a new comment appears in a Markdown file that the session wrote. The session replies in the same comment thread, and the reply shows up in the Agent Comments panel in Obsidian.

**Needs:** Obsidian 1.8+ with the Agent Comments plugin, a Claude Code build with mods support. Tested on Windows with Claude Code 2.1.312; the mod uses only the Claude Code mods API, so nothing in it is OS-specific.

## Install

1. In Obsidian, install **Agent Comments** from the community directory.
2. Open the plugin settings and set **Author name**. Do not press **Install hook**.
3. In a Claude Code terminal session, run:

   ```
   /plugin install obsidian-comments-wake --marketplace kzmx23/obsidian-inline-comments
   ```

4. Start a new Claude Code session.

To try the mod for one session without installing it, clone this repository and run `claude --plugin-dir <repo>/claude-code-mod`. To load it in every session from a clone, add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`.

## Check that it works

1. Ask Claude to write or edit a `.md` file in your vault.
2. Open the file in Obsidian, select a passage, right-click and choose **Add inline comment**.
3. Type a question and press **Send**. Do not type in the terminal.

Within 3–5 seconds the session starts a turn on its own, appends a `reply` entry to the thread, and the panel shows a **Claude** card with a red dot. A reply you type in **Write a reply…** wakes the session too.

## How it works

| Step | What happens |
|---|---|
| Watch | A `tool.call` hook adds every `.md` the session writes with **Write** or **Edit** to a watch list (the last 50, kept in `$.state`). Entries already in the file are marked as seen. |
| Poll | A `$.clock.every(3000)` timer started in `session.start` reads the watched files and parses `{==passage==}{>>author|date|type: text<<}` blocks. |
| Wake | New entries whose author is not `Claude` and whose type is not `accepted`, `declined`, `resolve` or `react` go into one `$.prompt.submit` per file. The prompt carries the passage, the comment and the reply rules. |
| Reply | The session appends `{>>Claude|YYYY-MM-DD|reply: …<<}` after the thread's last `<<}`, or a separate `suggest:` entry with the replacement text. It never edits the `{==passage==}` itself. |

An entry's key is `path, author, date, type, text`, without the passage, so pressing **Accept** on a suggestion (which rewrites the passage) does not wake the session for the whole thread again.

## Troubleshooting

| What you see | What to do |
|---|---|
| The session never wakes | Run `claude --debug-file debug.log` and look for `hooks module obsidian-comments-wake@inline loaded`. If it is missing, the mod is not installed or the path is wrong. |
| One file never wakes the session | The session did not write that file. Ask Claude to make any edit in it. |
| Your comments are signed `user` | Set **Author name** in the plugin settings. |
| The reply lands in the terminal, not in the file | Tell the session: "Reply in the file, as a reply entry in the thread." |

## Limits

1. The session has to be open. The mod does not start a closed session.
2. A comment in a file the session did not write does not wake it.
3. Two entries with the same author, date, type and text on different passages count as one.
4. The prompt sent to the session is in Russian. Edit `buildPrompt` in `hooks/comments.ts` to change it.

## Development

- `hooks/comments.ts` — the parser and the prompt. `hooks/register.ts` — the hooks and the timer.
- Tests: `claude plugin test <mod folder>`.
- Manifest check: `claude plugin validate <mod folder>`.
- Types appear in `.claude-plugin/types/` after the mod first loads from a folder the session hot-reloads; then run `npx -p typescript tsc -p <mod folder>`.

License: MIT, as the plugin.
