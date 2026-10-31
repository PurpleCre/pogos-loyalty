import { spawnSync } from 'node:child_process';
import { verificationEnvironment } from './verification-env.mjs';
const result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'install', '--check'], {
  stdio: 'inherit', env: { ...process.env, ...verificationEnvironment, EXPO_OFFLINE: '1' },
});
process.exit(result.status ?? 1);
