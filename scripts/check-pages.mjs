import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/portfolio/browser/', root);
const read = path => readFile(new URL(path, output), 'utf8');
const site = JSON.parse(await readFile(new URL('src/app/core/config/site.config.json', root), 'utf8'));
const projects = JSON.parse(await readFile(new URL('src/app/data/projects.json', root), 'utf8'));
const base = new URL(site.baseUrl);
const routes = ['', 'about', 'projects', ...projects.map(project => `projects/${project.slug}`), '404'];

for (const route of routes) {
  const html = await read(route ? `${route}/index.html` : 'index.html');
  assert.ok(html.includes(`<base href="${base.pathname}">`), `${route || '/'}: wrong base href`);
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0];
  assert.ok(canonical?.includes(`href="${new URL(route, base).href}"`), `${route || '/'}: wrong canonical URL`);
  assert.ok(!html.includes('https://example.com'), `${route || '/'}: placeholder URL`);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (!value || value.startsWith('#') || /^(?:[a-z]+:|\/\/)/i.test(value)) continue;
    const url = new URL(value, base);
    assert.ok(url.pathname.startsWith(base.pathname), `${route || '/'}: asset/link escapes deployment path: ${value}`);
    const local = url.pathname.slice(base.pathname.length);
    if (/\.(?:js|css|ico|svg|webp|png|jpe?g|otf|woff2?)$/.test(local)) {
      await access(new URL(local, output));
    }
  }
}

const sitemap = await read('sitemap.xml');
for (const route of routes.filter(route => route !== '404')) {
  assert.ok(sitemap.includes(`<loc>${new URL(route, base).href}</loc>`), `Missing sitemap route: ${route}`);
}
assert.ok(!sitemap.includes('/404'), '404 must not be indexed');
assert.ok((await read('robots.txt')).includes(`${site.baseUrl}sitemap.xml`), 'Wrong sitemap URL in robots.txt');
assert.equal(await read('404.html'), await read('404/index.html'), 'Missing custom 404 page');
assert.ok((await read('404.html')).includes('noindex'), '404 must carry noindex');
console.log(`GitHub Pages output verified: ${routes.length} prerendered pages, local assets, SEO, sitemap, and custom 404.`);
