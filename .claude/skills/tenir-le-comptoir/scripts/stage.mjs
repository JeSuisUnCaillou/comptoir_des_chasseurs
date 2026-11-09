// The counter clerk's browser, kept open between commands, so a week at the
// counter can be played one move at a time: act, look at the screen, decide.
//
//   node stage.mjs open [--phone] [--fresh] [--out DIR]    start it (in the background)
//   node stage.mjs do '<js>'                               act, then take a screenshot
//   node stage.mjs close                                   shut it down
//
// `open` needs a production build (`npm run build`) and a local Postgres. It
// serves this checkout with `next start` against a database of its own,
// STAGE_DATABASE_URL (default: the comptoir_scene database on the local
// Postgres), never the test database. --fresh drops and recreates that
// database, then applies the migrations: a counter that opens for the first
// time, whose first visitor creates the gérant.
//
// `do` runs its code as the body of an async function. In scope: `page`,
// `context`, `as(username)`, `wait(seconds)`, `note(text)`. It prints what the
// code returns, what the app logged to the console since the last command,
// and the path of the screenshot.
//
// Each member plays in a browser profile of their own, in DIR/profiles/<name>,
// kept between stages: closing and opening again is the next day, still
// signed in. `as(name)` switches to that member's window, opening it if needed.

import { createServer, request } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// STAGE_PORT moves a stage to ports of its own, so two can play side by side.
const CONTROL = Number(process.env.STAGE_PORT || 4180);
const SITE = CONTROL - 6;
const TOKEN = join(tmpdir(), `comptoir-stage-${CONTROL}.token`);
const REPO = fileURLToPath(new URL('../../../..', import.meta.url));
const DB = process.env.STAGE_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/comptoir_scene';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const option = (name, fallback) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};

if (cmd === 'open') await open();
else if (cmd === 'do') await send({ code: rest.join(' ') });
else if (cmd === 'close') await send({ close: true });
else {
  console.error('usage: stage.mjs open [--phone] [--fresh] [--out DIR] | do <js> | close');
  process.exit(2);
}

async function open() {
  // The control port is taken first: a second stage stops here, before it
  // launches a browser on a profile the first one holds.
  const server = createServer();
  await new Promise((done) => {
    server.once('error', () => {
      console.error(`A stage is already open on port ${CONTROL}: close it first.`);
      process.exit(1);
    });
    server.listen(CONTROL, '127.0.0.1', done);
  });
  // Only this checkout's shell can drive the stage: the token is in a file
  // only this user reads, and a web page cannot send the header without asking.
  const token = randomBytes(16).toString('hex');
  writeFileSync(TOKEN, token, { mode: 0o600 });

  const { chromium, devices } = await import(join(REPO, 'node_modules/@playwright/test/index.mjs'));
  const out = resolve(option('--out', join(tmpdir(), 'comptoir-stage')));
  if (flag('--fresh')) {
    rmSync(join(out, 'profiles'), { recursive: true, force: true });
    await resetDatabase();
  }
  mkdirSync(join(out, 'shots'), { recursive: true });

  // The stage serves this checkout itself, on a port of its own, so it never
  // plays on a server another clone or the test suite left running.
  if (await reachable(`http://localhost:${SITE}/`)) {
    console.error(`Something already answers on port ${SITE}: stop it first.`);
    process.exit(1);
  }
  const site = spawn('npx', ['next', 'start', '-p', String(SITE)], {
    cwd: REPO,
    env: appEnv(),
    stdio: 'ignore',
    detached: true,
  });
  const stopSite = () => {
    try {
      process.kill(-site.pid);
    } catch { /* already gone */ }
  };
  process.on('exit', stopSite);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(1));
  for (let i = 0; !(await reachable(`http://localhost:${SITE}/`)); i++) {
    if (i > 150) {
      console.error('The app did not start: run `npm run build` first.');
      process.exit(1);
    }
    await sleep(0.2);
  }

  const device = flag('--phone') ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const { defaultBrowserType, ...look } = device;
  const logs = [];
  const windows = new Map();
  let page;

  // One persistent browser per member: their own cookies, their own session.
  async function as(name) {
    if (!windows.has(name)) {
      const context = await chromium.launchPersistentContext(join(out, 'profiles', name), {
        ...look,
        baseURL: `http://localhost:${SITE}`,
      });
      const p = context.pages()[0] || (await context.newPage());
      // A move that cannot be made says so in seconds, as a missing button
      // would to a clerk, rather than hanging for half a minute.
      p.setDefaultTimeout(5000);
      p.on('console', (m) => logs.push(`${name} ${m.type()}: ${m.text()}`));
      p.on('pageerror', (e) => logs.push(`${name} pageerror: ${e.message}`));
      await p.goto('/');
      windows.set(name, { context, page: p });
    }
    page = windows.get(name).page;
    return name;
  }
  await as('gerant');

  const scope = {
    get page() { return page; },
    get context() { return page.context(); },
    as,
    wait: (seconds) => sleep(seconds),
    note: (text) => appendFileSync(join(out, 'log.md'), `- ${new Date().toISOString().slice(11, 19)} ${text}\n`),
  };
  const AsyncFunction = (async () => {}).constructor;
  // Numbering goes on from the last stage on this --out, so the next day's
  // screenshots never overwrite the first day's.
  let shot = readdirSync(join(out, 'shots')).filter((f) => /^\d+\.png$/.test(f)).length;

  server.on('request', async (req, res) => {
    if (req.headers['x-stage-token'] !== token) return void res.writeHead(403).end();
    let body;
    try {
      body = JSON.parse(await text(req));
    } catch {
      return void res.writeHead(400).end('not a command\n');
    }
    if (body.close) {
      // Answered once everything is down, so an `open` right after succeeds.
      for (const w of windows.values()) await w.context.close();
      stopSite();
      while (await reachable(`http://localhost:${SITE}/`)) await sleep(0.2);
      rmSync(TOKEN, { force: true });
      server.close();
      res.end('closed\n');
      return;
    }
    const lines = [];
    try {
      const run = new AsyncFunction('scope', `with (scope) { ${body.code} }`);
      const value = await run(scope);
      if (value !== undefined) lines.push(`=> ${JSON.stringify(value)}`);
    } catch (e) {
      lines.push(`error: ${e.message.split('\n')[0]}`);
    }
    if (logs.length) lines.push(...logs.splice(0).map((l) => `console ${l}`));
    const file = join(out, 'shots', `${String(++shot).padStart(3, '0')}.png`);
    try {
      await page.screenshot({ path: file, fullPage: true });
      lines.push(`screen: ${file}`);
    } catch (e) {
      lines.push(`screen: none (${e.message.split('\n')[0]})`);
    }
    res.end(lines.join('\n') + '\n');
  });
  console.log(`stage open on ${look.viewport.width}px, app on port ${SITE}, database ${new URL(DB).pathname.slice(1)}`);
}

