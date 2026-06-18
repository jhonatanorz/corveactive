# CORVE — Storefront Search & Navigation Overhaul — Design

- **Date:** 2026-06-18
- **Status:** Approved (design), pending implementation plan
- **Branch base:** `inventory-costing`
- **Builds on:** `2026-06-17-catalog-taxonomy-browse-design.md`

## Problem

The current storefront browse UX puts search + filters in a sticky toolbar
(`CatalogFilterBar`) under the header, with the menu as a persistent desktop
sidebar / mobile drawer. This wastes vertical space, duplicates controls, renders
empty line sections, and offers no fast product lookup. Requested changes:

1. Hide line sections on the home page when the line has no products.
2. Remove the search bar and filters from the toolbar; keep filters only in the menu.
3. Move the menu trigger into the header, alongside the logo.
4. Add a search icon in the header (next to the cart). Pressing it opens a search
   with an autocomplete that shows matching products *with images*.
5. Add a dedicated search-results page with line + color filters.

## Decisions (resolved during brainstorming)

| Topic | Decision |
| --- | --- |
| Menu on desktop | **Drawer everywhere**, icon-triggered. The persistent desktop sidebar is removed. |
| Menu contents | **Líneas** (nav links) + **Categoría** filter toggles. Color filtering is NOT on home/line pages. |
| Category filtering | **URL-driven** (`?cat=a,b`), multi-select, in place on browse pages. |
| Search UX | **Full-screen overlay** opened from the header search icon. |
| Autocomplete data | **Server-side per keystroke** via a route handler (debounced + cancelable). |
| Search scope | **Name + category** (accent/case-insensitive), done in SQL. |
| `/buscar` filters | **Línea + Color**, multi-select, URL-synced. |

## Architecture overview

A single client wrapper, **`ShopChrome`**, rendered in `(shop)/layout.tsx`, owns the
header, the global menu drawer, and the search overlay, plus their open/close state.
The layout (server component) fetches the small datasets the chrome needs (lines,
categories) and passes them in. Page content renders as `{children}` inside it.

Cross-component communication uses the **URL** as the single source of truth:
- The global menu's category toggles write `?cat=`; the browse pages read it reactively.
- The search overlay navigates to `/buscar?q=…`; the results page reads `q/line/color`.

```
(shop)/layout.tsx  [server: fetch lines, categories]
└─ <CartProvider>
   └─ <ShopChrome lines categories>      [client: menuOpen / searchOpen state]
      ├─ <header> [☰ menu] [logo] … [🔍 search] [🛍 cart]
      ├─ <CatalogSideMenu>   (drawer; lines nav + category toggles → ?cat=)
      ├─ <SearchOverlay>     (full-screen; debounced fetch /api/search → suggestions)
      └─ {children}          (home / linea / buscar / producto / carrito …)
   └─ <Footer>
```

## Components

### `ShopChrome` (new, client) — `src/app/(shop)/ShopChrome.tsx`

- Props: `{ lines: BrowserLine[]; categories: BrowserCategory[]; children: ReactNode }`.
- State: `menuOpen`, `searchOpen` (booleans).
- Renders the header (logo + menu button + search button + `CartPill`), the
  `CatalogSideMenu` drawer, the `SearchOverlay`, and `{children}`.
- Replaces the inline `<header>` currently in `layout.tsx`.

### Header (inside `ShopChrome`)

Layout: left group `[☰ menu button] [Wordmark]`; right group `[🔍 search button] [CartPill]`.
Both buttons are icon buttons (reuse the existing SVG icon style). The menu button
calls `setMenuOpen(true)`; the search button calls `setSearchOpen(true)`.

### `CatalogSideMenu` (modified) — `src/app/(shop)/CatalogSideMenu.tsx`

- Moves from being rendered inside `CatalogBrowser` to being rendered by `ShopChrome`
  (global). Same slide-in drawer markup; **drop the `md:` persistent-sidebar classes** so
  it is a drawer on all breakpoints.
- **Líneas**: `<Link href="/linea/[slug]">` (navigate; close drawer).
- **Categorías**: toggle buttons that drive `?cat=` via the URL (see below). Active
  state is derived from the current `?cat=` value, read with `useSearchParams()`.
