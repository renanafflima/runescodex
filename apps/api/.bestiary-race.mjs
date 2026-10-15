import http from 'node:http';
import { execFileSync } from 'node:child_process';

function call(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: 3001, method, path, headers },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const email = `bestiary-race-${Date.now()}@example.com`;
const password = 'password1';
const registerBody = JSON.stringify({ email, password });
let registered = null;
for (let attempt = 0; attempt < 6 && registered?.status !== 201; attempt += 1) {
  registered = await call(
    'POST',
    '/auth/register',
    {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(registerBody),
    },
    registerBody,
  );
  if (registered.status === 429) await new Promise((r) => setTimeout(r, 12000));
}
if (registered.status !== 201) throw new Error(`register HTTP ${registered.status}`);

const loginBody = JSON.stringify({ email, password });
const login = await call(
  'POST',
  '/auth/login',
  {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(loginBody),
  },
  loginBody,
);
if (login.status !== 201 || !login.json?.accessToken) {
  throw new Error(`login HTTP ${login.status}`);
}

const list = await call('GET', '/bestiary?page=1&limit=1');
const slug = list.json?.items?.[0]?.slug;
if (!slug) throw new Error('bestiário local sem criatura');

const auth = { authorization: `Bearer ${login.json.accessToken}` };
const patch = (kills) => {
  const body = JSON.stringify({ kills });
  return call(
    'PATCH',
    `/bestiary/${slug}/progress`,
    {
      ...auth,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
    body,
  );
};

const [low, high] = await Promise.all([patch(10), patch(20)]);
const sql = `SELECT count(p.id)::int, coalesce(max(p.kills),0)
FROM "User" u
JOIN "UserBestiaryProgress" p ON p."userId" = u.id
WHERE u.email = '${email}'
GROUP BY u.id;`;
const db = execFileSync(
  'docker',
  [
    'exec',
    'runescodex-postgres',
    'psql',
    '-U',
    'runescodex',
    '-d',
    'runescodex_dev',
    '-t',
    '-A',
    '-c',
    sql,
  ],
  { encoding: 'utf8' },
).trim();
const points = execFileSync(
  'docker',
  [
    'exec',
    'runescodex-postgres',
    'psql',
    '-U',
    'runescodex',
    '-d',
    'runescodex_dev',
    '-t',
    '-A',
    '-c',
    `SELECT coalesce(w.points,0) FROM "User" u LEFT JOIN "RewardWallet" w ON w."userId" = u.id WHERE u.email = '${email}';`,
  ],
  { encoding: 'utf8' },
).trim();

console.log(
  JSON.stringify({
    statuses: [low.status, high.status].sort(),
    kills: [low.json?.kills ?? null, high.json?.kills ?? null].sort(),
    db,
    points,
  }),
);
