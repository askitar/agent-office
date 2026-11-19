'use strict';
// Servidor de la oficina: recibe los hooks de Claude Code, lleva el estado
// de sesiones/subagentes y lo transmite a la pagina (SSE). Tambien deja
// hablar con los agentes lanzando `claude -p`. Sin dependencias externas.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = Number(process.env.OFICINA_PORT || 4780);
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const SOUND_FILE = path.join(ROOT, 'assets', 'aviso.wav');
const EVENTS_LOG = path.join(ROOT, 'events.jsonl');

const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'roster.json'), 'utf8'));
const chars = new Map(roster.characters.map((c) => [c.id, c]));
const residentByType = new Map(
  roster.characters.filter((c) => (c.kind === 'resident' || c.kind === 'reserve') && c.agentType).map((c) => [c.agentType, c.id])
);
const tempPool = {};
for (const c of roster.characters) if (c.kind === 'temp') (tempPool[c.dept] = tempPool[c.dept] || []).push(c.id);
const departments = roster.departments;
const defaultDept = (departments.find((d) => d.default) || departments[0]).id;
const bossOf = {};
for (const d of departments) bossOf[d.id] = d.boss;
const deptRegex = departments.map((d) => ({ id: d.id, res: (d.cwdPatterns || []).map((p) => new RegExp(p, 'i')) }));
function deptOfCwd(cwd) {
  const c = String(cwd || '');
  for (const d of deptRegex) if (d.res.some((r) => r.test(c))) return d.id;
  return defaultDept;
}

// ---------- permisos de los agentes en el chat ----------
// El chat corre sin nadie que apruebe en pantalla: lo que no este permitido aqui se bloquea y la oficina te pregunta a ti.
const LEVELS = ['read', 'work', 'full'];
const cmds = (list) => list.flatMap((c) => [`Bash(${c} *)`, `PowerShell(${c} *)`]);
const notion = (n) => 'mcp__claude_ai_Notion__notion-' + n;
const slack = (n) => 'mcp__claude_ai_Slack__slack_' + n;
const gmail = (n) => 'mcp__claude_ai_Gmail__' + n;
const drive = (n) => 'mcp__claude_ai_Google_Drive__' + n;
const AGENCY_READ = [notion('fetch'), notion('search'), notion('query-data-sources'), notion('get-comments'),
  slack('read_channel'), slack('read_thread'), slack('search_public_and_private'), slack('search_channels'), slack('search_users'), slack('read_user_profile'),
  gmail('search_threads'), gmail('get_thread'), gmail('get_message'),
  drive('search_files'), drive('get_file_metadata'), drive('read_file_content'), drive('list_recent_files')];
const READ_TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Skill', 'ToolSearch', ...AGENCY_READ];
const WORK_BASE = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'WebSearch', 'WebFetch', 'Skill', 'ToolSearch', 'Task', 'Agent'];
const WORK_TOOLS = {
  askitar: [...WORK_BASE, ...cmds(['npx', 'npm', 'node', 'ffmpeg', 'ffprobe', 'python', 'py', 'git status', 'git diff', 'git log']), 'mcp__premiere-pro', 'mcp__aftereffects', 'mcp__blender'],
  agency: [...WORK_BASE, ...AGENCY_READ, slack('send_message_draft'), gmail('create_draft'), ...cmds(['git status', 'git diff', 'git log'])],
};
// nunca, en ningun nivel: enviar mensajes (solo borradores), gastar creditos, ni borrar en masa
const ALWAYS_DENY = [slack('send_message'), slack('schedule_message'), gmail('send_message'), gmail('reply'), gmail('forward'), gmail('trash_message'), gmail('trash_thread'),
  notion('delete-pages'), notion('delete-databases'), 'mcp__claude_ai_Higgsfield', 'mcp__claude_ai_ElevenLabs', 'mcp__elevenlabs',
  ...cmds(['rm -rf', 'git push', 'git reset --hard', 'del']), 'PowerShell(Remove-Item *)', 'PowerShell(*Remove-Item *)'];
