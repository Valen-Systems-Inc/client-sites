const STATIC_METHODS = new Set(["GET", "HEAD"]);
const CANONICAL_HOST = "masterflowplumbing.us";
const INDEXNOW_KEY_PATH = /^\/[A-Za-z0-9-]{8,128}\.txt$/;

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

export function isSitemapPath(pathname) {
  const segments = String(pathname).split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const relative = segments[0] === "commercial" ? segments.slice(1) : segments;
  if (relative.length === 1) {
    const filename = relative[0];
    return filename === "sitemap.xml"
      || filename === "sitemap_index.xml"
      || filename.endsWith("-sitemap.xml")
      || filename === "sitemap.xsl";
  }
  return relative.length === 2
    && relative[0] === "sitemap-assets"
    && /^[A-Za-z0-9._-]+$/.test(relative[1]);
}

export function originTarget(request, env) {
  const incoming = new URL(request.url);
  const staticOrigin = env.STATIC_ORIGIN || "https://clients.valen-systems.com/masterflow-plumbing";
  const sitemapOrigin = env.SITEMAP_ORIGIN || `${trimTrailingSlash(staticOrigin)}/_control/sitemaps`;
  const indexNowOrigin = env.INDEXNOW_ORIGIN || `${trimTrailingSlash(staticOrigin)}/_control/indexnow`;
  let kind = "site";
  let base = staticOrigin;
  let pathname = incoming.pathname;

  if (isSitemapPath(pathname)) {
    kind = "sitemap";
    base = sitemapOrigin;
  } else if (INDEXNOW_KEY_PATH.test(pathname)) {
    kind = "indexnow-key";
    base = indexNowOrigin;
    pathname = `/${pathname.slice(1)}`;
  }

  const upstream = new URL(`${trimTrailingSlash(base)}${pathname}`);
  upstream.search = incoming.search;
  return { kind, originBase: trimTrailingSlash(base), url: upstream };
}

export function staticOriginUrl(request, staticOrigin, sitemapOrigin, indexNowOrigin) {
  return originTarget(request, {
    STATIC_ORIGIN: staticOrigin,
    SITEMAP_ORIGIN: sitemapOrigin,
    INDEXNOW_ORIGIN: indexNowOrigin,
  }).url;
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

function downstreamResponse(response, upstreamOrigin, canonicalOrigin, kind) {
  const headers = new Headers(response.headers);
  headers.delete("content-disposition");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-masterflow-static-origin", "valen-clients-cdn");
  headers.set("x-masterflow-content-silo", kind);

  const location = rewriteLocation(headers.get("location"), upstreamOrigin, canonicalOrigin);
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

    const target = originTarget(request, env);
    const response = await fetch(upstreamRequest(request, target.url), {
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

    return downstreamResponse(response, target.originBase, canonicalOrigin, target.kind);
  },
};
