# Design portfolio foundation

Angular 22 standalone application with lazy pages, strict TypeScript, Tailwind, SCSS, and build-time prerendering. The UI includes an animated staggered navigation menu and sample portfolio content.

## Staggered navigation

`src/app/shared/staggered-menu` adapts the supplied React Bits StaggeredMenu to a standalone Angular component with signal inputs, readonly open state, `menuOpen` / `menuClose` outputs, and GSAP. Configure the portfolio links, layer colors, and brand in `app.ts` / `app.html`. Root-relative menu links use Angular Router and preserve active-page semantics; other URLs use normal anchors. Social links are optional and intentionally unconfigured until real profile URLs are available.

The component accepts `position`, `colors`, `items`, `socialItems`, `displaySocials`, `displayItemNumbering`, `logoUrl`, `logoLabel`, `menuButtonColor`, `openMenuButtonColor`, `accentColor`, `changeMenuColorOnOpen`, `isFixed`, `closeOnClickAway`, `className`, and `panelId` as signal inputs. Use a unique `panelId` when rendering multiple menus. Without a logo image it displays the brand text. A non-fixed instance fills its positioned parent; give that parent a size and `position: relative`.

The fixed portfolio menu locks background scrolling, makes the page content inert while open, cycles keyboard focus, and closes on Escape, navigation, or outside pointer clicks. Closed links are inert. GSAP runs in a browser-only render effect, handles interrupted toggles, respects reduced motion, and cleans up on destruction. Layout uses Tailwind utilities; component SCSS supplies the animation geometry and menu-specific styling.

## Architecture

- `src/app/core/models`: readonly project and image types.
- `src/app/core/services`: synchronous JSON-backed project queries and SSR-safe SEO using Angular Title, Meta, and injected DOCUMENT.
- `src/app/core/config/site.config.json`: shared site name, canonical origin, description, and default social image.
- `src/app/data/projects.json`: single project dataset used by the application, prerender route discovery, and sitemap generator.
- `src/app/features`: Home, About, project list/detail, and Not Found; all lazy route components use OnPush and separate HTML/SCSS files.
- `app.routes.server.ts`: prerenders the routes; `getPrerenderParams()` reads ProjectService and emits every project slug. Unknown slugs have no server fallback.
- `scripts`: static deployment finalization.

Add shared components/directives/pipes under `src/app/shared` when needed; empty placeholder directories are intentionally omitted. Immutable project data uses synchronous queries; project route changes use a signal and computed project lookup. Existing hydration and server bootstrap remain available for build-time rendering and development. No runtime metadata API or Node production server is needed.

## Development and builds

Use a Node version supported by the installed Angular CLI and the package manager declared in package.json. After cloning, run `npm ci`.

```sh
npm start
npm run build
```

The development server runs at http://localhost:4200. `npm run build` runs the production Angular build, then writes sitemap.xml, robots.txt, and 404.html into the browser output. Plain `ng build` prerenders all pages but does not run this final packaging script; follow it with `node scripts/finalize-static.mjs` before deployment. Likewise, the watch command only runs Angular's builder.

## Adding projects

1. Add an entry to `src/app/data/projects.json` matching `Project` in `core/models/project.model.ts`. Give it a unique id and lowercase, hyphen-separated slug (for example `new-project`). Required fields include title, description, category, tags, year, coverImage, images, featured, order, and seo. Subtitle and seo.image are optional.
2. Store image files in `public/images/projects/`. Use root-relative URLs such as `/images/projects/new-project.webp`. Each gallery image has `src` and descriptive `alt` text. Supply images at their intended aspect ratio; update the detail template dimensions if needed.
3. Run `npm run build`. The new URL and sitemap entry are generated automatically. No route list requires editing. Projects sort by ascending order.

The three sample projects are fictional. They share a deliberately plain SVG placeholder, which should be replaced with actual work. Replace the existing favicon in `public/favicon.ico` as well.

## Production domain and SEO

**Before publishing**, replace `https://example.com` in `src/app/core/config/site.config.json` with the production HTTPS origin (no subdirectory), and update the site name, description, and default social image. SEO and the sitemap use this same configuration. Replace placeholder social images with a production-ready raster image. Rebuild after any changes. This setup assumes hosting at the domain root.