// comandos normales de trabajo: al aprobar uno queda aprobada la herramienta; cualquier otro se aprueba solo tal cual
const SAFE_FIRST = ['npx', 'npm', 'pnpm', 'node', 'python', 'py', 'ffmpeg', 'ffprobe', 'git', 'ls', 'dir', 'cat', 'type', 'mkdir', 'cp', 'copy', 'mv', 'move', 'echo', 'tsc', 'get-childitem', 'get-content', 'test-path', 'new-item', 'copy-item', 'move-item', 'whoami'];
function ruleFor(d) {
  const t = String(d.tool_name || ''), i = d.tool_input || {};
  if (t === 'Bash' || t === 'PowerShell') {
    const cmd = String(i.command || '').trim(), first = cmd.split(/\s+/)[0].replace(/^["']|["']$/g, '').toLowerCase();
    return { rule: SAFE_FIRST.includes(first) ? `${t}(${first} *)` : `${t}(${cmd})`, label: 'Correr: ' + clip(cmd, 140) };
  }
  if (t === 'Write' || t === 'Edit' || t === 'NotebookEdit') return { rule: t, label: (t === 'Write' ? 'Crear archivo: ' : 'Editar: ') + clip(i.file_path || i.notebook_path || '', 140) };
  return { rule: t, label: 'Usar ' + t.replace(/^mcp__/, '').replace(/__/g, ': ').replace(/claude_ai_/, '') };
}
const levelOf = (id) => { const c = chars.get(id); return (config.levels && config.levels[id]) || (c && c.chat && c.chat.level) || 'work'; };
function chatPermissions(id) {
  const c = chars.get(id), level = levelOf(id), extra = (config.allow && config.allow[id]) || [];
  if (level === 'read') return { mode: 'default', allow: READ_TOOLS, deny: ALWAYS_DENY };
  const base = WORK_TOOLS[c.dept] || WORK_TOOLS.askitar;
  return { mode: level === 'full' ? 'auto' : 'acceptEdits', allow: [...new Set([...base, ...extra])], deny: ALWAYS_DENY };
}

let config = { sound: true, stats: { date: '', done: 0 } };
try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; } catch (_) {}
const saveConfig = () => { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch (_) {} };

// ---------- estado ----------
const sessions = new Map();      // session_id -> {id, project, status, tool, text, lastSeen, demo, chatChar}
const subs = new Map();          // agent_id -> {id, type, session, charId, status, text, tool, desc, last, since}
const chatSessions = new Map();  // session_id -> charId
const chats = new Map();         // charId -> {sessionId, started, busy, history[]}
const CHATS_FILE = path.join(ROOT, 'chats.json');
try { for (const [id, v] of Object.entries(JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8')))) chats.set(id, { sessionId: v.sessionId, started: !!v.started, busy: false, history: v.history || [], pending: v.pending || null }); } catch (_) {}
function saveChats() {
  const out = {};
  for (const [id, st] of chats) out[id] = { sessionId: st.sessionId, started: st.started, history: st.history.slice(-200), pending: st.pending || null };
  try { fs.writeFileSync(CHATS_FILE, JSON.stringify(out, null, 1)); } catch (_) {}
}
const pendingDeleg = new Map();  // session_id -> [{type, description}]
const log = [];
const clients = new Set();
let lastAlertSound = 0;

const base = (p) => (p ? String(p).split(/[\\/]/).filter(Boolean).pop() : '');
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function addLog(kind, who, text) {
  log.push({ t: Date.now(), kind, who, text: clip(text, 140) });
  while (log.length > 80) log.shift();
}

function describeTool(name, inp) {
  inp = inp || {};
  switch (name) {
    case 'Read': return 'Leyendo ' + clip(base(inp.file_path), 28);
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return 'Editando ' + clip(base(inp.file_path || inp.notebook_path), 26);
    case 'Write': return 'Escribiendo ' + clip(base(inp.file_path), 24);
    case 'Bash': case 'PowerShell': return 'Ejecutando: ' + clip(inp.command, 30);
    case 'Grep': return 'Buscando "' + clip(inp.pattern, 22) + '"';
    case 'Glob': return 'Buscando archivos ' + clip(inp.pattern, 18);
    case 'WebSearch': return 'Buscando en la web: ' + clip(inp.query, 28);
    case 'WebFetch': return 'Leyendo la web';
    case 'Task': case 'Agent': return 'Delegando: ' + clip(inp.description, 28);
    case 'TodoWrite': case 'TaskCreate': case 'TaskUpdate': return 'Organizando tareas';
    case 'Skill': return 'Usando skill ' + clip(inp.skill, 20);
    default:
      if (/^mcp__/.test(name || '')) return 'Usando ' + clip(String(name).split('__')[1] || 'herramienta', 20);
      return 'Usando ' + clip(name, 20);
  }
}

// ---------- asignacion de personajes ----------
function busyChars() {
  const s = new Set();
  for (const x of subs.values()) s.add(x.charId);
  for (const c of chatSessions.values()) s.add(c);
  return s;
}
function allocChar(type, dept) {
  const busy = busyChars();
  const res = residentByType.get(type);
  if (res && !busy.has(res)) return res;
  const d = res ? chars.get(res).dept : dept;
  const pool = tempPool[d] || tempPool[defaultDept] || [];
  const free = pool.find((id) => !busy.has(id));
  return free || pool[Math.floor(Math.random() * pool.length)];
}
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function bumpDone() {
  const k = todayKey();
  if (!config.stats || config.stats.date !== k) config.stats = { date: k, done: 0 };
  config.stats.done++; saveConfig();
}

// ---------- transmision ----------
function buildState() {
  const actors = {};
  const list = [...sessions.values()].filter((s) => !s.chatChar);
  list.sort((a, b) => b.lastSeen - a.lastSeen);
  for (const dep of departments) {
    const mine = list.filter((s) => s.dept === dep.id);
    const waiting = mine.find((s) => s.status === 'waiting');
    const working = mine.find((s) => s.status === 'working');
    const pick = waiting || working;
    actors[dep.boss] = pick
      ? { status: waiting ? 'waiting' : 'working', text: pick.text || '', project: pick.project }
      : { status: 'idle', text: '' };
  }

  for (const [sid, charId] of chatSessions) {
    const s = sessions.get(sid);
    if (s) actors[charId] = { status: s.status === 'waiting' ? 'waiting' : s.status, text: s.text || '', project: s.project, chat: true };
    else actors[charId] = { status: 'working', text: 'Pensando…', chat: true };
  }
  for (const s of subs.values()) {
    actors[s.charId] = { status: s.status, text: s.text, desc: s.desc, type: s.type, last: s.last, project: s.project, sub: true };
  }
  return {
    actors,
    sessions: list.map((s) => ({ id: s.id.slice(0, 8), project: s.project, status: s.status, demo: !!s.demo, dept: s.dept })),
    log: log.slice(-40),
    sound: config.sound,
    done: config.stats && config.stats.date === todayKey() ? config.stats.done : 0,
    levels: Object.fromEntries(roster.characters.filter((c) => c.chat).map((c) => [c.id, levelOf(c.id)])),
  };
}

let pushTimer = null;
function pushState() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    broadcast({ type: 'state', ...buildState() });
  }, 60);
}
function broadcast(obj) {
  const data = 'data: ' + JSON.stringify(obj) + '\n\n';
  for (const res of clients) { try { res.write(data); } catch (_) { clients.delete(res); } }
}
const cue = (kind, charId, text, extra) => broadcast({ type: 'cue', kind, charId, text: text || '', ...(extra || {}) });

// ---------- sonido ----------
function playAlert() {
  if (!config.sound) return;
  const now = Date.now();
  if (now - lastAlertSound < 15000) return;
  lastAlertSound = now;
  try {
    spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command',
      `(New-Object Media.SoundPlayer '${SOUND_FILE}').PlaySync()`], { windowsHide: true, stdio: 'ignore' });
  } catch (_) {}
}

