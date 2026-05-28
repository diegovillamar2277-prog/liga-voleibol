# Design Document: react-migration

## Overview

This migration replaces the Liga Voleibol vanilla-JS SPA with a React + Vite application. The current app is a hand-rolled SPA that uses imperative DOM manipulation, module-level mutable state, and `window` globals as workarounds for a browser module-freezing bug in Edge. The React migration eliminates all of those workarounds by moving state into React context and component state, and routing into React Router v6.

**What stays the same:**
- Supabase backend, database schema, and RLS policies — untouched
- `styles.css` — imported globally, all class names preserved
- `src/lib/db.js` — preserved as plain async functions (no React dependency)
- `src/lib/offline.js` — preserved as plain async functions
- `src/lib/push.js` — preserved as plain async functions
- `src/lib/ui.js` — utility helpers (`esc`, `formatFecha`, `toast`) preserved

**What changes:**
- Build tooling: no bundler → Vite
- Entry point: `index.html` + `src/main.js` → `index.html` + `src/main.jsx`
- Routing: custom `nav` CustomEvent + `location.search` → React Router v6
- Auth state: module-level `let currentUser` + `document.dispatchEvent('auth-change')` → `AuthContext`
- Views: imperative `container.innerHTML = ...` functions → React components
- PWA: hand-written `public/sw.js` + `public/manifest.json` → `vite-plugin-pwa`
- Environment variables: hardcoded strings in `src/lib/supabase.js` → `import.meta.env.VITE_*`
- `window` globals (`window._ligaState`, `window.cambiarTab`, `window.adminToggleLiga`, etc.) → React state and event handlers

---

## Architecture

### High-Level Structure

```
src/
├── main.jsx                  # Vite entry — renders <App /> into #app
├── App.jsx                   # Router setup, AuthProvider, OfflineBanner
├── lib/
│   ├── supabase.js           # createClient from npm, reads import.meta.env
│   ├── db.js                 # All Supabase data-access functions (unchanged API)
│   ├── offline.js            # IndexedDB snapshot helpers (unchanged API)
│   ├── push.js               # Browser Notification API helpers (unchanged API)
│   └── ui.js                 # esc(), formatFecha(), toast() (unchanged API)
├── context/
│   └── AuthContext.jsx       # currentUser, currentProfile, login, logout, register
├── hooks/
│   ├── useAuth.js            # Convenience hook: useContext(AuthContext)
│   └── useLeagueData.js      # Fetches + caches league, teams, matches; handles refresh
├── components/
│   ├── OfflineBanner.jsx     # Fixed top banner when navigator.onLine is false
│   ├── LoadingSpinner.jsx    # Reusable spinner
│   ├── Toast.jsx             # Imperative toast via React portal
│   └── PushToggle.jsx        # Notification permission toggle
├── pages/
│   ├── PublicView.jsx        # League search + standings/results/fixture tabs
│   ├── AuthScreen.jsx        # Login / Register card
│   ├── OrgDashboard.jsx      # Organizer tabbed dashboard
│   └── AdminPanel.jsx        # Admin tabbed panel
└── utils/
    ├── calcularTabla.js      # Pure standings calculation (extracted from public-view.js)
    └── generarFixture.js     # Pure round-robin generator (extracted from liga-dashboard.js)
```

### Routing Architecture

React Router v6 with `BrowserRouter`. All routes fall back to `index.html` via Vercel's existing catch-all rule (updated for the Vite build output).

```
/                → <HomeRoute>   (auth-aware: renders OrgDashboard, AdminPanel, or PublicView)
/?liga=<code>   → <PublicView>  (no auth required)
/login          → <AuthScreen>  (redirects to / if already authenticated)
```

The `liga` query parameter is read with `useSearchParams()` inside `<HomeRoute>`. No `window.location.href` assignments or `document.dispatchEvent('nav', ...)` calls exist in the React codebase.

### Data Flow

```
Supabase ──► db.js (async functions)
                │
                ▼
         useLeagueData hook  ──► OrgDashboard (React state)
                │
                ▼
         offline.js (IndexedDB snapshots)  ──► PublicView (offline fallback)
```

