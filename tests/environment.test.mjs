import assert from 'node:assert/strict';
import { test } from 'node:test';
import validation from '../config/environment.cjs';
const dev = 'developmentfixture'; const stage = 'stagingfixture'; const prod = 'productionfixture';
const binding = (ref, id, suffix) => ({ supabaseProjectRef: ref, expoOwner: 'fixture', expoProjectId: id,
  androidApplicationId: `com.pogos.fixture.${suffix}`, iosBundleIdentifier: `com.pogos.fixture.${suffix}`, scheme: `pogos-${suffix}` });
const bindings = { development: binding(dev, '11111111-1111-4111-8111-111111111111', 'dev'), staging: binding(stage, '22222222-2222-4222-8222-222222222222', 'stage'), production: binding(prod, '33333333-3333-4333-8333-333333333333', 'prod') };
const jwt = (role = 'anon', ref = dev) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.fixtureSignature`;
const values = (name = 'development', ref = dev) => ({ EXPO_PUBLIC_APP_ENV: name, EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon', ref), ANDROID_MAPS_API_KEY: 'fixtureAndroid', IOS_MAPS_API_KEY: 'fixtureIos' });
test('environment binding accepts matching public development credentials and tags the runtime', () => {
  const result = validation.validatePublicEnvironment(values(), bindings);
  assert.equal(result.name, 'development'); assert.equal(result.supabaseProjectRef, dev);
});
test('staging and production require explicitly approved projects, not development fallbacks', () => {
  for (const name of ['staging', 'production']) {
    assert.throws(() => validation.validatePublicEnvironment(values(name, dev), bindings), /approved environment/);
    assert.throws(() => validation.validatePublicEnvironment(values(name, name === 'staging' ? stage : prod), { ...bindings, [name]: {} }), /approval/);
  }
});
test('privileged, malformed and wrong-project public keys are rejected without echoing credentials', () => {
  for (const key of [jwt('service_role'), 'sb_secret_sensitiveFixture', jwt('authenticated'), jwt('anon', prod), 'badFixtureKey', 'a.b.c']) {
    try { validation.validatePublicEnvironment({ ...values(), EXPO_PUBLIC_SUPABASE_ANON_KEY: key }, bindings); assert.fail('Key was accepted'); }
    catch (error) { assert.ok(!error.message.includes(key)); }
  }
  assert.doesNotThrow(() => validation.validatePublicEnvironment({ ...values(), EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixtureOnlyPublicKey' }, bindings));
});
test('host, scheme and URL injection cannot override the environment binding', () => {
  for (const url of [`http://${dev}.supabase.co`, `https://${dev}.supabase.co.attacker.test`, `https://user:pass@${dev}.supabase.co`, `https://${dev}.supabase.co/rest/v1`, `https://${dev}.supabase.co?key=x`, `https://${dev}.supabase.co:54321`])
    assert.throws(() => validation.validatePublicEnvironment({ ...values(), EXPO_PUBLIC_SUPABASE_URL: url }, bindings));
});
test('profile/environment mismatches and cross-environment project reuse fail closed', () => {
  assert.throws(() => validation.validateBuildBinding({ ...values(), EAS_BUILD_PROFILE: 'production' }, bindings), /do not match/);
  assert.doesNotThrow(() => validation.validateBuildBinding({ ...values(), POGOS_UPDATE_TARGET: 'development' }, bindings));
  // EAS environment values are loaded after the runner's initial validation.
  // They must not redirect a development-channel update to another environment.
  assert.throws(() => validation.validateBuildBinding({ ...values('production', prod), POGOS_UPDATE_TARGET: 'development' }, bindings), /OTA target/);
  assert.throws(() => validation.validateBuildBinding({ ...values('staging', stage), POGOS_UPDATE_TARGET: 'development' }, bindings), /OTA target/);
  assert.throws(() => validation.validateBuildBinding({ ...values('production', prod), POGOS_UPDATE_TARGET: 'production' }, bindings), /OTA target/);
  const same = { ...bindings, staging: { ...bindings.staging, expoProjectId: bindings.development.expoProjectId } };
  assert.throws(() => validation.validateBuildBinding(values('staging', stage), same), /isolated/);
  assert.throws(() => validation.validateBuildBinding(values('production', prod), { ...bindings, staging: { ...bindings.staging, supabaseProjectRef: prod } }), /staging Supabase/);
});
test('release builds require approved identifiers and separate platform maps inputs', () => {
  assert.doesNotThrow(() => validation.validateBuildBinding(values('production', prod), bindings));
  assert.throws(() => validation.validateBuildBinding({ ...values('staging', stage), ANDROID_MAPS_API_KEY: '' }, bindings), /ANDROID_MAPS/);
  assert.throws(() => validation.validateBuildBinding(values('staging', stage), { ...bindings, staging: { ...bindings.staging, scheme: null } }), /approval/);
});
test('offline verification is explicitly local and cannot masquerade as an EAS build', () => {
  const local = { ...values(), POGOS_BUILD_CHECK: '1', EXPO_PUBLIC_SUPABASE_PROJECT_REF: 'local', EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon', 'local') };
  assert.equal(validation.validateBuildBinding(local, bindings).verification, true);
  assert.throws(() => validation.validateBuildBinding({ ...local, EAS_BUILD: 'true' }, bindings), /cannot target/);
  assert.throws(() => validation.validateBuildBinding({ ...local, POGOS_PUBLISH: '1' }, bindings), /cannot target/);
  assert.throws(() => validation.validateBuildBinding({ ...local, POGOS_BUILD_CHECK: '0', POGOS_PUBLISH: '1' }, bindings), /cannot use loopback/);
  assert.throws(() => validation.validateBuildBinding({ ...values(), POGOS_BUILD_CHECK: '1' }, bindings), /cannot target/);
  assert.throws(() => validation.validatePublicEnvironment({ ...local, EXPO_PUBLIC_APP_ENV: 'production' }, bindings));
});