// ---------- hooks ----------
function handleHook(d) {
  const ev = d.hook_event_name;
  const sid = d.session_id;
  if (!ev) return;
  const now = Date.now();
  let s = sid ? sessions.get(sid) : null;
  if (!s && sid && ev !== 'SessionEnd') {
    s = { id: sid, project: base(d.cwd), dept: deptOfCwd(d.cwd), status: 'idle', text: '', lastSeen: now, demo: String(sid).startsWith('demo'), chatChar: chatSessions.get(sid) || null };
    sessions.set(sid, s);
  }
  if (s) { s.lastSeen = now; if (d.cwd) { s.project = base(d.cwd); s.dept = deptOfCwd(d.cwd); } if (s.chatChar && chars.get(s.chatChar)) s.dept = chars.get(s.chatChar).dept; }
  const bossId = s ? bossOf[s.dept] : bossOf[defaultDept];

  const sub = d.agent_id ? subs.get(d.agent_id) : null;

  switch (ev) {
    case 'SessionStart':
      if (s) { s.status = 'idle'; s.text = ''; }
      break;
    case 'SessionEnd':
      if (sid) { sessions.delete(sid); }
      break;
    case 'UserPromptSubmit':
      if (s) {
        s.status = 'working'; s.text = 'Pensando…';
        if (!s.chatChar) { addLog('prompt', 'Oscar', d.prompt || 'nueva orden'); cue('prompt', bossId, clip(d.prompt, 60)); }
      }
      break;
    case 'PreToolUse': {
      const text = describeTool(d.tool_name, d.tool_input);
      if (d.tool_name === 'Task' || d.tool_name === 'Agent') {
        const q = pendingDeleg.get(sid) || [];
        q.push({ type: (d.tool_input && d.tool_input.subagent_type) || 'general-purpose', description: (d.tool_input && d.tool_input.description) || '' });
        pendingDeleg.set(sid, q);
      }
      if (sub) { sub.status = 'working'; sub.text = text; sub.tool = d.tool_name; }
      else if (s) { s.status = s.status === 'waiting' ? 'working' : (s.status === 'idle' ? 'working' : s.status); s.text = text; }
      break;
    }
    case 'Stop':
      if (s) { s.status = 'idle'; s.text = ''; if (!s.chatChar) addLog('stop', chars.get(bossId).name, 'Terminé el trabajo'); }
      break;
    case 'Notification': {
      const t = d.notification_type || '';
      if (s && (t === 'permission_prompt' || t === 'elicitation_dialog' || t === 'idle_prompt')) {
        s.status = 'waiting';
        s.text = t === 'idle_prompt' ? 'Te estoy esperando' : (clip(d.message, 60) || 'Necesito tu permiso');
        addLog('alert', s.chatChar ? chars.get(s.chatChar).name : chars.get(bossId).name, s.text);
        cue('alert', s.chatChar || bossId, s.text);
        if (!s.demo) playAlert();
      }
      break;
    }
    case 'SubagentStart': {
      const id = d.agent_id || ('sub-' + crypto.randomBytes(3).toString('hex'));
      const type = d.agent_type || 'general-purpose';
      const q = pendingDeleg.get(sid) || [];
      const i = q.findIndex((x) => x.type === type);
      const deleg = i >= 0 ? q.splice(i, 1)[0] : null;
      const charId = allocChar(type, s ? s.dept : defaultDept);
      const desc = deleg ? deleg.description : '';
      subs.set(id, { id, type, session: sid, charId, dept: chars.get(charId).dept, status: 'working', text: 'Recibiendo la tarea…', tool: null, desc, last: '', since: now, project: s ? s.project : '' });
      addLog('start', chars.get(charId).name, `${type}${desc ? ': ' + desc : ''}`);
      cue('delegate', charId, desc || type, { type });
      break;
    }
    case 'SubagentStop': {
      const x = d.agent_id ? subs.get(d.agent_id) : null;
      if (x && x.status !== 'done') {
        x.status = 'done'; x.text = '¡Listo!'; x.last = clip(d.last_assistant_message, 400);
        addLog('done', chars.get(x.charId).name, x.last || 'Terminó');
        cue('deliver', x.charId, '', { type: x.type });
        bumpDone();
        setTimeout(() => { subs.delete(x.id); pushState(); }, 14000);
      }
      break;
    }
    default: break;
  }
  pushState();
}