Every prerendered page contains its title, description, Open Graph metadata, and canonical URL. Navigation updates one canonical link and resets metadata. Not-found pages carry noindex and are omitted from the sitemap.

## Static hosting and 404s

Deploy only **`dist/portfolio/browser/`**. Serve existing directories through their index.html files, including `/projects/<slug>/index.html`. The output includes `/404/index.html` and a copied `/404.html` for custom error document support.

Configure the host to serve **404.html with HTTP status 404 for missing paths**, including unknown project slugs. Do not rewrite every request to the home page with status 200. Angular's prerender route type does not support a status code, and a wildcard route cannot set an HTTP status on a static host. The explicit `/404` route generates the error document; the client wildcard handles unknown URLs during in-app navigation. Navigating to `/404` itself may return 200 unless the host also configures that path.

For example, an Nginx static host can use:

```nginx
location / {
    try_files $uri $uri/ =404;
}
error_page 404 /404.html;
location = /404.html {
    internal;
}
```

On managed static hosting, select 404.html as the custom error document and preserve status 404. Check a known project URL and an unknown path after deployment. No hosting provider is selected or configured by this repository.

Angular's static output guidance: https://angular.dev/guide/hybrid-rendering

## Dark color system

`src/theme.css` owns the palette and reusable UI patterns. Tailwind v4 runs through `.postcssrc.json`; its CSS entry is listed before `src/styles.scss` in angular.json so Sass does not process Tailwind. Component SCSS remains supported. No JavaScript theme state or theme toggle is needed.

The `@theme static` color tokens expose `bg-background`, `bg-surface`, `bg-surface-hover`, `bg-accent`, `bg-accent-muted`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `border-border`, and other Tailwind color utilities. Opacity modifiers such as `bg-accent/10` work. Utilities are generated when used in files under `src/app`; use complete class names rather than constructing them dynamically. CSS/SCSS can use the same tokens with `var(--color-accent)`.

Use `.button-primary` for the main call to action, `.button-secondary` for supporting actions, `.project-card` with a `.project-title` for linked project surfaces, and `.nav-link` with `aria-current="page"` for navigation. Keep project imagery unfiltered. The theme also styles native controls, text selection, keyboard focus, and hover feedback; reduced-motion preferences disable transitions. Hover styles apply only to hover-capable devices.

The requested `muted` token (`#84776D`) is retained for disabled text and nonessential decoration. It measures only 4.29:1 on background and 3.65:1 on surface, so **use `text-muted-readable` (`#A99A8E`) for small metadata and captions**. This readable variant exceeds 5:1 across the three dark surfaces. Accent text measures 8.64:1 on background and 7.35:1 on surface. Primary buttons use background-colored text on accent (8.64:1), not white text. The subtle `border` token is decorative; `control-border` provides stronger contrast for input and secondary-button boundaries.

`success`, `warning`, `error`, and `focus` tokens support future states. Pair status colors with descriptive text or an icon; pair invalid inputs with a visible associated error message and `aria-invalid="true"`. Navigation uses an underline as well as accent color, and interactive cards underline their titles on hover/focus. Focus outlines are never removed.

Tailwind theme reference: https://tailwindcss.com/docs/theme

## Product anatomy

The homepage's `features/product-anatomy` section loads its Three.js runtime only when it approaches the viewport. Its HTML, readable copy, anatomy description, and original SVG fallback are prerendered. All 19 assemblies are authored procedurally in `three/blood-pressure-monitor.factory.ts`; no external models or textures are fetched.

`product-parts.ts` is the component manifest: assembled/exploded transforms, entry delays, assembly intervals, and hover settings. `ProductAnimation` is the only writer of model transforms. `product-experience.ts` combines the one-time GSAP entry with one ScrollTrigger progress value, which also colors every paragraph word. The final upper housing and final word finish at exactly 1. CSS sticky provides the approximately 200vh scroll sequence without changing page scrolling. `ProductScene` measures each part to frame every intermediate composition, caps pixel ratio, handles context recovery, and disposes GPU resources.

Reduced motion, short viewports, overflowing text layouts, and unavailable WebGL retain a readable static experience. Visual QA should inspect assembled, exploded, midpoint, and completed states on desktop and touch layouts, including scroll restoration and a live reduced-motion preference change.
