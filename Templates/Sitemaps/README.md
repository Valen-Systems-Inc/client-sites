# Valen Systems sitemap template

This is the default human-readable sitemap presentation for client sites whose
canonical hostname is backed by Valen-controlled infrastructure.

## Install

1. Copy `valen-sitemap.xsl` to the site's sitemap output as `sitemap.xsl`.
2. Copy `sitemap-assets/` beside it.
3. Change the `client-name` default near the top of the XSL.
4. Add this processing instruction directly after the XML declaration in every
   sitemap index and URL set:

   ```xml
   <?xml-stylesheet type="text/xsl" href="sitemap.xsl"?>
   ```

5. Publish XML, XSL, logo, font, and the font notice through the client's
   controlled sitemap namespace.

## Required crawler contract

- Sitemap XML uses `application/xml` and the standard
  `http://www.sitemaps.org/schemas/sitemap/0.9` namespace.
- The XSL uses `text/xsl`.
- Every `loc` is a canonical URL on the client hostname.
- Every `lastmod` is a real source-controlled modification date.
- Valen attribution belongs in the browser presentation, never as an unrelated
  URL inside the sitemap inventory.
- Presentation styling must not change which URLs search engines receive.
- The logo and Squarish Sans CT must load from the same canonical sitemap route
  family. Keep the included font notice with every deployment.

## Verification

Run XML and XSL parsing before deployment:

```bash
xmllint --noout sitemap.xml sitemap.xsl
xsltproc sitemap.xsl sitemap.xml > /tmp/sitemap-rendered.html
```

Then verify the canonical responses, not only the storage origin:

```bash
curl -I https://client.example/sitemap.xml
curl -I https://client.example/sitemap.xsl
curl -I https://client.example/sitemap-assets/valen-systems-logo.png
```

The branded presentation and author link are factual attribution. They are not
a promise of PageRank, indexing, or ranking impact.