// ---------- limpieza ----------
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [sid, s] of sessions) {
    if (s.status === 'working' && now - s.lastSeen > 150000) { s.status = 'idle'; s.text = ''; changed = true; }
    if (now - s.lastSeen > 45 * 60000 && !chatSessions.has(sid)) { sessions.delete(sid); changed = true; }
  }
  for (const [id, x] of subs) {
    if (x.status === 'working' && now - x.since > 20 * 60000) { subs.delete(id); changed = true; }
  }
  if (changed) pushState();
}, 5000);

// ---------- chat con agentes ----------
function quoteArg(a) { return /[\s"&|<>^()*]/.test(a) ? '"' + String(a).replace(/"/g, '\\"') + '"' : a; }

function startChat(charId, text) {
  const c = chars.get(charId);
  if (!c || !c.chat) return { ok: false, error: 'Este personaje no tiene chat.' };
  let st = chats.get(charId);
  if (!st) { st = { sessionId: crypto.randomUUID(), started: false, busy: false, history: [] }; chats.set(charId, st); }
  if (st.busy) return { ok: false, error: 'Todavía está respondiendo.' };
  st.busy = true;
  st.history.push({ role: 'user', text });
  chatSessions.set(st.sessionId, charId);

  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (c.agentType) args.push('--agent', c.agentType);
  args.push(st.started ? '--resume' : '--session-id', st.sessionId);
  const perm = chatPermissions(charId);
  args.push('--permission-mode', perm.mode);
  if (perm.allow.length) args.push('--allowedTools', ...perm.allow);
  args.push('--disallowedTools', ...perm.deny);

  const cmd = 'claude.cmd ' + args.map(quoteArg).join(' ');
  // entorno limpio: si el servidor se lanzo desde otra sesion de Claude, no heredar su autenticacion/proxy
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(CLAUDE|ANTHROPIC_|AI_AGENT|BAGGAGE)/i.test(k)) env[k] = v;
  env.OFICINA_CHAT = '1';
  let child;
  try {
    child = spawn(cmd, { cwd: c.chat.cwd || process.cwd(), shell: true, windowsHide: true, env });
  } catch (e) {
    st.busy = false; chatSessions.delete(st.sessionId);
    return { ok: false, error: String(e.message || e) };
  }
  addLog('chat', 'Oscar → ' + c.name, text);
  pushState();

  let buf = ''; let errBuf = ''; let finalText = ''; let gotText = false; let denied = [];
  const emitText = (t) => { if (!t) return; gotText = true; finalText += (finalText ? '\n\n' : '') + t; broadcast({ type: 'chat', charId, kind: 'text', text: t }); };
  child.stdout.on('data', (b) => {
    buf += b.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch (_) { continue; }
      if (o.type === 'assistant' && o.message && Array.isArray(o.message.content)) {
        for (const blk of o.message.content) if (blk.type === 'text' && blk.text) emitText(blk.text);
      } else if (o.type === 'result') {
        if (o.is_error && o.result && !gotText) emitText('⚠ ' + o.result);
        if (Array.isArray(o.permission_denials)) denied = o.permission_denials;
      }
    }
  });
  child.stderr.on('data', (b) => { errBuf += b.toString('utf8'); });
  child.on('error', (e) => { errBuf += String(e.message || e); });
  child.on('close', (code) => {
    st.busy = false;
    if (code === 0) st.started = true;
    if (code !== 0 && !gotText) emitText('⚠ No pude responder (código ' + code + '). ' + clip(errBuf, 300));
    if (finalText) st.history.push({ role: 'agent', text: finalText });
    // lo que quiso hacer y no pudo: se le pregunta a Oscar aqui mismo, con un boton
    if (denied.length) {
      const seen = new Set(), items = [], never = [];
      for (const d of denied) {
        const r = ruleFor(d);
        if (seen.has(r.rule)) continue;
        seen.add(r.rule);
        // lo que esta prohibido en todos los niveles no se ofrece aprobar: aprobarlo no serviria de nada
        if (/rm\s+-rf|git\s+push|git\s+reset\s+--hard|^(correr:\s*)?del\s|remove-item/i.test(r.label)) never.push(r); else items.push(r);
      }
      if (never.length) {
        const entry = { role: 'perm', id: crypto.randomBytes(4).toString('hex'), items: never.map((x) => x.label), state: 'never' };
        st.history.push(entry);
        broadcast({ type: 'chat', charId, kind: 'perm', ...entry });
      }
      if (items.length) {
        const id = crypto.randomBytes(4).toString('hex');
        st.pending = { id, rules: items.map((x) => x.rule) };
        const entry = { role: 'perm', id, items: items.map((x) => x.label), state: 'open' };
        st.history.push(entry);
        broadcast({ type: 'chat', charId, kind: 'perm', ...entry });
        addLog('alert', c.name, 'Necesita tu permiso: ' + items[0].label);
        cue('alert', charId, 'Necesito tu permiso', { quiet: true });
        playAlert();
      }
    }
    broadcast({ type: 'chat', charId, kind: 'done' });
    saveChats();
    setTimeout(() => {
      // la sesion de chat se considera inactiva; deja de ocupar al personaje
      const s = sessions.get(st.sessionId);
      if (s) { s.status = 'idle'; s.text = ''; }
      if (!st.busy) chatSessions.delete(st.sessionId);
      pushState();
    }, 2500);
    pushState();
  });
  child.stdin.on('error', () => {});
  child.stdin.end(text);
  return { ok: true };
}

