# Agent Office

A live 3D office where your [Claude Code](https://claude.com/claude-code) sessions and subagents show up as characters at their desks, working for real. When a session starts, calls a tool, launches a subagent or needs your approval, you see it happen in the office.

The office has two departments, **Agencia** (client work) and **Estudio** (my Askitar video studio), with a shared kitchen, lounge and reception in the middle. The UI is in Spanish.

Inspired by [pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk) by Mgpixelart; this is an independent implementation with its own three.js office, server, roster and chat.

## What it does

- **Real activity, not a mockup.** Claude Code hooks send every session event (start, prompt, tool use, subagent start/stop, notifications) to a local server, which drives the scene.
- **One character per agent.** Each subagent type has its own desk and personality; unknown subagents appear as interns. Every monitor shows what that agent is doing right now, and the TVs show office-wide activity.
- **Talk to any character.** Click someone to chat; the server runs `claude -p --agent <type>` with your own plan.
- **Per-agent permission levels.** *Read only*, *Can work* (edits files in its folder and runs the commands of its trade, asks before anything else) or *Everything on*. Some actions are always blocked at every level: sending messages (drafts only), deleting pages or files in bulk, spending paid credits, `git push`, `git reset --hard`.
- **Office life.** Characters chat, eat in the kitchen, nap on the sofa, run to the boss's office when they need your OK, and hand over finished work with confetti.
- **Demo mode** that simulates two busy sessions without using Claude at all.
- **Camera controls**: orbit, pan, fly to a point, first-person walk mode, follow mode, guided tour and a minimap.

## Run it

Requirements: Node.js 18+, Claude Code installed and signed in.

```bash
node tools/fetch-assets.js   # downloads the CC0 3D models, textures and HDRIs from Poly Haven (~190 MB)
node install-hooks.js        # registers the office hooks in ~/.claude/settings.json (keeps a backup)
node server.js               # or double-click start.bat; opens http://localhost:4780
```

Remove the hooks with `node install-hooks.js --remove`.

## Configure it

- `roster.json`: departments, characters, which agent type sits at which desk, and the folder each character works in (`chat.cwd`, relative to this folder). Sessions are assigned to a department by matching their working folder against `cwdPatterns`.
- Permission rules live at the top of `server.js` (`WORK_TOOLS`, `ALWAYS_DENY`).
- Conversations and settings are saved locally in `chats.json` and `config.json` (both ignored by git).

## Tech

Node.js HTTP server (no framework) · Claude Code hooks · three.js · plain JavaScript modules · Poly Haven CC0 assets

## Credits

- Idea: [pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk).
- three.js (MIT) is bundled in `public/vendor/three`.
- 3D models, textures and HDRIs: [Poly Haven](https://polyhaven.com), CC0. See `public/3d/assets/credits.json`.
- Character names are an homage to a TV workplace comedy; this project is not affiliated with it.

## License

[MIT](LICENSE)
