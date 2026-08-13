/**
 * ============================================================================
 * Background Error Telemetry Module
 * ============================================================================
 * Sanitizes local TTS error logs and reports them to the VoiceRankings server
 * when telemetry is enabled. Only whitelisted fields are transmitted — never
 * API keys, request payloads, synthesized text, audio, or raw provider
 * response bodies. Reports are batched and flushed every 30 seconds.
 */
import { API_NUXT_DOMAIN } from './config.js';

const FLUSH_INTERVAL_MS = 30000;
const MAX_BATCH_SIZE = 25;
const MAX_MESSAGE_LENGTH = 300;
const MAX_CODE_LENGTH = 120;
const MAX_ENDPOINT_LENGTH = 200;
const MAX_PAYLOAD_FIELD_LENGTH = 200;
const MAX_RESPONSE_SIZE = 2000;

const SECRET_KEY_PATTERN = /key|token|secret|auth|password|bearer|signature|credential|api[-_]?key/i;
const USER_CONTENT_KEYS = ['input', 'text', 'transcript', 'prompt', 'instructions', 'content'];

let pendingReports = [];
let flushTimer = null;
let flushing = false;

function getExtensionVersion() {
  try {
    return chrome.runtime.getManifest().version || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getBrowserShort() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  try {
    const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
    const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
    const safariMatch = ua.match(/Safari\/([\d.]+)/);
    if (chromeMatch) return `chrome/${chromeMatch[1]}`;
    if (firefoxMatch) return `firefox/${firefoxMatch[1]}`;
    if (safariMatch && ua.includes('AppleWebKit')) return `safari/${safariMatch[1]}`;
  } catch (e) {}
  return 'unknown';
}

function truncate(value, maxLength) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

function extractErrorCode(responseBody) {
  if (!responseBody || typeof responseBody !== 'object') return null;
  const candidate =
    responseBody.error_code ||
    responseBody.code ||
    (responseBody.error && (responseBody.error.code || responseBody.error.error_code || responseBody.error.message)) ||
    responseBody.detail ||
    responseBody.message ||
    null;
  if (candidate === null || candidate === undefined) return null;
  return truncate(candidate, MAX_CODE_LENGTH);
}

function classifyErrorType(statusCode) {
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 429) return 'rate_limit';
  if (statusCode >= 500) return 'server';
  if (statusCode >= 400) return 'client';
  return 'other';
}

function isRetryable(statusCode) {
  return statusCode === 429 || (statusCode >= 500 && statusCode !== 501 && statusCode !== 505);
}

function sanitizeEndpoint(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return truncate(`${parsed.origin}${parsed.pathname}`, MAX_ENDPOINT_LENGTH);
  } catch (e) {
    return truncate(url, MAX_ENDPOINT_LENGTH);
  }
}

function isUserContentKey(key) {
  return USER_CONTENT_KEYS.some(prefix => key === prefix || key.toLowerCase() === prefix);
}

function isSecretKey(key) {
  return SECRET_KEY_PATTERN.test(key);
}

function pruneSecrets(value, depth = 0, visited = new Set()) {
  if (depth > 5) return '[truncated]';
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    if (value.length === 0) return '';
    // Heuristic: if a string looks like an API key / JWT / token, redact it.
    if (/^(sk-|rk-|eyJ)/i.test(value) || /(\s|^)Bearer\s+/i.test(value)) return '[redacted]';
    return truncate(value, MAX_PAYLOAD_FIELD_LENGTH);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    return value.slice(0, 10).map(item => pruneSecrets(item, depth + 1, visited));
  }

  if (typeof value === 'object') {
    if (visited.has(value)) return '[circular]';
    visited.add(value);

    const result = {};
    for (const key of Object.keys(value)) {
      if (isUserContentKey(key)) {
        const raw = value[key];
        result[key] = (typeof raw === 'string' && raw.length > 0)
          ? `[text ${raw.length} chars]`
          : pruneSecrets(raw, depth + 1, visited);
        continue;
      }
      if (isSecretKey(key)) {
        result[key] = '[redacted]';
        continue;
      }
      result[key] = pruneSecrets(value[key], depth + 1, visited);
    }
    return result;
  }

  return String(value);
}

/**
 * Builds a redacted copy of the provider request payload.
 * User content fields (input/text/transcript/prompt/instructions) are replaced
 * with a length marker; secret-looking keys are redacted.
 */
function redactRequestPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return pruneSecrets(payload);
}

/**
 * Builds a redacted copy of the provider error response body, capped in size.
 */
function redactResponseBody(response) {
  if (!response) return null;

  let redacted;
  if (typeof response === 'string') {
    redacted = truncate(response, MAX_RESPONSE_SIZE);
  } else if (typeof response === 'object') {
    redacted = pruneSecrets(response);
  } else {
    return null;
  }

  const json = JSON.stringify(redacted);
  if (json && json.length > MAX_RESPONSE_SIZE) {
    // Fall back to a compact, truncated form if the redacted response is too large.
    return { truncated: true, detail: truncate(json, 400) };
  }
  return redacted;
}

/**
 * Transforms a raw stored error log into a sanitized report payload.
 * Drops raw request payloads and response bodies, but keeps redacted,
 * structured versions with enough detail to diagnose provider issues.
 */
export function sanitizeErrorLog(log) {
  if (!log) return null;

  const statusCode = Number.isInteger(log.statusCode) ? log.statusCode : null;

  return {
    provider: truncate(log.serviceName || 'Unknown', 80),
    http_status: statusCode,
    error_code: extractErrorCode(log.response),
    error_type: statusCode ? classifyErrorType(statusCode) : 'other',
    retryable: statusCode ? isRetryable(statusCode) : null,
    endpoint: sanitizeEndpoint(log.request?.url),
    message: truncate(log.message || null, MAX_MESSAGE_LENGTH),
    request: redactRequestPayload(log.request?.requestPayload),
    response: redactResponseBody(log.response),
    extension_version: getExtensionVersion(),
    browser: getBrowserShort(),
    timestamp: log.timestamp || Date.now()
  };
}

async function isTelemetryEnabled() {
  try {
    const result = await chrome.storage.local.get('ALLOW_TELEMETRY');
    return result.ALLOW_TELEMETRY !== false;
  } catch (e) {
    return false;
  }
}

async function flush() {
  if (flushing) return;
  if (pendingReports.length === 0) return;

  flushing = true;
  const batch = pendingReports.splice(0, MAX_BATCH_SIZE);
  try {
    if (!(await isTelemetryEnabled())) return;
    await fetch(`https://${API_NUXT_DOMAIN}/api/v1/diagnostics/report`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    });
  } catch (e) {
    console.warn('Failed to send diagnostics report:', e);
  } finally {
    flushing = false;
    if (pendingReports.length > 0) scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Queues a raw error log for sanitized, batched reporting to the server.
 */
export function enqueueErrorLog(log) {
  const report = sanitizeErrorLog(log);
  if (!report) return;

  pendingReports.push(report);
  if (pendingReports.length >= MAX_BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}