Auth state flows from `AuthContext` down to all components via `useAuth()`. No component reads `currentUser` or `currentProfile` from module-level variables.

---

## Components and Interfaces

### AuthContext (`src/context/AuthContext.jsx`)

```jsx
interface AuthContextValue {
  currentUser: SupabaseUser | null
  currentProfile: Profile | null
  isLoggedIn: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  loading: boolean          // true while getSession() is in flight
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
  register(email: string, password: string, nombre: string): Promise<void>
}
```

On mount, calls `supabase.auth.getSession()`. While `loading` is `true`, the router renders a full-screen spinner instead of route content. Subscribes to `supabase.auth.onAuthStateChange` to keep state in sync. On `SIGNED_OUT`, removes `localStorage.ligaActualId`.

### `useLeagueData` hook (`src/hooks/useLeagueData.js`)

```js
function useLeagueData(ligaId) {
  return {
    liga,       // League object | null
    equipos,    // Team[]
    partidos,   // Match[]
    loading,    // boolean
    error,      // string | null
    refresh()   // re-fetches liga, equipos, partidos from Supabase
  }
}
```

Replaces the `window._ligaState` pattern. Called by `OrgDashboard` when a league is opened. `refresh()` is called on `visibilitychange` (visible) and `window focus` events — replacing `window.location.reload()`.

### `PublicView` (`src/pages/PublicView.jsx`)

Props: none. Reads `?liga=<code>` from `useSearchParams()`.

- If `liga` param is present: fetches league data, saves offline snapshot, renders tabs.
- If no param: renders the search form.
- On network error + offline: loads from `loadSnapshot()`.
- Renders `<OfflineBanner />` via the global `App.jsx` wrapper (not per-page).

### `AuthScreen` (`src/pages/AuthScreen.jsx`)

Renders the login/register card. Uses `useAuth()` for `login` and `register`. On success, React Router's `useNavigate()` redirects to `/`. Links use `<Link>` components.

### `OrgDashboard` (`src/pages/OrgDashboard.jsx`)

Uses `useLeagueData(ligaId)` for data. Tab state is `useState`. No `window.cambiarTab`, no `window._renderTab`. Tabs: Tabla, Fixture, Partidos, Equipos, Playoffs, Finanzas, Config. Each tab is a sub-component receiving `{ liga, equipos, partidos, refresh }` as props.

### `AdminPanel` (`src/pages/AdminPanel.jsx`)

Tab state is `useState`. All event handlers are React `onClick` props — no `window.adminToggleLiga` etc. Tabs: Métricas, Ligas, Usuarios, Peticiones.

### `OfflineBanner` (`src/components/OfflineBanner.jsx`)

Listens to `window online/offline` events via `useEffect`. Renders a fixed top bar when offline. Mounted once in `App.jsx`.

### `PushToggle` (`src/components/PushToggle.jsx`)

Reads `Notification.permission` on mount. Calls `requestPermission()` on click. Updates displayed label reactively. Handles `window.Notification === undefined` by rendering a disabled state.

---

## Data Models

These are the Supabase table shapes as used by the React components. The schema is unchanged.

```ts
interface Profile {
  id: string           // uuid, matches auth.users.id
  email: string
  nombre: string | null
  role: 'superadmin' | 'admin' | 'organizador'
  activo: boolean
  created_at: string
}

interface League {
  id: string
  nombre: string
  temporada: string | null
  codigo: string       // e.g. "VOL-2K7"
  alias: string | null // e.g. "lachona"
  owner_id: string
  config: LeagueConfig
  reglas: Rule[]
  playoffs_cfg: object
  activa: boolean
  created_at: string
}

interface LeagueConfig {
  vueltas?: number          // default 2
  usarPuntos?: boolean      // default true
  usarSets?: boolean        // default true
  mostrarColDifSets?: boolean
  ptsVictoria?: number      // default 2
  ptsBono?: number          // default 1
  ptsDerota?: number        // default 0
  precioInscripcion?: number
  precioArbitraje?: number
  permitirAdelantoArb?: boolean
}

interface Team {
  id: string
  league_id: string
  nombre: string
  inscripcion_pagada: boolean
  arb_saldo: number
  created_at: string
}

interface Match {
  id: string
  league_id: string
  vuelta: number
  fecha: string | null     // ISO date string
  equipo_a: string
  equipo_b: string
  sets: SetDetail[]
  sets_a: number
  sets_b: number
  ganador: 'A' | 'B' | null
  jugado: boolean
  pago_arb_a: boolean
  pago_arb_b: boolean
  es_playoff: boolean
  created_at: string
}

interface StandingsRow {
  equipo: string
  pj: number    // games played
  pg: number    // games won
  pp: number    // games lost
  sg: number    // sets won
  sp: number    // sets lost
  pts: number   // points
}

interface OfflineSnapshot {
  ligaId: string
  liga: League
  equipos: Team[]
  partidos: Match[]
  savedAt: string   // ISO timestamp
}
```

