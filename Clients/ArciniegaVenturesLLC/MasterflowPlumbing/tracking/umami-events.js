// Loaded by production/indexable pages only after the Umami site exists and
// UMAMI_PUBLIC_SCRIPT_URL points at a browser-reachable analytics route.
(function () {
  function setEventData(element, name, data) {
    element.setAttribute("data-umami-event", name);
    Object.entries(data || {}).forEach(function ([key, value]) {
      if (value === undefined || value === null || value === "") return;
      element.setAttribute("data-umami-event-" + key, String(value));
    });
  }

  function pageData(extra) {
    return Object.assign(
      {
        path: window.location.pathname,
        title: document.title,
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
      },
      extra || {},
    );
  }

  function track(name, data) {
    if (typeof window.umami?.track === "function") window.umami.track(name, data);
  }

  function wireClickEvents(root) {
    root.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
      setEventData(link, "phone_click", pageData({ href: link.getAttribute("href"), label: link.textContent.trim() }));
    });
    root.querySelectorAll('a[href^="mailto:"]').forEach(function (link) {
      setEventData(link, "email_click", pageData({ href: link.getAttribute("href"), label: link.textContent.trim() }));
    });
  }

  wireClickEvents(document);

  document.addEventListener("click", function (event) {
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (href.startsWith("tel:") || href.startsWith("mailto:")) wireClickEvents(document);
    if (href.startsWith("tel:")) track("phone_click", pageData({ href, label: link.textContent.trim() }));
    if (href.startsWith("mailto:")) track("email_click", pageData({ href, label: link.textContent.trim() }));
  });

  document.addEventListener("submit", function (event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    track(
      "form_submit",
      pageData({
        formId: form.id || "",
        formName: form.getAttribute("name") || "",
        action: form.getAttribute("action") || "",
      }),
    );
  });
})();
