import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID, createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';
import { verifyToken, publicAddress, publicURL, assertController, permissionTier } from './safety.mjs';

const secret = process.env.SESSION_SECRET;
const origin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

if (!secret || secret.length < 32) {
  throw new Error('Configure SESSION_SECRET (32+ characters) and ALLOWED_ORIGIN');
}

let browser = await chromium.launch({ headless: true, chromiumSandbox: true });
browser.on('disconnected', () => console.error('Chromium disconnected; it will be restarted when a session is requested.'));
const sessions = new Map();
const dataDir = process.env.DATA_DIR || './local-browser-data';
await fs.mkdir(dataDir, { recursive: true });

const cipherKey = createHash('sha256').update(secret).digest();
const statePath = (uid) => `${dataDir}/${createHash('sha256').update(uid).digest('hex')}.state`;

async function ensureBrowser() {
  if (browser.isConnected()) return;
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  browser.on('disconnected', () => console.error('Chromium disconnected; it will be restarted when a session is requested.'));
}

async function loadState(uid) {
  try {
    const buffer = await fs.readFile(statePath(uid));
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const cipher = createDecipheriv('aes-256-gcm', cipherKey, iv);
    cipher.setAuthTag(authTag);
    const content = Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]);
    return JSON.parse(content.toString());
  } catch {
    return undefined;
  }
}

async function saveState(session) {
  if (session.private) return;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(await session.context.storageState())), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  await fs.writeFile(statePath(session.user), payload, { mode: 0o600 });
}

function describe(session) {
  return {
    id: session.id,
    tabs: [...session.tabs].map(([id, page]) => ({ id, url: page.url(), title: session.titles.get(id) || 'New tab' })),
    activeTab: session.active,
    mode: session.mode,
    controller: session.controller,
    viewport: session.viewport,
    createdAt: session.createdAt,
    private: session.private,
    activity: session.activity,
    pending: session.pending ? { id: session.pending.id, tier: session.pending.tier, label: session.pending.label, type: session.pending.operation } : null,
  };
}

function event(session, type, data = {}) {
  const payload = { type, time: new Date().toISOString(), ...data };
  if (type === 'activity') {
    session.activity.push(payload);
    session.activity = session.activity.slice(-100);
  }
  for (const ws of session.events) {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload));
  }
}

function log(session, label, detail = '') {
  event(session, 'activity', { label, detail });
}

function active(session) {
  const page = session.tabs.get(session.active);
  if (!page) throw new Error('No active tab');
  return page;
}

async function frameMessage(session) {
  const frame = await active(session).screenshot({ type: 'jpeg', quality: 65 });
  return JSON.stringify({ type: 'frame', data: frame.toString('base64'), width: session.viewport.width, height: session.viewport.height });
}

function attach(session, page) {
  const tabId = randomUUID();
  session.tabs.set(tabId, page);
  session.titles.set(tabId, 'New tab');

  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      session.titles.set(tabId, await page.title().catch(() => ''));
      session.snapshot = null;
      event(session, 'session', { session: describe(session) });
    }
  });

  page.on('load', async () => {
    session.titles.set(tabId, await page.title().catch(() => ''));
    event(session, 'session', { session: describe(session) });
  });

  page.on('close', () => {
    session.tabs.delete(tabId);
    if (session.active === tabId) session.active = session.tabs.keys().next().value || null;
    event(session, 'session', { session: describe(session) });
  });

  page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
  page.on('download', (download) => download.cancel());
  return tabId;
}

async function snapshot(session) {
  const page = active(session);
  const data = await page.evaluate(() => {
    document.querySelectorAll('[data-cybeetle-control]').forEach((element) => element.removeAttribute('data-cybeetle-control'));
    const nonce = crypto.randomUUID();
    const nodes = [...document.querySelectorAll('a[href],button,input,textarea,select,[role=button]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && !['password', 'file', 'hidden'].includes(element.type || '');
      })
      .slice(0, 150);

    return {
      url: location.href,
      title: document.title,
      text: (document.querySelector('main') || document.body).innerText.slice(0, 18000),
      targets: nodes.map((element, index) => {
        const key = `${nonce}-${index}`;
        element.setAttribute('data-cybeetle-control', key);
        return {
          id: index,
          key,
          tag: element.tagName.toLowerCase(),
          label: (element.getAttribute('aria-label') || element.labels?.[0]?.innerText || element.innerText || element.placeholder || element.name || '').trim().slice(0, 120),
          type: element.type || '',
          href: element.tagName === 'A' ? element.href : '',
        };
      }),
    };
  });

  session.snapshot = { ...data, tab: session.active };
  log(session, 'Read page', data.title || data.url);
  return { ...data, targets: data.targets.map(({ key, ...target }) => target) };
}

