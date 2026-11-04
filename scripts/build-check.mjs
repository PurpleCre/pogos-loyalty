import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { verificationEnvironment } from './verification-env.mjs';
if (process.env.EAS_BUILD || process.env.EAS_BUILD_PROFILE || process.env.POGOS_PUBLISH === '1') throw new Error('Offline verification cannot run as a hosted build.');
function sourcesInMap(map) {
  if (Array.isArray(map.sections)) return map.sections.flatMap(section => sourcesInMap(section.map));
  if (Array.isArray(map.sources)) return map.sources;
  throw new Error('Unrecognised source-map structure.');
}
const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--web')) throw new Error('Only --web is accepted.');
for (const platform of args.length ? ['web'] : ['android', 'ios']) {
  const result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', platform, '--source-maps', '--max-workers', '2', '--output-dir', `dist/${platform}`], {
    stdio: 'inherit', env: { ...process.env, ...verificationEnvironment },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  const directory = `dist/${platform}/_expo/static/js/${platform}`;
  const maps = readdirSync(directory).filter(file => file.endsWith('.map'));
  if (!maps.length) throw new Error(`Missing ${platform} source-map evidence.`);
  for (const file of maps) {
    const sources = sourcesInMap(JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')));
    if (sources.some(source => /\/node_modules\/(?:expo\/node_modules\/zod\/|@expo\/cli\/|deepmerge\/|glob\/|minimatch\/)/.test(source))) {
      throw new Error(`Audited tooling-only dependencies unexpectedly entered the ${platform} bundle.`);
    }
  }
  console.log(`${platform}: audited tooling dependencies are absent from the exported module graph.`);
}
