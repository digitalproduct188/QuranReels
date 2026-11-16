/**
 * Ayat — CORS proxy (Netlify Function)
 *
 * The Quran audio CDN (cdn.islamic.network) does not send CORS headers, so the
 * studio cannot fetch + decode its MP3s in the browser. This function fetches
 * the audio server-side and re-serves it with permissive CORS headers.
 *
 * Allowed upstreams are strictly whitelisted to avoid becoming an open proxy.
 * Response size is capped well below the Netlify function limit (6 MB).
 */

const ALLOWED_EXACT = new Set([
  "api.alquran.cloud",
  "cdn.islamic.network",
  "everyayah.com",
  "api.pexels.com",
  "images.pexels.com",
  "static.pexels.com",
]);

const ALLOWED_SUFFIX = [".pexels.com", ".islamic.network", ".alquran.cloud", ".everyayah.com"];

const MAX_BYTES = 5_500_000;
const TIMEOUT_MS = 12_000;

function corsHeaders(extra) {
  return Object.assign(
    {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    },
    extra || {}
  );
}

function isAllowed(hostname) {
  if (!hostname) return false;
  if (ALLOWED_EXACT.has(hostname)) return true;
  return ALLOWED_SUFFIX.some((s) => hostname.endsWith(s));
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD") {
    return { statusCode: 405, headers: corsHeaders(), body: "method not allowed" };
  }

  const params = event.queryStringParameters || {};
  const raw = params.url;
  if (!raw) {
    return { statusCode: 400, headers: corsHeaders(), body: "missing url" };
  }

  let target;
  try {
    target = new URL(raw);
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders(), body: "bad url" };
  }

  if (target.protocol !== "https:" || !isAllowed(target.hostname)) {
    return { statusCode: 403, headers: corsHeaders(), body: "host not allowed" };
  }

  const upstreamHeaders = { Accept: "*/*" };
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || null;
  if (auth && target.hostname.endsWith("pexels.com")) upstreamHeaders.Authorization = auth;
  const range = event.headers && (event.headers.range || event.headers.Range);
  if (range) upstreamHeaders.Range = range;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      headers: upstreamHeaders,
      signal: controller.signal,
      redirect: "follow",
    });

    const declared = parseInt(upstream.headers.get("content-length") || "0", 10);
    if (declared && declared > MAX_BYTES) {
      return {
        statusCode: 413,
        headers: corsHeaders(),
        body: "response too large to proxy",
      };
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return {
        statusCode: 413,
        headers: corsHeaders(),
        body: "response too large to proxy",
      };
    }

    const headers = corsHeaders({
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    });
    const len = upstream.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    const cr = upstream.headers.get("content-range");
    if (cr) headers["Content-Range"] = cr;
    const ar = upstream.headers.get("accept-ranges");
    if (ar) headers["Accept-Ranges"] = ar;

    return {
      statusCode: upstream.status,
      headers,
      body: event.httpMethod === "HEAD" ? "" : buffer.toString("base64"),
      isBase64Encoded: event.httpMethod !== "HEAD",
    };
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    return {
      statusCode: aborted ? 504 : 502,
      headers: corsHeaders(),
      body: aborted ? "upstream timeout" : "upstream error: " + String(err && err.message ? err.message : err),
    };
  } finally {
    clearTimeout(timer);
  }
};
