# G-Rump Marketing Site

Static marketing and landing pages for [G-Rump](https://g-rump.com).

## File Structure

```
marketing-site/
├── index.html      # Main landing page
├── docs.html       # Documentation hub
├── styles.css      # Shared styles
├── robots.txt      # SEO crawler directives
├── sitemap.xml     # XML sitemap for search engines
└── README.md       # This file
```

## Local Development

Preview the site locally with any static file server:

```bash
# Using Python (built-in)
cd marketing-site && python -m http.server 8080

# Using npx
npx serve marketing-site

# Using VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then open [http://localhost:8080](http://localhost:8080).

## Deployment

The marketing site is a static site deployed to **Vercel** via the root `vercel.json` configuration. Any push to the `main` branch triggers an automatic deployment via the [Vercel Deploy](./../.github/workflows/vercel-deploy.yml) workflow.

To deploy manually:

```bash
npx vercel --prod --cwd marketing-site
```

## SEO

- `robots.txt` allows all crawlers and points to `sitemap.xml`
- `sitemap.xml` includes all public pages with `lastmod` dates
- Both `index.html` and `docs.html` include proper `<meta>` tags for title, description, and Open Graph

## Adding New Pages

1. Create a new `.html` file in this directory
2. Link the shared `styles.css`
3. Add the page URL to `sitemap.xml`
4. Update navigation links in existing pages
