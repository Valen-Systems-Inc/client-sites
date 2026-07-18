import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    MASTERFLOW_CDN_ASSET_BASE?: string;
    MASTERFLOW_CDN_ENTRY_URL?: string;
    MASTERFLOW_CDN_RELEASE?: string;
  }
}

// Production promotion guard: R2 owns the static payload; this wrapper only boots it.
const CDN_BASE = "https://clients.valen-systems.com/masterflow-plumbing/";
const CDN_RELEASE = "mflow-v.1.0.10";

function cdnUrl(fileName: string, includeRelease = true) {
  const url = new URL(fileName, CDN_BASE);
  if (includeRelease) url.searchParams.set("release", CDN_RELEASE);
  return url.toString();
}

const CDN_ENTRY_URL = cdnUrl("index.html");
const REWRITABLE_URL_ATTRIBUTES = ["href", "poster", "src"];

function isExternalOrSpecialUrl(value: string) {
  return /^(?:[a-z][a-z\d+\-.]*:|#|\/\/)/i.test(value);
}

function resolveCdnAssetUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || isExternalOrSpecialUrl(trimmed)) return value;
  return new URL(trimmed.replace(/^\/+/, ""), CDN_BASE).toString();
}

function rewriteCssUrls(cssText: string) {
  return cssText.replace(/url\((["']?)(?!data:|blob:|https?:|#)([^"')]+)\1\)/gi, (_match, quote, path) => {
    return `url(${quote}${resolveCdnAssetUrl(path)}${quote})`;
  });
}

function installCdnHead(cdnDocument: Document) {
  document.title = cdnDocument.title || "Masterflow Plumbing";
  document.querySelectorAll("[data-masterflow-cdn-head]").forEach((element) => element.remove());

  cdnDocument.head
    .querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel~="icon"], link[rel="apple-touch-icon"], style')
    .forEach((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.dataset.masterflowCdnHead = "true";

      if (clone instanceof HTMLLinkElement) {
        clone.href = resolveCdnAssetUrl(clone.getAttribute("href") || clone.href);
      }

      if (clone instanceof HTMLMetaElement && /image$/i.test(clone.getAttribute("property") || clone.name)) {
        clone.content = resolveCdnAssetUrl(clone.content);
      }

      if (clone instanceof HTMLStyleElement && clone.textContent) {
        clone.textContent = rewriteCssUrls(clone.textContent);
      }

      document.head.appendChild(clone);
    });
}

function rewriteElementUrls(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    REWRITABLE_URL_ATTRIBUTES.forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      if (attribute === "href" && element instanceof HTMLAnchorElement && value.startsWith("/")) return;
      element.setAttribute(attribute, resolveCdnAssetUrl(value));
    });

    const srcset = element.getAttribute("srcset");
    if (srcset) {
      element.setAttribute(
        "srcset",
        srcset
          .split(",")
          .map((candidate) => {
            const [url, descriptor] = candidate.trim().split(/\s+/, 2);
            return [resolveCdnAssetUrl(url), descriptor].filter(Boolean).join(" ");
          })
          .join(", "),
      );
    }

    const style = element.getAttribute("style");
    if (style) element.setAttribute("style", rewriteCssUrls(style));

    if (element.dataset.icon) element.dataset.icon = resolveCdnAssetUrl(element.dataset.icon);
    if (element.dataset.images) {
      element.dataset.images = element.dataset.images
        .split(",")
        .map((imageUrl) => resolveCdnAssetUrl(imageUrl))
        .join(", ");
    }
  });
}

function collectScripts(cdnDocument: Document) {
  return Array.from(cdnDocument.querySelectorAll("script")).map((script) => ({
    attributes: Array.from(script.attributes).map((attribute) => [attribute.name, attribute.value] as const),
    src: script.getAttribute("src"),
    text: script.textContent || "",
  }));
}

function installCdnBody(cdnDocument: Document, rootElement: HTMLElement) {
  const body = cdnDocument.body.cloneNode(true) as HTMLBodyElement;
  body.querySelectorAll("script").forEach((script) => script.remove());
  rewriteElementUrls(body);
  rootElement.replaceChildren(...Array.from(body.childNodes));
}

async function runCdnScripts(scripts: ReturnType<typeof collectScripts>) {
  for (const script of scripts) {
    await new Promise<void>((resolve, reject) => {
      const element = document.createElement("script");
      element.dataset.masterflowCdnScript = "true";

      script.attributes.forEach(([name, value]) => {
        if (name !== "src") element.setAttribute(name, value);
      });

      if (script.src) {
        element.src = resolveCdnAssetUrl(script.src);
        element.onload = () => resolve();
        element.onerror = () => reject(new Error(`Masterflow CDN script failed: ${element.src}`));
      } else {
        element.textContent = script.text;
      }

      document.body.appendChild(element);
      if (!script.src) resolve();
    });
  }
}

async function loadMasterflowCdnDocument() {
  const response = await fetch(CDN_ENTRY_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Masterflow CDN entry failed: ${response.status}`);

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

function MasterflowLandingPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootCdnSite() {
      if (!rootRef.current) return;

      window.MASTERFLOW_CDN_ASSET_BASE = CDN_BASE;
      window.MASTERFLOW_CDN_ENTRY_URL = CDN_ENTRY_URL;
      window.MASTERFLOW_CDN_RELEASE = CDN_RELEASE;

      const cdnDocument = await loadMasterflowCdnDocument();
      if (cancelled || !rootRef.current) return;

      installCdnHead(cdnDocument);
      installCdnBody(cdnDocument, rootRef.current);
      await runCdnScripts(collectScripts(cdnDocument));
    }

    void bootCdnSite().catch((error) => {
      console.error("Masterflow CDN site failed to boot:", error);
      setBootError(error instanceof Error ? error.message : "Masterflow failed to boot.");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="masterflow-cdn-root" ref={rootRef}>
      {bootError ? (
        <main
          style={{
            background: "#1E3A5F",
            color: "#fff",
            display: "grid",
            fontFamily: "system-ui, sans-serif",
            minHeight: "100vh",
            padding: "24px",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <p>Masterflow Plumbing could not start. Please refresh.</p>
        </main>
      ) : null}
    </div>
  );
}

export default MasterflowLandingPage;

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<MasterflowLandingPage />);
}