function appEnv() {
  // The app and its migrations reach the stage's database only, whatever
  // Supabase or Vercel variables the shell holds (see lib/db/url.mjs).
  const env = { ...process.env, DATABASE_URL: DB, DATABASE_MIGRATION_URL: DB, NODE_ENV: 'production' };
  for (const name of Object.keys(env)) if (/^(PREVIEW_)?POSTGRES_/.test(name)) delete env[name];
  env.AUTH_SECRET ||= 'stage-secret-stage-secret-stage-secret';
  return env;
}

// Drops and recreates the stage's database, then applies the migrations.
async function resetDatabase() {
  const { default: postgres } = await import(join(REPO, 'node_modules/postgres/src/index.js'));
  const url = new URL(DB);
  const name = url.pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*$/.test(name) || !name.includes('scene')) {
    console.error(`--fresh only drops a database whose name contains "scene", not ${name}.`);
    process.exit(1);
  }
  url.pathname = '/postgres';
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`drop database if exists ${name} with (force)`);
    await sql.unsafe(`create database ${name}`);
  } finally {
    await sql.end();
  }
  const migrate = spawnSync('node', ['scripts/migrate.mjs'], { cwd: REPO, env: appEnv(), stdio: 'inherit' });
  if (migrate.status !== 0) process.exit(1);
}

async function send(body) {
  let token = '';
  try {
    token = readFileSync(TOKEN, 'utf8');
  } catch { /* no stage open: the request below says so */ }
  const req = request({ host: '127.0.0.1', port: CONTROL, method: 'POST', path: '/', headers: { 'x-stage-token': token } });
  req.on('error', () => {
    console.error('The stage is not open: run `stage.mjs open` in the background first.');
    process.exit(1);
  });
  req.end(JSON.stringify(body));
  const res = await new Promise((done) => req.on('response', done));
  process.stdout.write(await text(res));
}

function text(stream) {
  return new Promise((done) => {
    let data = '';
    stream.on('data', (chunk) => (data += chunk));
    stream.on('end', () => done(data));
  });
}

async function reachable(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

function sleep(seconds) {
  return new Promise((done) => setTimeout(done, seconds * 1000));
}
