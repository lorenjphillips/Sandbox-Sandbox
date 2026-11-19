import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4177);
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.jpg', 'image/jpeg']
]);
const publicFolders = ['assets', 'data'];

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const allowed = file === resolve(root, 'index.html') ||
      publicFolders.some(folder => file.startsWith(resolve(root, folder) + sep));
    if (!allowed || !contentTypes.has(extname(file))) {
      response.writeHead(404).end('Page not found');
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(file)),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Page not found');
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write('Sandbox Sandbox · http://127.0.0.1:' + port + '\n');
});
