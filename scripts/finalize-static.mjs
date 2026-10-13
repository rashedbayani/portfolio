import { copyFile, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const site = await readJson('src/app/core/config/site.config.json');
const projects = await readJson('src/app/data/projects.json');
const output = new URL('dist/portfolio/browser/', root);
const escapeXml = value => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
const paths = ['/', '/about', '/projects', ...projects.map(project => `/projects/${project.slug}`)];
const urls = paths.map(path => `  <url><loc>${escapeXml(new URL(path, site.baseUrl).href)}</loc></url>`);
await writeFile(new URL('sitemap.xml', output), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
await writeFile(new URL('robots.txt', output), `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site.baseUrl).href}\n`);
await copyFile(new URL('404/index.html', output), new URL('404.html', output));
console.log(`Static output finalized: ${paths.length} sitemap URLs, robots.txt, and 404.html.`);