function answerPerm(charId, id, yes) {
  const st = chats.get(charId), c = chars.get(charId);
  if (!st || !c || !st.pending || st.pending.id !== id) return { ok: false, error: 'Ese permiso ya no está pendiente.' };
  const rules = st.pending.rules; st.pending = null;
  const entry = st.history.find((m) => m.role === 'perm' && m.id === id);
  if (entry) entry.state = yes ? 'yes' : 'no';
  broadcast({ type: 'chat', charId, kind: 'permDone', id, state: yes ? 'yes' : 'no' });
  if (!yes) { saveChats(); return { ok: true }; }
  config.allow = config.allow || {};
  config.allow[charId] = [...new Set([...(config.allow[charId] || []), ...rules])];
  saveConfig(); saveChats();
  const text = 'Ya tienes el permiso. Continúa donde ibas.';
  broadcast({ type: 'chat', charId, kind: 'user', text });
  return startChat(charId, text);
}

// ---------- demo (sin gastar nada de Claude) ----------
function runDemo() {
  const F = 'demo-fan', A = 'demo-ask';
  const mk = (sid, cwd, ev, extra) => ({ hook_event_name: ev, session_id: sid, cwd, ...(extra || {}) });
  const f = (ev, x) => mk(F, 'C:\demo\Agencia', ev, x);
  const k = (ev, x) => mk(A, 'C:\demo\estudio\mi-video', ev, x);
  const T = (t, tool, input, id) => ({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, agent_id: id });
  const steps = [
    [0, f('SessionStart')], [200, k('SessionStart')],
    [500, f('UserPromptSubmit', { prompt: 'Revisa los tickets de clientes' })],
    [900, k('UserPromptSubmit', { prompt: 'Busca temas nuevos de IA y arma un guion' })],
    [1800, k('PreToolUse', { tool_name: 'Task', tool_input: { subagent_type: 'investigador-temas', description: 'Buscar 5 temas virales de IA' } })],
    [2100, k('SubagentStart', { agent_id: 'demo-a1', agent_type: 'investigador-temas' })],
    [2500, f('PreToolUse', { tool_name: 'Task', tool_input: { subagent_type: 'auditor-tickets', description: 'Auditar el tablero de tickets' } })],
    [2800, f('SubagentStart', { agent_id: 'demo-f1', agent_type: 'auditor-tickets' })],
    [3200, k('PreToolUse', { tool_name: 'Task', tool_input: { subagent_type: 'Explore', description: 'Revisar la carpeta de videos' } })],
    [3500, k('SubagentStart', { agent_id: 'demo-a2', agent_type: 'Explore' })],
    [6500, k('PreToolUse', { agent_id: 'demo-a1', tool_name: 'WebSearch', tool_input: { query: 'tendencias IA noviembre 2026' } })],
    [7500, f('PreToolUse', { agent_id: 'demo-f1', tool_name: 'mcp__notion__query', tool_input: {} })],
    [9000, k('PreToolUse', { agent_id: 'demo-a2', tool_name: 'Glob', tool_input: { pattern: '**/*.mp4' } })],
    [11000, k('PreToolUse', { agent_id: 'demo-a1', tool_name: 'WebFetch', tool_input: { url: 'https://example.com' } })],
    [13000, k('SubagentStop', { agent_id: 'demo-a2', agent_type: 'Explore', last_assistant_message: 'Encontré 14 videos en la carpeta.' })],
    [15000, f('SubagentStop', { agent_id: 'demo-f1', agent_type: 'auditor-tickets', last_assistant_message: '3 tickets duplicados encontrados.' })],
    [17000, k('SubagentStop', { agent_id: 'demo-a1', agent_type: 'investigador-temas', last_assistant_message: 'Cinco temas: 1) agentes en 3D, 2) skills de Claude...' })],
    [20000, k('PreToolUse', { tool_name: 'Task', tool_input: { subagent_type: 'guionista', description: 'Escribir el guion del tema 1' } })],
    [20300, k('SubagentStart', { agent_id: 'demo-a3', agent_type: 'guionista' })],
    [23000, k('PreToolUse', { agent_id: 'demo-a3', tool_name: 'Write', tool_input: { file_path: 'C:\demo\guion.md' } })],
    [26000, f('Notification', { notification_type: 'permission_prompt', message: 'Necesito permiso para leer el tablero' })],
    [30000, k('SubagentStop', { agent_id: 'demo-a3', agent_type: 'guionista', last_assistant_message: 'Guion listo, 40 segundos.' })],
    [33000, f('Stop')], [34000, k('Stop')],
    [37000, f('SessionEnd')], [37500, k('SessionEnd')],
  ];
  for (const [t, p] of steps) setTimeout(() => handleHook(p), t);
}

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream' };

