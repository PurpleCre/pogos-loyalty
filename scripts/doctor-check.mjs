import { spawnSync } from 'node:child_process';
import { verificationEnvironment } from './verification-env.mjs';
const result = spawnSync(process.execPath, ['node_modules/expo-doctor/build/index.js'], {
  stdio: 'inherit', env: { ...process.env, ...verificationEnvironment },
});
process.exit(result.status ?? 1);
