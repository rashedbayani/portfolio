import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const output = new URL('dist/portfolio/browser/', root);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const projects = await readJson('src/app/data/projects.json');
const site = await readJson('src/app/core/config/site.config.json');
assert.equal(new Set(projects.map(project => project.slug)).size, projects.length, 'Duplicate slugs');
assert.equal(new Set(projects.map(project => project.id)).size, projects.length, 'Duplicate project IDs');
const pages = [
  { path: '/', title: 'Home' },
  { path: '/about', title: 'About' },
  { path: '/projects', title: 'Projects' },
  ...projects.map(project => ({ path: `/projects/${project.slug}`, title: project.seo.title, project })),
  { path: '/404', title: 'Page not found' },
];
for (const { path, title, project } of pages) {
  const html = await readFile(new URL(path === '/' ? 'index.html' : `${path.slice(1)}/index.html`, output), 'utf8');
  const document = new JSDOM(html).window.document;
  assert.equal(document.title, `${title} | ${site.name}`);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(document.querySelector('link[rel="canonical"]').href, new URL(path, site.baseUrl).href);
  for (const key of ['og:title', 'og:description', 'og:image']) {
    assert.ok(document.querySelector(`meta[property="${key}"]`)?.content, `${path}: ${key}`);
  }
  assert.ok(document.querySelector('meta[name="description"]')?.content);
  if (project) {
    assert.match(project.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(document.querySelector('h1').textContent, project.title);
    assert.ok(document.querySelector('main').textContent.includes(project.description));
    assert.ok(document.querySelector('main').textContent.includes(project.category));
    assert.equal(document.querySelector('meta[name="description"]').content, project.seo.description);
    for (const image of [project.coverImage, ...project.images.map(image => image.src)]) {
      assert.ok(image.startsWith('/images/projects/'));
      await access(new URL(image.slice(1), output));
    }
  }
}
const sitemap = new JSDOM(await readFile(new URL('sitemap.xml', output), 'utf8'), { contentType: 'text/xml' }).window.document;
assert.deepEqual([...sitemap.querySelectorAll('loc')].map(node => node.textContent).sort(), pages.filter(page => page.path !== '/404').map(page => new URL(page.path, site.baseUrl).href).sort());
assert.ok((await readFile(new URL('robots.txt', output), 'utf8')).includes(new URL('/sitemap.xml', site.baseUrl).href));
assert.equal(await readFile(new URL('404.html', output), 'utf8'), await readFile(new URL('404/index.html', output), 'utf8'));
console.log(`Verified ${pages.length} prerendered pages, project images, metadata, sitemap, robots, and 404 artifact.`);
