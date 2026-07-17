const STATIC_METHODS = new Set(["GET", "HEAD"]);
const CANONICAL_HOST = "masterflowplumbing.us";

function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

export function canonicalRedirect(request, canonicalOrigin) {
  const incoming = new URL(request.url);
  if (incoming.hostname === CANONICAL_HOST) return null;

  const target = new URL(`${trimTrailingSlash(canonicalOrigin)}${incoming.pathname}`);
  target.search = incoming.search;
  return Response.redirect(target.toString(), 301);
}

export function staticOriginUrl(request, staticOrigin) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${trimTrailingSlash(staticOrigin)}${incoming.pathname}`);
  upstream.search = incoming.search;
  return upstream;
}

function upstreamRequest(request, upstreamUrl) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-masterflow-canonical-host", CANONICAL_HOST);
  return new Request(upstreamUrl, {
    method: request.method,
    headers,
    redirect: "manual",
  });
}

function rewriteLocation(value, staticOrigin, canonicalOrigin) {
  if (!value) return value;
  const staticBase = trimTrailingSlash(staticOrigin);
  if (!value.startsWith(staticBase)) return value;
  return `${trimTrailingSlash(canonicalOrigin)}${value.slice(staticBase.length)}`;
}

function downstreamResponse(response, staticOrigin, canonicalOrigin) {
  const headers = new Headers(response.headers);
  headers.delete("content-disposition");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-masterflow-static-origin", "valen-clients-cdn");

  const location = rewriteLocation(headers.get("location"), staticOrigin, canonicalOrigin);
  if (location) headers.set("location", location);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const canonicalOrigin = env.CANONICAL_ORIGIN || "https://masterflowplumbing.us";
    const staticOrigin = env.STATIC_ORIGIN || "https://clients.valen-systems.com/masterflow-plumbing";
    const incoming = new URL(request.url);

    if (incoming.pathname.startsWith("/api/")) {
      return new Response("Masterflow API route is unavailable.", {
        status: 503,
        headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
      });
    }

    const redirect = canonicalRedirect(request, canonicalOrigin);
    if (redirect) return redirect;

    if (!STATIC_METHODS.has(request.method)) {
      return new Response("Method not allowed.", {
        status: 405,
        headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
      });
    }

    const upstreamUrl = staticOriginUrl(request, staticOrigin);
    const response = await fetch(upstreamRequest(request, upstreamUrl), {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 300,
          "301-399": 60,
          "404": 30,
          "500-599": 0,
        },
      },
    });

    return downstreamResponse(response, staticOrigin, canonicalOrigin);
  },
};
