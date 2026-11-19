// Vice Cover Studio — tiny static server for trying app/ locally.
// Dev convenience only; the entry itself is plain static files.
//
//   node serve.ts            serves app/ at http://localhost:8080
//   node serve.ts --port 8090
//
// Serves only files under app/, with a small MIME table. Anything else
// (a path climbing out of app/, a missing file) gets a plain 404.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(fileURLToPath(new URL('./app', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function portFromArgs() {
  const at = process.argv.indexOf('--port');
  const value = at >= 0 ? Number(process.argv[at + 1]) : 8080;
  return Number.isFinite(value) && value > 0 ? value : 8080;
}

const server = createServer((req, res) => {
  const raw = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const rel = normalize(raw).replace(/^[/\\]+/, '');
  const file = join(appDir, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(appDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const port = portFromArgs();
server.listen(port, () => {
  console.log(`Vice Cover Studio at http://localhost:${port}`);
});