### Pure Utility Functions

Two pure functions are extracted from the vanilla JS files into `src/utils/`:

**`calcularTabla(equipos: Team[], partidos: Match[], cfg: LeagueConfig): StandingsRow[]`**
- Extracted from `public-view.js` and `liga-dashboard.js` (identical implementations)
- Returns standings sorted by: pts desc (if `usarPuntos`), then pg desc, then set-diff desc (if `usarSets`)
- No side effects, no DOM access

**`generarFixture(nombres: string[]): { local: string, visitante: string }[]`**
- Extracted from `public-view.js` and `liga-dashboard.js` (identical implementations)
- Returns all unique pairs for a round-robin tournament
- No side effects, no DOM access

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property reflection:** Properties 3 and 4 (originally separate count and unique-pairs properties for `generarFixture`) were consolidated into a single comprehensive property. If every unordered pair appears exactly once, the count N*(N-1)/2 is implied — so a single property covering both invariants is stronger and non-redundant.

### Property 1: calcularTabla — no teams lost or duplicated

*For any* non-empty array of teams and any array of matches, `calcularTabla` SHALL return a standings array where every team name from the input appears exactly once in the output.

**Validates: Requirements 5.5**

### Property 2: calcularTabla — games-played sum invariant

*For any* array of teams and array of matches, the sum of all `pj` values in the output of `calcularTabla` SHALL equal twice the number of non-playoff played matches in the input.

**Validates: Requirements 5.6**

### Property 3: generarFixture — complete round-robin coverage

*For any* array of N distinct team names (N ≥ 2), `generarFixture` SHALL return exactly N*(N-1)/2 matchup objects, and every unordered pair of distinct team names from the input SHALL appear exactly once in the output (each matchup object containing exactly the fields `local` and `visitante`).

**Validates: Requirements 7.7, 7.8**

### Property 4: Offline snapshot round-trip

*For any* valid snapshot object `{ liga, equipos, partidos }`, calling `saveSnapshot(key, s)` followed by `loadSnapshot(key)` SHALL return an object whose `liga`, `equipos`, and `partidos` fields are deeply equal to those in `s`.

**Validates: Requirements 9.2**

### Property 5: Offline relative-time formatting

*For any* ISO timestamp `savedAt`, the relative-time label computed from `Date.now() - new Date(savedAt)` SHALL satisfy: less than 60 000 ms → "hace un momento"; 60 000–3 599 999 ms → "hace Xm" where X is the floor of minutes; 3 600 000–86 399 999 ms → "hace Xh" where X is the floor of hours; ≥ 86 400 000 ms → "hace Xd" where X is the floor of days.

**Validates: Requirements 5.7**

### Property 6: DB alias validation rejects invalid inputs

*For any* alias string that contains characters outside `[a-z0-9-]` or has length less than 3 or greater than 20, `actualizarAlias` SHALL throw an `Error` with a Spanish-language message.

**Validates: Requirements 2.4**

---

## Error Handling

### Authentication Errors

`AuthContext.login` and `AuthContext.register` call the existing `traducirError` helper from `auth.js` and re-throw with Spanish messages. Components catch these and display them inline below the form — no navigation on error.

### Data Layer Errors

All `db.js` functions throw `Error` with Spanish messages on Supabase errors. Components catch these in `try/catch` blocks and call `toast(err.message, 'error')`. The `useLeagueData` hook exposes an `error` string that components can render inline.

### Offline / Network Errors

