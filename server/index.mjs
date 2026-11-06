import { createHash, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const root = fileURLToPath(new URL('../', import.meta.url));
const essayIds = new Set(['official', 'originals'].flatMap((collection) =>
  JSON.parse(readFileSync(resolve(root, `data/${collection}.json`), 'utf8')).map(({ id }) => id),
));
const dbPath = process.env.DB_PATH || resolve(root, 'var/caderno.sqlite');
const production = process.env.NODE_ENV === 'production';
const publicOrigin = process.env.PUBLIC_ORIGIN;
if (production && (!publicOrigin || new URL(publicOrigin).protocol !== 'https:')) {
  throw new Error('Defina PUBLIC_ORIGIN com a origem pública HTTPS.');
}
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });

const db = new DatabaseSync(dbPath, { timeout: 5000 });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
    salt TEXT NOT NULL, password_hash BLOB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
  CREATE TABLE IF NOT EXISTS reading (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    essay_id TEXT NOT NULL, saved INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, essay_id)
  );
`);

const findUser = db.prepare('SELECT * FROM users WHERE name_key = ?');
const insertUser = db.prepare('INSERT INTO users (name, name_key, salt, password_hash) VALUES (?, ?, ?, ?) ON CONFLICT(name_key) DO NOTHING RETURNING id');
const getSession = db.prepare('SELECT users.id, users.name FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires > ?');
const insertSession = db.prepare('INSERT INTO sessions VALUES (?, ?, ?)');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const clearExpired = db.prepare('DELETE FROM sessions WHERE expires <= ?');
const getReading = db.prepare('SELECT essay_id AS id, saved, done FROM reading WHERE user_id = ?');
const putReading = db.prepare(`
  INSERT INTO reading (user_id, essay_id, saved, done) VALUES (?, ?, COALESCE(?, 0), COALESCE(?, 0))
  ON CONFLICT (user_id, essay_id) DO UPDATE SET saved = COALESCE(?, saved), done = COALESCE(?, done)
  RETURNING essay_id AS id, saved, done
`);
const deleteEmptyReading = db.prepare('DELETE FROM reading WHERE user_id = ? AND essay_id = ? AND saved = 0 AND done = 0');
const dummySalt = randomBytes(16).toString('hex');
const dummyHash = randomBytes(64);
const scrypt = promisify(derive);
const sessionLength = 30 * 24 * 60 * 60 * 1000;
const cookieName = production ? '__Host-caderno' : 'caderno';
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: production, path: '/' };
const hash = (value) => createHash('sha256').update(value).digest('hex');

function sessionToken(req) {
  const token = req.headers.cookie?.split('; ').find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return token && /^[\w-]{43}$/.test(token) ? token : null;
}

function openSession(res, user) {
  const now = Date.now();
  clearExpired.run(now);
  const token = randomBytes(32).toString('base64url');
  insertSession.run(hash(token), user.id, now + sessionLength);
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionLength });
  res.json({ user: { name: user.name }, reading: getReading.all(user.id) });
}

function credentials(req) {
  const { name, password } = req.body ?? {};
  return {
    name: typeof name === 'string' ? name.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '',
    password: typeof password === 'string' ? password : '',
  };
}

const app = express();
app.disable('x-powered-by');
if (production) app.set('trust proxy', 'loopback');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-src https://*.gov.br https://gov.br; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  });
  if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ ok: true });
});

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PUT'].includes(req.method)) {
    const origin = req.get('origin');
    const expected = publicOrigin || `${req.protocol}://${req.get('host')}`;
    const viteOrigin = !production && /^http:\/\/(?:127\.0\.0\.1|localhost):517[3-9]$/.test(origin ?? '');
    if (origin && origin !== expected && !viteOrigin) return res.status(403).json({ error: 'Origem inválida.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Envie os dados como JSON.' });
  }
  next();
}, express.json({ limit: '4kb' }), (req, _res, next) => {
  const token = sessionToken(req);
  req.user = token ? getSession.get(hash(token), Date.now()) : undefined;
  next();
});

const authLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
});

app.get('/api/session', (req, res) => {
  res.json(req.user ? { user: { name: req.user.name }, reading: getReading.all(req.user.id) } : { user: null, reading: [] });
});

app.post('/api/register', authLimit, async (req, res) => {
  const { name, password } = credentials(req);
  if (name.length < 2 || name.length > 40 || !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._'-]*$/u.test(name)) {
    return res.status(400).json({ error: 'Use um nome de 2 a 40 caracteres com letras ou números.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Escolha uma senha entre 8 e 128 caracteres.' });
  }
  const salt = randomBytes(16).toString('hex');
  const passwordHash = await scrypt(password, salt, 64);
  const created = insertUser.get(name, name.toLocaleLowerCase('pt-BR'), salt, passwordHash);
  if (!created) return res.status(409).json({ error: 'Esse nome já está em uso.' });
  const token = sessionToken(req);
  if (token) deleteSession.run(hash(token));
  openSession(res.status(201), { id: created.id, name });
});

app.post('/api/login', authLimit, async (req, res) => {
  const { name, password } = credentials(req);
  const user = name.length <= 40 ? findUser.get(name.toLocaleLowerCase('pt-BR')) : undefined;
  const attemptedHash = await scrypt(password.slice(0, 128), user?.salt ?? dummySalt, 64);
  const matches = timingSafeEqual(attemptedHash, user?.password_hash ?? dummyHash);
  if (!user || password.length > 128 || !matches) return res.status(401).json({ error: 'Nome ou senha incorretos.' });
  const token = sessionToken(req);
  if (token) deleteSession.run(hash(token));
  openSession(res, user);
});

app.post('/api/logout', (req, res) => {
  const token = sessionToken(req);
  if (token) deleteSession.run(hash(token));
  res.clearCookie(cookieName, cookieOptions).json({ user: null, reading: [] });
});

app.put('/api/reading/:id', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Entre para guardar suas leituras.' });
  const { id } = req.params;
  const { saved, done } = req.body ?? {};
  if (!essayIds.has(id)
      || (saved === undefined && done === undefined)
      || [saved, done].some((value) => value !== undefined && typeof value !== 'boolean')) {
    return res.status(400).json({ error: 'Leitura inválida.' });
  }
  const saveValue = saved === undefined ? null : Number(saved);
  const doneValue = done === undefined ? null : Number(done);
  const reading = putReading.get(req.user.id, id, saveValue, doneValue, saveValue, doneValue);
  if (!reading.saved && !reading.done) deleteEmptyReading.run(req.user.id, id);
  res.json(reading);
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endereço inválido.' }));
const dist = resolve(root, 'dist');
app.use('/assets', express.static(resolve(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
app.use(express.static(dist, { index: false }));
app.get(['/', '/biblioteca', '/temas', '/temas/:slug', '/guia', '/salvos', '/redacoes/:id'], (_req, res) => {
  if (!existsSync(resolve(dist, 'index.html'))) return res.status(503).send('Execute npm run build para abrir o site.');
  res.set('Cache-Control', 'no-cache').sendFile(resolve(dist, 'index.html'));
});

app.use((error, _req, res, _next) => {
  if (error.status === 404) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  if (error.status === 400 || error.status === 413) return res.status(error.status).json({ error: 'Dados inválidos.' });
  console.error(error);
  res.status(500).json({ error: 'Ocorreu um erro. Tente novamente.' });
});

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3764);
app.listen(port, host, () => console.log(`Caderno disponível em http://${host}:${port}`));
