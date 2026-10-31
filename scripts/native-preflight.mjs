import { cp, mkdtemp, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verificationEnvironment } from './verification-env.mjs';
// Generate into a fresh temporary copy. Never clean/overwrite a developer's
// native folders and never install pods, contact Supabase or invoke EAS.
const root = resolve('.');
const target = await mkdtemp(join(tmpdir(), 'pogos-native-preflight-'));
for (const item of ['package.json', 'app.config.js', 'config', 'assets', 'app', 'components', 'contexts', 'hooks', 'lib', 'global.css', 'global.d.ts', 'nativewind-env.d.ts', 'babel.config.js', 'metro.config.js', 'tailwind.config.js', 'tailwind.config.ts', 'tsconfig.json']) await cp(join(root, item), join(target, item), { recursive: true });
await symlink(join(root, 'node_modules'), join(target, 'node_modules'), 'dir');
await writeFile(join(target, '.gitignore'), 'node_modules/\n');
const cli = join(root, 'node_modules/expo/bin/cli');
const result = spawnSync(process.execPath, [cli, 'prebuild', '--no-install', '--platform', 'all'], {
  cwd: target, stdio: 'inherit', env: { ...process.env, ...verificationEnvironment },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const android = await readFile(join(target, 'android/app/build.gradle'), 'utf8');
const ios = await readFile(join(target, 'ios/Podfile'), 'utf8');
const manifest = await readFile(join(target, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
if (!manifest.includes('offline-android-map-key')) throw new Error('Android maps plugin did not receive the verification key.');
if (!manifest.includes('@xml/secure_store_backup_rules') || !manifest.includes('@xml/secure_store_data_extraction_rules')) throw new Error('SecureStore Android backup exclusions are missing.');
if (!android.includes('com.pogos.verify') || !ios.includes('use_expo_modules!')) throw new Error('Generated native verification projects did not match the expected setup.');
console.log(`Native projects generated without dependency installation: ${target}`);
