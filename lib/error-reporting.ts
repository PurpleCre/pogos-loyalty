import type { ErrorEvent, ReactNativeOptions, StackFrame } from '@sentry/react-native';

type Environment = 'development' | 'staging' | 'production';
type Binding = { origin: string; projectId: string } | null;
export type ReportingBindings = Record<Environment, Binding>;
export interface ReportingInput {
  environment: string;
  enabled?: string;
  dsn?: string;
  version?: string | null;
  updateId?: string | null;
}
interface Metadata { environment: Environment; release: string; dist: string }
type Envelope = [Record<string, unknown>, [Record<string, unknown> & { type: string }, unknown][]];
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const environment = (value: string): value is Environment => ['development', 'staging', 'production'].includes(value);
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10000000;
const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value);
const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'UnhandledRejection']);
const ingestionHost = /^o\d+\.ingest(?:\.[a-z]{2})?\.sentry\.io$/;

/** Public destination identifiers only; this validates isolation, not ownership
 * or provider/retention approval. Errors never repeat submitted identifiers. */
export function validateReportingBindings(input: unknown): asserts input is ReportingBindings {
  const source = record(input), names = ['development', 'staging', 'production'];
  if (Object.keys(source).length !== 3 || !names.every(name => Object.hasOwn(source, name))) throw Error('Invalid error-reporting environment bindings.');
  const seen = new Set<string>();
  for (const name of names) {
    const value = source[name];
    if (value === null) continue;
    const binding = record(value);
    if (Object.keys(binding).length !== 2 || !Object.keys(binding).every(key => ['origin', 'projectId'].includes(key)) || typeof binding.origin !== 'string' || typeof binding.projectId !== 'string' || !/^[1-9]\d{0,23}$/.test(binding.projectId)) throw Error('Invalid error-reporting destination binding.');
    let origin: URL;
    try { origin = new URL(binding.origin); } catch { throw Error('Invalid error-reporting origin.'); }
    if (origin.origin !== binding.origin || origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash || !ingestionHost.test(origin.hostname)) throw Error('Invalid error-reporting origin.');
    if (seen.has(binding.projectId)) throw Error('Error-reporting projects must be isolated between environments.');
    seen.add(binding.projectId);
  }
}

