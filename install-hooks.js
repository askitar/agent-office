'use strict';
// Registra (o quita con --remove) los hooks HTTP de la oficina en ~/.claude/settings.json.
// Es idempotente y deja un respaldo la primera vez.
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL_HOOK = 'http://localhost:4780/hook';
const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'Stop', 'Notification', 'SubagentStart', 'SubagentStop'];
const file = path.join(os.homedir(), '.claude', 'settings.json');
const backup = path.join(os.homedir(), '.claude', 'settings.backup-oficina.json');

const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

const remove = process.argv.includes('--remove');
cfg.hooks = cfg.hooks || {};
const mine = (e) => e.hooks && e.hooks.some((h) => h.type === 'http' && h.url === URL_HOOK);

for (const ev of EVENTS) {
  const list = Array.isArray(cfg.hooks[ev]) ? cfg.hooks[ev] : [];
  const rest = list.filter((e) => !mine(e));
  if (!remove) rest.push({ matcher: '*', hooks: [{ type: 'http', url: URL_HOOK }] });
  if (rest.length) cfg.hooks[ev] = rest; else delete cfg.hooks[ev];
}
if (!Object.keys(cfg.hooks).length) delete cfg.hooks;

fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
console.log(remove ? 'Hooks de la oficina quitados.' : 'Hooks de la oficina registrados en ' + file);
