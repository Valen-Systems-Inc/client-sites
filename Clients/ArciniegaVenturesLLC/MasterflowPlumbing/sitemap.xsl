<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" type="image/png" href="sitemap-assets/valen-systems-logo.png"/>
        <title>Masterflow Plumbing Sitemap | Valen Systems</title>
        <style>
          @font-face {
            font-family: "Squarish Sans";
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: url("sitemap-assets/squarish-sans-ct-regular.woff2") format("woff2");
          }
          :root {
            --black: #050608;
            --white: #ffffff;
            --page: #f5f8ff;
            --peach: #fff0ec;
            --mint: #e7fbf9;
            --blue: #2b71eb;
            --teal: #11c5b5;
            --ink: #0d2247;
            --muted: #48618c;
            --line: #c5daff;
          }
          * { box-sizing: border-box; }
          body {
            background: var(--page);
            color: var(--ink);
            font-family: "Squarish Sans", "Arial Narrow", Arial, sans-serif;
            letter-spacing: 0;
            margin: 0;
            min-height: 100vh;
          }
          a { color: inherit; }
          .shell { margin: 0 auto; max-width: 1180px; padding: 28px 20px 56px; }
          .brand-panel {
            align-items: center;
            background: var(--black);
            color: var(--white);
            display: flex;
            gap: 22px;
            justify-content: space-between;
            min-height: 148px;
            padding: 22px 26px;
          }
          .brand-lockup { align-items: center; display: flex; gap: 18px; min-width: 0; }
          .logo-frame {
            align-items: center;
            background: var(--white);
            display: flex;
            flex: 0 0 154px;
            height: 92px;
            justify-content: center;
            overflow: hidden;
          }
          .logo-frame img { display: block; height: 130px; object-fit: contain; width: 154px; }
          .brand-copy { min-width: 0; }
          .brand-copy strong { display: block; font-size: 1.3rem; font-weight: 400; }
          .brand-copy span { color: rgba(255,255,255,.66); display: block; margin-top: 7px; }
          .maintainer-link {
            border: 1px solid rgba(255,255,255,.34);
            color: var(--white);
            padding: 11px 14px;
            text-decoration: none;
            white-space: nowrap;
          }
          .maintainer-link:hover { background: var(--white); color: var(--black); }
          .intro {
            background: var(--white);
            border: 1px solid var(--line);
            border-top: 4px solid var(--blue);
            display: grid;
            gap: 24px;
            grid-template-columns: minmax(0, 1fr) auto;
            padding: 30px 28px;
          }
          .eyebrow { color: var(--blue); display: block; font-size: .84rem; margin-bottom: 10px; text-transform: uppercase; }
          h1 { color: var(--black); font-size: clamp(2rem, 5vw, 4rem); font-weight: 400; line-height: 1; margin: 0; }
          .intro p { color: var(--muted); line-height: 1.6; margin: 14px 0 0; max-width: 760px; }
          .count {
            align-self: stretch;
            background: var(--mint);
            border-left: 5px solid var(--teal);
            display: grid;
            min-width: 170px;
            padding: 18px;
            place-content: center;
          }
          .count strong { color: var(--black); font-size: 2.2rem; font-weight: 400; }
          .count span { color: var(--muted); font-size: .82rem; margin-top: 4px; text-transform: uppercase; }
          .table-wrap { background: var(--white); border: 1px solid var(--line); margin-top: 18px; overflow-x: auto; }
          table { border-collapse: collapse; min-width: 700px; width: 100%; }
          th {
            background: var(--peach);
            border-bottom: 1px solid var(--line);
            color: var(--black);
            font-size: .82rem;
            font-weight: 400;
            padding: 14px 18px;
            text-align: left;
            text-transform: uppercase;
          }
          td { border-bottom: 1px solid #deeaff; padding: 15px 18px; vertical-align: top; }
          tbody tr:last-child td { border-bottom: 0; }
          tbody tr:hover { background: #fbfcff; }
          .row-number { color: var(--muted); width: 72px; }
          .url a { color: #174fbb; overflow-wrap: anywhere; text-decoration-thickness: 1px; text-underline-offset: 3px; }
          .url a:hover { color: var(--black); }
          .lastmod { color: var(--muted); white-space: nowrap; }
          footer {
            align-items: center;
            border-top: 1px solid var(--line);
            color: var(--muted);
            display: flex;
            gap: 14px;
            justify-content: space-between;
            margin-top: 24px;
            padding: 20px 2px 0;
          }
          footer a { color: var(--black); font-weight: 400; }
          @media (max-width: 720px) {
            .shell { padding: 0 0 38px; }
            .brand-panel { align-items: flex-start; flex-direction: column; min-height: 0; }
            .brand-lockup { align-items: flex-start; flex-direction: column; }
            .logo-frame { flex-basis: auto; }
            .maintainer-link { white-space: normal; }
            .intro { grid-template-columns: 1fr; padding: 24px 20px; }
            .count { min-width: 0; place-content: start; }
            .table-wrap { border-left: 0; border-right: 0; }
            footer { align-items: flex-start; flex-direction: column; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <header class="brand-panel">
            <div class="brand-lockup">
              <div class="logo-frame">
                <img src="sitemap-assets/valen-systems-logo.png" alt="Valen Systems logo" width="154" height="92"/>
              </div>
              <div class="brand-copy">
                <strong>Valen Systems</strong>
                <span>Client search infrastructure</span>
              </div>
            </div>
            <a class="maintainer-link" href="https://www.valen-systems.com/" rel="author noopener">Visit valen-systems.com</a>
          </header>

          <section class="intro">
            <div>
              <span class="eyebrow">Masterflow Plumbing</span>
              <h1>
                <xsl:choose>
                  <xsl:when test="sm:sitemapindex">Sitemap index</xsl:when>
                  <xsl:otherwise>Published URLs</xsl:otherwise>
                </xsl:choose>
              </h1>
              <p>
                <xsl:choose>
                  <xsl:when test="sm:sitemapindex">This index groups Masterflow pages by content type so search engines and site operators can inspect the published structure.</xsl:when>
                  <xsl:otherwise>This sitemap lists canonical Masterflow URLs and their latest source-controlled modification date.</xsl:otherwise>
                </xsl:choose>
              </p>
            </div>
            <div class="count">
              <strong>
                <xsl:choose>
                  <xsl:when test="sm:sitemapindex"><xsl:value-of select="count(sm:sitemapindex/sm:sitemap)"/></xsl:when>
                  <xsl:otherwise><xsl:value-of select="count(sm:urlset/sm:url)"/></xsl:otherwise>
                </xsl:choose>
              </strong>
              <span>
                <xsl:choose>
                  <xsl:when test="sm:sitemapindex">Sitemap families</xsl:when>
                  <xsl:otherwise>Canonical URLs</xsl:otherwise>
                </xsl:choose>
              </span>
            </div>
          </section>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">
                    <xsl:choose>
                      <xsl:when test="sm:sitemapindex">Sitemap</xsl:when>
                      <xsl:otherwise>URL</xsl:otherwise>
                    </xsl:choose>
                  </th>
                  <th scope="col">Last modified</th>
                </tr>
              </thead>
              <tbody>
                <xsl:choose>
                  <xsl:when test="sm:sitemapindex">
                    <xsl:for-each select="sm:sitemapindex/sm:sitemap">
                      <tr>
                        <td class="row-number"><xsl:value-of select="position()"/></td>
                        <td class="url"><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                        <td class="lastmod"><xsl:value-of select="sm:lastmod"/></td>
                      </tr>
                    </xsl:for-each>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:for-each select="sm:urlset/sm:url">
                      <tr>
                        <td class="row-number"><xsl:value-of select="position()"/></td>
                        <td class="url"><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                        <td class="lastmod"><xsl:value-of select="sm:lastmod"/></td>
                      </tr>
                    </xsl:for-each>
                  </xsl:otherwise>
                </xsl:choose>
              </tbody>
            </table>
          </div>

          <footer>
            <span>Masterflow Plumbing sitemap presentation</span>
            <span>Search infrastructure by <a href="https://www.valen-systems.com/" rel="author noopener">Valen Systems</a></span>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
