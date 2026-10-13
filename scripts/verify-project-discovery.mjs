// Integration check: restore the original dataset and output even if verification fails.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const dataset = new URL('src/app/data/projects.json', root);
const original = await readFile(dataset, 'utf8');
const run = (...args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${args.join(' ')}`);
};
const buildAndVerify = () => {
  run('node_modules/@angular/cli/bin/ng.js', 'build', '--configuration', 'production');
  run('scripts/finalize-static.mjs');
  run('scripts/verify-static.mjs');
};
try {
  const projects = JSON.parse(original);
  projects.push({ ...projects[0], id: 'discovery-check', slug: 'discovery-check', title: 'Discovery check' });
  await writeFile(dataset, `${JSON.stringify(projects, null, 2)}\n`);
  buildAndVerify();
} finally {
  await writeFile(dataset, original);
  buildAndVerify();
}
console.log('New project discovery verified; original dataset and output restored.');