function frame(value: unknown): StackFrame {
  const source = record(value), result: StackFrame = {};
  // Only canonical generated bundle names. Never send filesystem prefixes,
  // arbitrary source names, URLs, routes, source snippets, functions or locals.
  if (typeof source.filename === 'string' && source.filename.length <= 4096) {
    const name = source.filename.replace(/\\/g, '/').split(/[?#]/, 1)[0].split('/').pop();
    if (name && ['index.android.bundle', 'index.ios.bundle', 'index.bundle', 'main.jsbundle', 'app.js', 'app.tsx'].includes(name)) result.filename = name;
  }
  if (numeric(source.lineno)) result.lineno = source.lineno;
  if (numeric(source.colno)) result.colno = source.colno;
  if (typeof source.in_app === 'boolean') result.in_app = source.in_app;
  return result;
}

/** Reconstruct a small error payload. Unknown fields never pass through. */
export function sanitizeTelemetry(input: unknown, metadata?: Metadata): ErrorEvent | null {
  try {
    const source = record(input);
    if (source.type !== undefined && source.type !== 'error') return null;
    const values = record(source.exception).values;
    if (!Array.isArray(values) || !values.length) return null;
    const exceptions = values.slice(0, 3).map(value => {
      const exception = record(value), frames = record(exception.stacktrace).frames;
      const type = typeof exception.type === 'string' && errorTypes.has(exception.type) ? exception.type : 'Error';
      return { type, value: '[message omitted]', ...(Array.isArray(frames) ? { stacktrace: { frames: frames.slice(-40).map(frame) } } : {}) };
    });
    const result: ErrorEvent = { type: undefined, platform: 'javascript', exception: { values: exceptions } };
    if (id(source.event_id)) result.event_id = source.event_id;
    if (typeof source.timestamp === 'number' && Number.isFinite(source.timestamp) && source.timestamp > 0 && source.timestamp < 100000000000) result.timestamp = source.timestamp;
    result.level = source.level === 'fatal' ? 'fatal' : 'error';
    if (metadata) Object.assign(result, metadata, { tags: { telemetry_policy: 'errors-v1' } });
    return result;
  } catch { return null; }
}

export function errorReportingDsn(input: ReportingInput, bindings: ReportingBindings): string | undefined {
  try {
    if (input.enabled !== 'true' || !environment(input.environment) || !input.dsn) return;
    validateReportingBindings(bindings);
    const binding = bindings[input.environment];
    if (!binding) return;
    const url = new URL(input.dsn);
    // SaaS ingestion only for this initial transport. Self-hosted/tunnel
    // deployments need their own reviewed allowlist and acceptance exercise.
    if (url.protocol !== 'https:' || url.port || url.password || url.search || url.hash ||
      !/^[a-f0-9]{32}$/i.test(url.username) || !ingestionHost.test(url.hostname) ||
      !/^\/[1-9]\d*$/.test(url.pathname) || binding.origin !== url.origin || binding.projectId !== url.pathname.slice(1)) return;
    return input.dsn;
  } catch { return; }
}

/** Last JS envelope boundary: attachments/feedback/replay/session/log/span items
 * bypass beforeSend. Remove them, their headers and post-hook enrichments too. */
export function minimizeErrorEnvelope(envelope: Envelope, metadata: Metadata): void {
  try {
    const items: Envelope[1] = [];
    for (const item of envelope[1].slice(0, 20)) {
      if (item[0].type !== 'event') continue;
      const event = sanitizeTelemetry(item[1], metadata);
      if (event) items.push([{ type: 'event' }, event]);
    }
    envelope[0] = { sdk: { settings: { infer_ip: 'never' } } };
    if (items.length === 1 && id(record(items[0][1]).event_id)) envelope[0].event_id = record(items[0][1]).event_id;
    envelope[1] = items;
  } catch {
    envelope[0] = {};
    envelope[1] = [];
  }
}

export function errorReportingOptions(input: ReportingInput, bindings: ReportingBindings): ReactNativeOptions {
  const dsn = errorReportingDsn(input, bindings);
  const metadata: Metadata = {
    environment: environment(input.environment) ? input.environment : 'development',
    release: `pogos@${typeof input.version === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(input.version) ? input.version : 'unknown'}`,
    dist: typeof input.updateId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.updateId) ? input.updateId : 'embedded',
  };
  return {
    dsn, enabled: !!dsn, environment: metadata.environment, release: metadata.release, dist: metadata.dist,
    debug: false, sendDefaultPii: false, sendClientReports: false,
    enableNative: false, enableNativeCrashHandling: false, autoInitializeNativeSdk: false,
    enableNativeNagger: false, enableNdk: false, enableNdkScopeSync: false,
    enableAutoSessionTracking: false, enableLogs: false, enableAutoConsoleLogs: false,
    enableAutoPerformanceTracing: false, enableAppStartTracking: false, enableNativeFramesTracking: false,
    enableUserInteractionTracing: false, enableStallTracking: false, enableCaptureFailedRequests: false,
    attachScreenshot: false, attachViewHierarchy: false,
    replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    // Omit sampling options altogether: even a zero tracing/profile rate can
    // install instrumentation. No network trace propagation in this scope.
    tracePropagationTargets: [], maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null, beforeSendTransaction: () => null, beforeSendLog: () => null,
    beforeSend: (event, hint) => { hint.attachments = []; return dsn ? sanitizeTelemetry(event, metadata) : null; },
    integrations: defaults => [
      ...defaults.filter(integration => ['ReactNativeErrorHandlers', 'BrowserApiErrors', 'GlobalHandlers', 'RewriteFrames', 'DebugMeta', 'Dedupe', 'InboundFilters'].includes(integration.name)),
      { name: 'PogosErrorEnvelope', setup(client) { client.on('beforeEnvelope', envelope => minimizeErrorEnvelope(envelope, metadata)); } },
    ],
  };
}
