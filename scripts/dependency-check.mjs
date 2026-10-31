import { spawnSync } from 'node:child_process';
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ls', '--all', '--json'], {
  encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
});
let tree;
try { tree = JSON.parse(result.stdout); } catch {
  console.error('Unable to inspect the installed dependency graph.'); process.exit(1);
}
if (result.status !== 0 || tree.problems?.length) {
  console.error((tree.problems ?? ['Dependency inspection failed.']).join('\n'));
  process.exit(1);
}
console.log('Installed dependency graph has no missing or invalid peers.');
