import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WebSocketServer, WebSocket } from 'ws';
import pty from 'node-pty';

const execFileAsync = promisify(execFile);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.KERNEL_AGENT_TOKEN;
if (!TOKEN || TOKEN.length < 32) {
  console.error('Set KERNEL_AGENT_TOKEN to a random secret of at least 32 characters.');
  process.exit(1);
}
const PROFILES = {
  small: { memory: '512m', cpus: '0.5' },
  standard: { memory: '1g', cpus: '1' },
  large: { memory: '2g', cpus: '2' }
};
const MANAGED_LABEL = 'kernel.managed';
function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a || '')); const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function authorized(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') && timingSafeEqual(h.slice(7), TOKEN);
}
function requireAuth(req, res, next) {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized. Check the host access token.' });
  next();
}
app.get('/health', (_req, res) => res.json({ service: 'kernel-host-agent', status: 'ok' }));
app.use('/api', requireAuth);

async function docker(args, opts = {}) {
  return await execFileAsync('docker', args, { timeout: 30000, maxBuffer: 1024 * 1024, ...opts });
}
async function listServers() {
  const { stdout } = await docker(['ps', '-a', '--filter', 'label=' + MANAGED_LABEL + '=true', '--format', '{{json .}}']);
  const rows = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  return rows.map(r => ({
    id: r.ID, name: r.Names, state: r.State, image: r.Image,
    memory: 'Docker resource limits', managed: true
  }));
}
app.get('/api/servers', async (_req, res) => {
  try { res.json({ servers: await listServers() }); }
  catch (e) { console.error(e.message); res.status(503).json({ error: 'Cannot reach Docker. Is Docker installed and running?' }); }
});
app.post('/api/servers', async (req, res) => {
  const name = String(req.body?.name || '');
  const profile = PROFILES[req.body?.profile] ? req.body.profile : 'small';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,31}$/.test(name)) return res.status(400).json({ error: 'Invalid server name.' });
  const { memory, cpus } = PROFILES[profile];
  const safeName = 'kernel-' + name.toLowerCase() + '-' + crypto.randomBytes(3).toString('hex');
  try {
    const { stdout } = await docker([
      'run', '-d', '--name', safeName,
      '--label', MANAGED_LABEL + '=true',
      '--label', 'kernel.profile=' + profile,
      '--restart', 'unless-stopped', '--init',
      '--memory', memory, '--cpus', cpus, '--pids-limit', '256',
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
      'debian:bookworm-slim', 'sleep', 'infinity'
    ]);
    const id = stdout.trim();
    res.status(201).json({ server: { id, name: safeName, state: 'running', image: 'debian:bookworm-slim', memory, cpus } });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server creation failed. Check Docker availability, image pull access, and host capacity.' });
  }
});
app.delete('/api/servers/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[a-f0-9]{12,64}$/i.test(id)) return res.status(400).json({ error: 'Invalid server id.' });
  try {
    const { stdout } = await docker(['inspect', '--format', '{{ index .Config.Labels "kernel.managed" }}', id]);
    if (stdout.trim() !== 'true') return res.status(404).json({ error: 'Server not found or not managed by this agent.' });
    await docker(['rm', '-f', id]);
    res.json({ deleted: true, id });
  } catch {
    res.status(404).json({ error: 'Server not found.' });
  }
});
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/terminal') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
wss.on('connection', (ws) => {
  let shell = null; let authed = false;
  const authTimeout = setTimeout(() => { if (!authed) ws.close(4401, 'Authentication required'); }, 5000);
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { ws.close(1008, 'Invalid message'); return; }
    if (!authed) {
      if (msg.type !== 'auth' || !timingSafeEqual(msg.token, TOKEN)) { ws.close(4401, 'Unauthorized'); return; }
      const id = String(msg.serverId || '');
      if (!/^[a-f0-9]{12,64}$/i.test(id)) { ws.close(1008, 'Invalid server id'); return; }
      try {
        const { stdout } = await docker(['inspect', '--format', '{{ index .Config.Labels "kernel.managed" }}|{{.State.Running}}', id]);
        if (stdout.trim() !== 'true|true') { ws.send(JSON.stringify({ type: 'error', error: 'Server is not running or is not managed by this host.' })); ws.close(); return; }
        authed = true; clearTimeout(authTimeout);
        shell = pty.spawn('docker', ['exec', '-it', id, '/bin/bash'], {
          name: 'xterm-256color', cols: 100, rows: 28,
          env: { ...process.env, TERM: 'xterm-256color' }
        });
        shell.onData(data => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'data', data })); });
        shell.onExit(({ exitCode }) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'exit', exitCode })); ws.close(); });
        ws.send(JSON.stringify({ type: 'ready' }));
      } catch (e) { ws.send(JSON.stringify({ type: 'error', error: 'Could not open shell. Ensure node-pty is installed and Docker is running.' })); ws.close(); }
      return;
    }
    if (!shell) return;
    if (msg.type === 'input' && typeof msg.data === 'string' && msg.data.length <= 2048) shell.write(msg.data);
    else if (msg.type === 'resize') {
      const cols = Math.max(20, Math.min(240, Number(msg.cols) || 100));
      const rows = Math.max(5, Math.min(100, Number(msg.rows) || 28));
      shell.resize(cols, rows);
    }
  });
  ws.on('close', () => { clearTimeout(authTimeout); if (shell) { try { shell.kill(); } catch {} } });
});
server.listen(PORT, '0.0.0.0', () => console.log('Kernel host agent listening on :' + PORT));