function readBody(req, max = 2 * 1024 * 1024) {
  return new Promise((resolve) => {
    let b = ''; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > max) { req.destroy(); return; } b += c; });
    req.on('end', () => resolve(b));
    req.on('error', () => resolve(''));
  });
}
function hostOk(req) {
  const h = String(req.headers.host || '');
  return h === `localhost:${PORT}` || h === `127.0.0.1:${PORT}`;
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!hostOk(req)) { res.writeHead(403); return res.end('forbidden'); }

  if (req.method === 'POST' && url.pathname === '/hook') {
    const body = await readBody(req);
    try {
      const d = JSON.parse(body);
      if (process.env.OFICINA_LOG) try { fs.appendFileSync(EVENTS_LOG, JSON.stringify({ t: Date.now(), ...d }).slice(0, 4000) + '\n'); } catch (_) {}
      handleHook(d);
    } catch (_) {}
    return json(res, 200, {});
  }

  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    const history = {};
    for (const [id, st] of chats) history[id] = st.history;
    res.write('data: ' + JSON.stringify({ type: 'hello', roster, history }) + '\n\n');
    res.write('data: ' + JSON.stringify({ type: 'state', ...buildState() }) + '\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    if (req.headers['x-office'] !== '1') { res.writeHead(403); return res.end('forbidden'); }
    const body = await readBody(req);
    let d = {}; try { d = JSON.parse(body || '{}'); } catch (_) {}
    if (url.pathname === '/api/chat') return json(res, 200, startChat(String(d.charId || ''), clip(d.text, 4000)));
    if (url.pathname === '/api/level') {
      const lv = String(d.level || ''); if (!LEVELS.includes(lv)) return json(res, 400, { ok: false });
      config.levels = config.levels || {};
      const ids = d.charId === '*' ? roster.characters.filter((c) => c.chat).map((c) => c.id) : [String(d.charId || '')];
      for (const id of ids) if (chars.get(id) && chars.get(id).chat) { config.levels[id] = lv; if (lv === 'read' && config.allow) delete config.allow[id]; }
      saveConfig(); pushState();
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/approve') return json(res, 200, answerPerm(String(d.charId || ''), String(d.id || ''), !!d.yes));
    if (url.pathname === '/api/demo') { runDemo(); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/sound') { config.sound = !!d.on; saveConfig(); pushState(); return json(res, 200, { ok: true }); }
    return json(res, 404, { error: 'not found' });
  }

  // estaticos
  let p = url.pathname === '/' ? '/index.html' : (url.pathname === '/2d' ? '/2d.html' : decodeURIComponent(url.pathname));
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end('forbidden'); }
  // el navegador guarda los modelos y texturas, y solo pregunta si cambiaron: la oficina carga rapido y nunca queda vieja
  fs.stat(file, (e0, st) => {
    if (e0 || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const stamp = st.mtime.toUTCString();
    if (req.headers['if-modified-since'] === stamp) { res.writeHead(304); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Last-Modified': stamp });
      res.end(data);
    });
  });
});

server.on('error', (e) => { console.log(e.code === 'EADDRINUSE' ? 'La oficina ya está corriendo en http://localhost:' + PORT : String(e)); process.exit(0); });
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Oficina lista en http://localhost:${PORT}`);
});
setInterval(() => { for (const r of clients) { try { r.write(': ping\n\n'); } catch (_) {} } }, 20000);