`PublicView` catches fetch errors and falls back to `loadSnapshot`. If the snapshot is also absent, it renders a Spanish-language error message. The `OfflineBanner` component handles the global offline indicator independently.

### Auth Session Errors

If `supabase.auth.getSession()` throws, `AuthContext` catches it, sets `loading = false`, and treats the user as unauthenticated. The app renders the public view without crashing.

### Missing Environment Variables

`src/lib/supabase.js` reads `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. If either is undefined, it falls back to a non-empty placeholder string (`'https://placeholder.supabase.co'` and `'placeholder-key'`) so `createClient` does not throw. The app renders its initial UI; Supabase calls will fail gracefully with network errors.

### PWA / Service Worker Errors

`vite-plugin-pwa` generates the service worker. If the SW install step fails (e.g., a precache asset 404s), the SW still activates and attempts to serve cached assets on subsequent fetches. The app does not crash if the SW is unavailable.

---

## Testing Strategy

### Unit Tests (Vitest)

Unit tests cover specific examples, edge cases, and error conditions for the pure utility functions and the DB layer validation logic.

**`calcularTabla`:**
- Empty teams array returns empty array
- Single team with no matches returns `{ pj:0, pg:0, pp:0, sg:0, sp:0, pts:0 }`
- Playoff matches (`es_playoff: true`) are excluded from standings
- `usarPuntos: false` config produces `pts: 0` for all rows
- `usarSets: false` config produces `sg: 0, sp: 0` for all rows

**`generarFixture`:**
- 2 teams → 1 matchup
- 3 teams → 3 matchups
- Each matchup has exactly `local` and `visitante` fields

**`actualizarAlias` validation:**
- Alias `"ab"` (length 2) throws
- Alias `"abc def"` (contains space) throws
- Alias `"abc"` (valid) does not throw on the validation step

**`AuthContext`:**
- `loading` is `true` before `getSession()` resolves
- `loading` is `false` after `getSession()` resolves
- `SIGNED_OUT` event clears `currentUser` and `currentProfile`

### Property-Based Tests (Vitest + fast-check)

Property tests use `fast-check` and run a minimum of 100 iterations each. Each test is tagged with a comment referencing the design property it validates.

**Tag format:** `// Feature: react-migration, Property N: <property text>`

**Property 1 — calcularTabla no teams lost or duplicated:**
Generate arbitrary arrays of teams (1–20 teams) and arbitrary arrays of matches between those teams. Assert that the output length equals the input teams length and every team name appears exactly once.

**Property 2 — calcularTabla games-played sum:**
Generate arbitrary teams and matches. Count non-playoff played matches. Assert `sum(output.map(r => r.pj)) === 2 * playedNonPlayoffCount`.

**Property 3 — generarFixture complete round-robin coverage:**
Generate arrays of 2–20 distinct team name strings. Assert output length equals `N*(N-1)/2` AND every unordered pair appears exactly once in the output (each matchup has exactly `local` and `visitante` fields).

**Property 4 — Offline snapshot round-trip:**
Generate arbitrary `{ liga, equipos, partidos }` objects. Call `saveSnapshot` then `loadSnapshot`. Assert deep equality of `liga`, `equipos`, and `partidos` fields. (Uses an in-memory IndexedDB mock via `fake-indexeddb`.)

**Property 5 — Offline relative-time formatting:**
Generate arbitrary timestamps in the past (0 ms to 30 days ago). Assert the formatted string matches the correct bucket rule.

**Property 6 — DB alias validation:**
Generate strings that violate alias rules (too short, too long, invalid characters). Assert `actualizarAlias` throws with a Spanish message. Also generate valid aliases and assert no validation error is thrown.

### Integration Tests

- Auth flow: login with valid credentials → `currentProfile` populated → redirect to correct dashboard
- Public view: fetch league by code → standings rendered → snapshot saved to IndexedDB
- Offline fallback: mock `navigator.onLine = false` → `loadSnapshot` returns cached data → offline badge shown

### PWA / Build Verification

- `npm run build` exits with code 0
- `dist/` contains `index.html`, at least one `.js`, at least one `.css`
- `dist/` contains a generated service worker file and `manifest.webmanifest`
- No literal Supabase URL or anon key appears in any `src/` file
