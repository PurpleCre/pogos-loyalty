import 'dotenv/config';
import validation from '../config/environment.cjs';
import bindings from '../config/environments.json' with { type: 'json' };
const target = validation.validateBuildBinding(process.env, bindings);
console.log(JSON.stringify({ environment: target.name, supabaseProjectRef: target.supabaseProjectRef,
  expoProjectId: target.expoProjectId ?? null, offlineVerification: target.verification }));