async function perform(session, operation, body, approved = false) {
  const actor = body.actor === 'agent' ? 'agent' : 'user';
  assertController(session.controller, actor);

  const page = active(session);
  if (actor === 'agent' && session.mode !== 'Agent') throw new Error('Switch to Agent mode first');

  let target = null;
  if (['click', 'type'].includes(operation) && actor === 'agent') {
    target = session.snapshot?.targets.find((item) => item.id === body.target);
    if (!target || session.snapshot.tab !== session.active || session.snapshot.url !== page.url()) {
      throw new Error('Page changed; inspect it again');
    }
    const locatorCount = await page.locator(`[data-cybeetle-control="${target.key}"]`).count();
    if (locatorCount !== 1) throw new Error('Page control changed');
    if (operation === 'type' && (!['input', 'textarea'].includes(target.tag) || ['password', 'file'].includes(target.type))) {
      throw new Error('Credentials and file inputs must be handled manually');
    }

    const tier = permissionTier(operation, target);
    if (tier !== 'auto' && !approved) {
      session.pending = {
        id: randomUUID(),
        tier,
        label: target.label,
        operation,
        body,
      };
      session.controller = 'PAUSED';
      event(session, 'permission', { permission: session.pending });
      log(session, 'Waiting for permission', target.label);
      return { permission: session.pending, session: describe(session) };
    }
  }

  assertController(session.controller, actor);
  session.last = Date.now();

  if (operation === 'navigate') {
    log(session, 'Opening website', body.url);
    await page.goto(publicURL(body.url), { waitUntil: 'domcontentloaded', timeout: 30000 });
  } else if (operation === 'click') {
    if (actor === 'agent') {
      await page.locator(`[data-cybeetle-control="${target.key}"]`).click({ timeout: 10000 });
      log(session, 'Clicked', target.label);
    } else {
      const x = Number(body.x);
      const y = Number(body.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Click coordinates required');
      await page.mouse.click(Math.max(0, Math.min(session.viewport.width, x)), Math.max(0, Math.min(session.viewport.height, y)));
    }
  } else if (operation === 'type') {
    if (typeof body.text !== 'string' || body.text.length > 3000) throw new Error('Invalid text');
    if (actor === 'agent') {
      await page.locator(`[data-cybeetle-control="${target.key}"]`).fill(body.text);
      log(session, 'Entered text', target.label);
    } else {
      await page.keyboard.insertText(body.text);
    }
  } else if (operation === 'scroll') {
    await page.mouse.wheel(Number(body.x) || 0, Math.max(-2000, Math.min(2000, Number(body.y) || 650)));
    if (actor === 'agent') log(session, 'Scrolled page');
  } else if (operation === 'mouse') {
    await page.mouse.move(Number(body.x) || 0, Number(body.y) || 0);
  } else if (operation === 'key') {
    if (typeof body.key !== 'string' || body.key.length > 30) throw new Error('Invalid key');
    await page.keyboard.press(body.key);
  } else if (operation === 'back') {
    await page.goBack({ waitUntil: 'domcontentloaded' });
  } else if (operation === 'forward') {
    await page.goForward({ waitUntil: 'domcontentloaded' });
  } else if (operation === 'refresh') {
    await page.reload({ waitUntil: 'domcontentloaded' });
  } else if (operation === 'resize') {
    const width = Math.max(640, Math.min(1920, Number(body.width) || session.viewport.width));
    const height = Math.max(480, Math.min(1200, Number(body.height) || session.viewport.height));
    await page.setViewportSize({ width, height });
    session.viewport = { width, height };
  } else {
    throw new Error('Unsupported browser action');
  }

  session.snapshot = null;
  event(session, 'session', { session: describe(session) });
  return { session: describe(session), message: `Browser action completed: ${operation}` };
}

async function destroy(session) {
  session.controller = 'PAUSED';
  await saveState(session);
  sessions.delete(session.id);
  await session.context.close();
  for (const ws of [...session.events, ...session.views]) ws.close();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 50000) {
        reject(new Error('Request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const auth = verifyToken(token, secret, 'http');
    const url = new URL(req.url, 'http://worker');
    const path = url.pathname;

    if (path === '/health') {
      res.end(JSON.stringify({ ready: true, engine: 'chromium', protocol: 1 }));
      return;
    }

    if (path === '/browser/session' && req.method === 'POST') {
      const body = await readBody(req);
      if ([...sessions.values()].filter((s) => s.user === auth.sub).length >= 2) {
        throw new Error('Maximum two browser sessions per account');
      }
      if (body.private === false && body.optIn !== true) {
        throw new Error('Persistent sessions require explicit opt-in');
      }

      const viewport = {
        width: Math.max(640, Math.min(1920, Number(body.width) || 1280)),
        height: Math.max(480, Math.min(1200, Number(body.height) || 800)),
      };

      await ensureBrowser();
      const context = await browser.newContext({
        viewport,
        acceptDownloads: false,
        storageState: body.private === false ? await loadState(auth.sub) : undefined,
      });

      await context.route('**/*', async (route) => {
        try {
          const target = new URL(route.request().url());
          if (['data:', 'blob:', 'about:'].includes(target.protocol)) {
            await route.continue();
            return;
          }
          publicURL(target.href);
          const addresses = await lookup(target.hostname, { all: true });
          if (addresses.some((address) => !publicAddress(address.address))) throw new Error('Private network');
          await route.continue();
        } catch {
          await route.abort();
        }
      });

      const session = {
        id: randomUUID(),
        user: auth.sub,
        context,
        tabs: new Map(),
        titles: new Map(),
        active: null,
        private: body.private !== false,
        mode: 'Web',
        controller: 'USER_CONTROLLED',
        viewport,
        createdAt: new Date().toISOString(),
        last: Date.now(),
        activity: [],
        events: new Set(),
        views: new Set(),
        pending: null,
        snapshot: null,
        locked: false,
      };

      sessions.set(session.id, session);
      context.on('page', (page) => {
        if (![...session.tabs.values()].includes(page)) {
          const tabId = attach(session, page);
          session.active ||= tabId;
          log(session, 'Opened new tab');
          event(session, 'session', { session: describe(session) });
        }
      });

      const page = await context.newPage();
      session.active = [...session.tabs].find(([, tab]) => tab === page)?.[0] || attach(session, page);
      res.statusCode = 200;
      res.end(JSON.stringify({ id: session.id, session: describe(session) }));
      return;
    }

    const match = path.match(/^\/browser\/([^/]+)(?:\/(.*))?$/);
    if (!match) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const sessionId = match[1];
    const session = sessions.get(sessionId);
    if (!session || session.user !== auth.sub) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Browser session unavailable' }));
      return;
    }

    session.last = Date.now();
    const tail = match[2] || '';

    if (req.method === 'DELETE' && !tail) {
      await destroy(session);
      res.end(JSON.stringify({ closed: true }));
      return;
    }

    if (req.method === 'GET' && !tail) {
      res.end(JSON.stringify(describe(session)));
      return;
    }

    if (tail === 'control') {
      const body = await readBody(req);
      if (!['USER_CONTROLLED', 'AGENT_CONTROLLED', 'PAUSED'].includes(body.controller)) {
        throw new Error('Invalid controller');
      }
      if (body.controller === 'AGENT_CONTROLLED' && session.pending) throw new Error('Resolve the pending permission first');
      session.controller = body.controller;
      if (body.controller === 'USER_CONTROLLED') session.pending = null;
      event(session, 'control', { controller: session.controller });
      res.end(JSON.stringify({ session: describe(session) }));
      return;
    }

    if (tail === 'mode') {
      const body = await readBody(req);
      if (!['Web', 'AI', 'Agent'].includes(body.mode)) throw new Error('Invalid mode');
      session.mode = body.mode;
      if (body.mode !== 'Agent') session.controller = 'USER_CONTROLLED';
      res.end(JSON.stringify({ session: describe(session) }));
      return;
    }

    if (tail === 'permission') {
      const body = await readBody(req);
      if (!session.pending || session.pending.id !== body.permissionId) throw new Error('Permission expired');

      const pending = session.pending;
      session.pending = null;
      if (body.allow) {
        session.controller = 'AGENT_CONTROLLED';
        const result = await perform(session, pending.operation, pending.body, true);
        res.end(JSON.stringify(result));
        return;
      }

      session.controller = 'PAUSED';
      res.end(JSON.stringify({ rejected: true, session: describe(session) }));
      return;
    }

    if (tail === 'snapshot' && req.method === 'GET') {
      res.end(JSON.stringify({ page: await snapshot(session) }));
      return;
    }

    if (tail === 'tabs' && req.method === 'GET') {
      res.end(JSON.stringify({ tabs: describe(session).tabs }));
      return;
    }

    if (tail === 'tabs' && req.method === 'POST') {
      const body = await readBody(req);
      const page = await session.context.newPage();
      session.active = [...session.tabs].find(([, tab]) => tab === page)?.[0] || attach(session, page);
      if (body.url) await page.goto(publicURL(body.url), { waitUntil: 'domcontentloaded' });
      log(session, 'Opened new tab', body.url || 'New tab');
      res.end(JSON.stringify({ session: describe(session) }));
      return;
    }

    if (tail.startsWith('tabs/') && req.method === 'DELETE') {
      const tabId = decodeURIComponent(tail.split('/').slice(1).join('/'));
      if (session.tabs.size === 1) throw new Error('Keep at least one tab open');
      const page = session.tabs.get(tabId);
      if (!page) throw new Error('Tab not found');
      await page.close();
      res.end(JSON.stringify({ session: describe(session) }));
      return;
    }

    if (tail === 'active' && req.method === 'POST') {
      const body = await readBody(req);
      if (!session.tabs.has(body.tabId)) throw new Error('Tab not found');
      session.active = body.tabId;
      res.end(JSON.stringify({ session: describe(session) }));
      return;
    }

    if (session.locked) {
      res.statusCode = 409;
      throw new Error('Browser action is in progress');
    }

    session.locked = true;
    try {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const opName = tail.split('/')[0];
      if (!['navigate', 'click', 'type', 'scroll', 'back', 'forward', 'refresh', 'key', 'mouse', 'resize'].includes(opName)) {
        throw new Error('Unsupported browser action');
      }
      const result = await perform(session, opName, body || {}, false);
      res.end(JSON.stringify(result));
    } finally {
      session.locked = false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser backend request failed';
    res.statusCode = 500;
    res.end(JSON.stringify({ error: message }));
  }
}

const certPath = process.env.TLS_CERT_PATH || './certs/localhost.crt';
const keyPath = process.env.TLS_KEY_PATH || './certs/localhost.key';
const useTls = existsSync(certPath) && existsSync(keyPath);
const server = useTls
  ? https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, handleRequest)
  : http.createServer(handleRequest);

const streamServer = new WebSocketServer({ noServer: true, maxPayload: 10000 });

server.on('upgrade', (req, socket, head) => {
  try {
    const originValue = req.headers.origin || '';
    if (originValue && originValue !== origin && originValue !== origin.replace(/^https:/, 'http:') && originValue !== origin.replace(/^http:/, 'https:')) {
      socket.destroy();
      return;
    }

    const url = new URL(req.url, 'http://worker');
    const parts = url.pathname.split('/').filter(Boolean);
    const token = url.searchParams.get('token');
    const auth = verifyToken(token, secret, 'stream');
    if (parts[0] !== 'browser') {
      socket.destroy();
      return;
    }
    const sessionId = parts[1];
    const channel = parts[2];
    const session = sessions.get(sessionId);

    if (!session || session.user !== auth.sub || auth.sid !== session.id || !['events', 'view'].includes(channel)) {
      socket.destroy();
      return;
    }

    streamServer.handleUpgrade(req, socket, head, (ws) => {
      const set = channel === 'events' ? session.events : session.views;
      set.add(ws);
      ws.send(JSON.stringify({ type: 'session', session: describe(session) }));
      if (channel === 'view') {
        frameMessage(session).then((frame) => {
          if (ws.readyState === 1 && ws.bufferedAmount < 1000000) ws.send(frame);
        }).catch((error) => console.error('Initial browser frame failed:', error));
      }
      const timeout = setTimeout(() => ws.close(), Math.max(0, auth.exp * 1000 - Date.now()));
      ws.on('close', () => {
        set.delete(ws);
        clearTimeout(timeout);
      });
      ws.on('message', () => ws.close());
    });
  } catch {
    socket.destroy();
  }
});

setInterval(async () => {
  for (const session of sessions.values()) {
    if (Date.now() - session.last > 20 * 60 * 1000) {
      await destroy(session).catch(() => {});
      continue;
    }

    if (!session.views.size || session.framing) continue;
    session.framing = true;
    try {
      const frame = await frameMessage(session);
      for (const ws of session.views) {
        if (ws.readyState === 1 && ws.bufferedAmount < 1000000) {
          ws.send(frame);
        }
      }
    } catch (error) {
      console.error('Browser frame capture failed:', error);
    } finally {
      session.framing = false;
    }
  }
}, 600).unref();

const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0');

process.on('SIGTERM', async () => {
  for (const session of sessions.values()) await destroy(session).catch(() => {});
  await browser.close();
  server.close();
  process.exit();
});

console.log(`Browser worker running on ${useTls ? 'https' : 'http'}://0.0.0.0:${port}`);