- Props change from page-managed callbacks to URL-driven: it no longer takes
  `activeCats` / `onToggleCategory` from a parent page. Instead it reads/writes the URL
  itself (it's a client component) using `useSearchParams`, `usePathname`, `useRouter`.

#### URL-driven category toggling (the key refactor)

- Current category set = `parseList(searchParams.get("cat"))`.
- Toggling category `slug`: compute the next set; build `?cat=<joined>` (omit when empty).
- **Target path:** if `usePathname()` is `/` or starts with `/linea/`, update that path's
  query in place (`router.replace`, `{ scroll: false }`). Otherwise navigate to
  `/?cat=<joined>` (`router.push`). This keeps category filtering meaningful from
  anywhere while preserving per-line filtering on line pages.
- Selecting a **line** link just navigates to `/linea/[slug]` (no `cat` carried).

### `CatalogBrowser` (slimmed) — `src/app/(shop)/CatalogBrowser.tsx`

- **Removed:** the `CatalogFilterBar`, the embedded `CatalogSideMenu`, local `query`/
  `colors` state, `window.history.replaceState` sync, and color/text filtering.
- **Now:** reads `cat` from `useSearchParams()` reactively; filters items by category via
  `matchesFilters(item, { categorySlugs })`.
- **Render:**
  - No category active → marketing sections per line, **skipping lines with zero items**
    (`lines.filter(l => items.some(i => i.lineSlug === l.slug))`). (Requirement #1.)
  - Category active → one flat grid of category-filtered items.
- Props unchanged in shape (`items`, `lines`, `showSections`) minus `categories`
  (categories now live in the global menu, not the page).

### `CatalogFilterBar` — **deleted** (`src/app/(shop)/CatalogFilterBar.tsx`)

All of its responsibilities move to the menu (categories), the header (search), and the
`/buscar` page (color). (Requirement #2.)

### `SearchOverlay` (new, client) — `src/app/(shop)/SearchOverlay.tsx`

- Full-screen panel over a dimmed backdrop; large text input (autofocused).
- On input change: **debounce ~250 ms**, then `fetch('/api/search?q=' + encodeURIComponent(q), { signal })`
  using an **`AbortController`** stored in a ref; aborting the previous request before each
  new fetch so stale responses cannot overwrite newer results.
- Renders suggestions: each row = thumbnail (`FadeImage`/`<img>`), name, `formatMXN(price)`.
  Empty query → no list; query with no matches → "Sin resultados".
- Interactions: click a suggestion → `router.push('/producto/' + id)` and close; submit the
  form / press Enter → `router.push('/buscar?q=' + encodeURIComponent(q))` and close; Esc or
  backdrop click → close. Closing clears the query + results.

### `/api/search` route handler (new) — `src/app/api/search/route.ts`

- `GET`; reads `q` from the query string. Empty/whitespace `q` → `{ items: [] }`.
- Calls `searchSuggestions(q)` and returns `{ items }` as JSON.
- Runs under the anon Supabase client (server) → RLS limits results to active products.

### `/buscar` page (new) — `src/app/(shop)/buscar/page.tsx`

- Server component. Reads `q` from `searchParams`. Loads `searchCatalog(q)` (matched
  products, full `CatalogItem[]`) and `listActiveLines()`.
- Renders `<SearchResults items lines query>` (client).

### `SearchResults` (new, client) — `src/app/(shop)/SearchResults.tsx`

- Reads `line` + `color` facets from `useSearchParams()` (comma lists); seeds state.
- Derives color swatches from the matched items (`aggregateColors(items.flatMap(i => i.colors))`).
- Filters via `matchesFilters(item, { lineSlugs, colorKeys })` (query already applied
  server-side).
- Renders: a heading echoing the query, filter controls (Línea checkboxes/pills built from
  `lines`, Color swatches), a "Limpiar" control, and the product grid (reusing `ProductCard`
  + `productColors`). Empty → "Sin resultados.".
- **URL sync:** mirror `line` + `color` into the URL (`?q=&line=&color=`), shareable. Use
  `router.replace(..., { scroll: false })` so `q` is preserved alongside the facets.

## Data layer

### Repo — `src/lib/repos/catalog.ts`

Shared private helper `matchingProductIds`-style logic (name + category), used by both
search functions, implemented without a fragile cross-table `OR`:
1. `select id from product_categories where name ilike %q%` → `catIds`.
2. Build the products query: active, `deleted_at` null, and `name ilike %q%` **OR**
   `category_id in (catIds)`. Implemented with PostgREST `.or()` using a **sanitized** `q`
   (escape `%`, `_`, and the PostgREST reserved `,` `(` `)` `*` before interpolation) — or,
   to avoid the `.or` string entirely, run two `.ilike` / `.in` selects and merge+dedupe by
   `id` in JS. **Chosen:** the two-query merge (no fragile filter string, no injection
   surface).

- **`searchSuggestions(q: string): Promise<SearchSuggestion[]>`**
  - `SearchSuggestion = { id: string; name: string; price: number; thumbnailUrl: string | null }`.
  - Slim select (`id,name,price,product_images(url,color)`), limit ~8. Thumbnail = the
    default image (`color === null`) else the first image, else null (reuse `pickProductImage`
    or inline). Ordered by `created_at desc`.
- **`searchCatalog(q: string): Promise<CatalogItem[]>`**
  - Reuses `CATALOG_SELECT` + the same name/category match; returns full `CatalogItem[]`
    (no limit) for the results page + its color facet.

Both use the server anon client; RLS already restricts to active products. `q` is trimmed;
empty `q` returns `[]` early.

### Domain — `src/domain/catalog-filter.ts`

- `FilterableItem` gains `lineSlug: string` (already present on `CatalogItem`).
- `CatalogFilters` facets become optional and gain `lineSlugs?: string[]`:
  `{ query?: string; categorySlugs?: string[]; lineSlugs?: string[]; colorKeys?: string[] }`.
- `matchesFilters` checks each facet only when present (empty/undefined = no constraint),
  combining with AND; OR within each facet. Existing call sites updated.

No other domain changes. `aggregateColors` / `normalizeColorKey` / `productColors` reused
as-is.

## Files touched

- `src/app/(shop)/layout.tsx` (fetch lines+categories; render `ShopChrome`)
- `src/app/(shop)/ShopChrome.tsx` (new — header + menu + overlay + state)
- `src/app/(shop)/SearchOverlay.tsx` (new)
- `src/app/(shop)/SearchResults.tsx` (new)
- `src/app/(shop)/buscar/page.tsx` (new)
- `src/app/api/search/route.ts` (new)
- `src/app/(shop)/CatalogSideMenu.tsx` (drawer-only; URL-driven category toggles)
- `src/app/(shop)/CatalogBrowser.tsx` (slim; reads `?cat=`; hides empty lines)
- `src/app/(shop)/CatalogFilterBar.tsx` (delete)
- `src/app/(shop)/page.tsx` (drop `categories` prop to `CatalogBrowser`)
- `src/app/(shop)/linea/[slug]/page.tsx` (drop `categories` prop to `CatalogBrowser`)
- `src/lib/repos/catalog.ts` (`searchSuggestions`, `searchCatalog`, match helper, `SearchSuggestion`)
- `src/domain/catalog-filter.ts` (+ `lineSlug` / `lineSlugs`, optional facets)
- `src/domain/catalog-filter.test.ts` (line-facet cases)

## Testing

- **Unit (Vitest):** extended `matchesFilters` — line facet (OR within, AND across),
  color facet, combined line+color, empty facets = pass-through; back-compat with the
  category-only call shape used by `CatalogBrowser`.
- **Manual:** empty lines hidden on home; menu drawer opens from header on all sizes;
  category toggle filters in place and is shareable via `?cat=`; search overlay autocomplete
  shows image suggestions, cancels stale requests, routes to product on click and to
  `/buscar` on Enter; `/buscar` filters by line + color, URL-synced.

## Out of scope (YAGNI)

- Category filter on `/buscar`; color filter on home/line pages.
- Search history / recent searches / popular searches.
- Fuzzy / typo-tolerant matching, relevance ranking beyond recency.
- Keyboard arrow-key navigation of the suggestion list (click + Enter only).
- Pagination / infinite scroll on `/buscar`.

## Risks

- **URL-driven category filtering** changes browse filtering from local state to
  `router.replace` navigations (one RSC round-trip per toggle). Acceptable for a
  boutique catalog and makes filters shareable; flagged so the reviewer expects it.
- **Search race conditions:** mitigated by debounce + `AbortController`; the handler must
  also guard against an empty/whitespace `q`.
- **`q` sanitization:** the two-query merge avoids building a PostgREST `.or` string, so
  there is no filter-grammar injection surface; `.ilike` patterns still escape `%`/`_`.
- **Layout data cost:** the layout fetches lines+categories on render; these are tiny and
  already loaded elsewhere — negligible.
