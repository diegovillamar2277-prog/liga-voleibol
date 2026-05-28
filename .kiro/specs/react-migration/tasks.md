# Implementation Plan: react-migration

## Overview

Migrate the Liga Voleibol vanilla-JS SPA to a React + Vite application. The migration proceeds in layers: build tooling first, then the data/utility layer, then auth context, then routing, then each page component, and finally PWA and visual fidelity. Each step is independently runnable and leaves the app in a working state.

## Tasks

- [-] 1. Scaffold Vite + React project and configure build tooling
  - Initialize a new Vite project with the `react` template inside the existing repo root (replacing the current `index.html` entry point)
  - Add `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `vite-plugin-pwa`, and `fast-check` (dev) to `package.json`
  - Add `vitest` and `@testing-library/react` as dev dependencies; configure `vitest.config.js`
  - Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (values from current `src/lib/supabase.js`); add `.env` to `.gitignore`
  - Update `vercel.json` to serve all routes from `dist/index.html` (catch-all rewrite)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Migrate the data and utility layer
  - [-] 2.1 Rewrite `src/lib/supabase.js` to use the npm `@supabase/supabase-js` package and read credentials from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; add placeholder fallback strings so `createClient` never throws when env vars are absent
    - _Requirements: 1.5, 1.6, 2.1, 2.2_

  - [-] 2.2 Update `src/lib/db.js` to import `sb` from the new `supabase.js`; verify all 30+ exported async functions listed in Requirement 2.3 are present with unchanged signatures; ensure `actualizarAlias` validation throws Spanish-language errors for invalid inputs
    - _Requirements: 2.3, 2.4_

  - [-] 2.3 Extract `calcularTabla` from `src/liga/liga-dashboard.js` / `src/liga/public-view.js` into `src/utils/calcularTabla.js` as a pure function with no DOM access or side effects
    - _Requirements: 5.4, 5.5, 5.6_

  - [-] 2.4 Write property test for `calcularTabla` — no teams lost or duplicated
    - **Property 1: calcularTabla — no teams lost or duplicated**
    - **Validates: Requirements 5.5**

  - [-] 2.5 Write property test for `calcularTabla` — games-played sum invariant
    - **Property 2: calcularTabla — games-played sum invariant**
    - **Validates: Requirements 5.6**

  - [-] 2.6 Write unit tests for `calcularTabla`
    - Empty teams array returns empty array
    - Single team with no matches returns all-zero row
    - Playoff matches (`es_playoff: true`) are excluded
    - `usarPuntos: false` produces `pts: 0` for all rows
    - `usarSets: false` produces `sg: 0, sp: 0` for all rows
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 2.7 Extract `generarFixture` from `src/liga/liga-dashboard.js` / `src/liga/public-view.js` into `src/utils/generarFixture.js` as a pure function
    - _Requirements: 7.7, 7.8_

  - [-] 2.8 Write property test for `generarFixture` — complete round-robin coverage
    - **Property 3: generarFixture — complete round-robin coverage**
    - **Validates: Requirements 7.7, 7.8**

  - [x] 2.9 Write unit tests for `generarFixture`
    - 2 teams → 1 matchup
    - 3 teams → 3 matchups
    - Each matchup has exactly `local` and `visitante` fields
    - _Requirements: 7.7, 7.8_

- [~] 3. Checkpoint — Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement AuthContext and authentication hooks
  - [-] 4.1 Create `src/context/AuthContext.jsx` implementing the `AuthContextValue` interface from the design: `currentUser`, `currentProfile`, `isLoggedIn`, `isAdmin`, `isSuperAdmin`, `loading`, `login`, `logout`, `register`
    - On mount call `supabase.auth.getSession()`; set `loading = true` until resolved; if `getSession()` throws, treat user as unauthenticated
    - Subscribe to `supabase.auth.onAuthStateChange`; on `SIGNED_OUT` remove `localStorage.ligaActualId`
    - Use `traducirError` logic from `src/auth/auth.js` for Spanish-language error messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [~] 4.2 Create `src/hooks/useAuth.js` as a convenience hook wrapping `useContext(AuthContext)`
    - _Requirements: 3.1_

  - [~] 4.3 Write unit tests for `AuthContext`
    - `loading` is `true` before `getSession()` resolves
    - `loading` is `false` after `getSession()` resolves
    - `SIGNED_OUT` event clears `currentUser` and `currentProfile`
    - _Requirements: 3.2, 3.4_

- [ ] 5. Implement routing and App shell
  - [~] 5.1 Create `src/main.jsx` as the Vite entry point rendering `<App />` into `#app`; import `styles.css` globally; include the Google Fonts `<link>` in `index.html`
    - _Requirements: 1.1, 12.1, 12.3_

  - [~] 5.2 Create `src/App.jsx` with `BrowserRouter`, `AuthProvider`, `<OfflineBanner />`, and route definitions: `/` (`<HomeRoute>`), `/login` (`<AuthScreen>`)
    - `<HomeRoute>` renders a full-screen spinner while `loading` is true; then renders `<AdminPanel>` for admin/superadmin, `<OrgDashboard>` for organizer, or `<PublicView>` for unauthenticated users; reads `?liga=<code>` via `useSearchParams()` and passes it to `<PublicView>`
    - Redirect authenticated users away from `/login` to `/`
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [~] 5.3 Create `src/components/LoadingSpinner.jsx` and `src/components/OfflineBanner.jsx`
    - `OfflineBanner` listens to `window online/offline` events via `useEffect`; renders a fixed top bar when offline; hides when `online` fires
    - _Requirements: 9.3, 9.4_

  - [~] 5.4 Create `src/components/Toast.jsx` implementing the imperative `toast(message, type)` API via a React portal; replace all `toast()` calls in components with this implementation
    - _Requirements: 12.2_

- [ ] 6. Implement offline support and snapshot round-trip
  - [-] 6.1 Verify `src/lib/offline.js` exports `saveSnapshot(key, data)` and `loadSnapshot(key)` with the correct async API; if the file uses any DOM globals incompatible with the test environment, wrap them so the module is importable in Vitest
    - _Requirements: 9.1, 9.2_

  - [~] 6.2 Write property test for offline snapshot round-trip
    - **Property 4: Offline snapshot round-trip**
    - **Validates: Requirements 9.2**
    - Use `fake-indexeddb` to mock IndexedDB in the test environment

- [ ] 7. Implement PublicView page
  - [~] 7.1 Create `src/pages/PublicView.jsx`
    - Read `?liga=<code>` from `useSearchParams()`
    - If param present: fetch league data via `getLigaByCodigo`, save snapshot via `saveSnapshot`, render tabs (Tabla, Resultados, Fixture) using `calcularTabla` and `generarFixture`
    - If no param: render the league search form; on submit navigate to `/?liga=<code>`
    - On network error + offline: call `loadSnapshot`; if snapshot exists render cached data with offline badge; if no snapshot render Spanish-language error
    - _Requirements: 4.2, 4.3, 5.1, 5.2, 5.3, 5.7, 5.8, 5.9_

  - [~] 7.2 Write property test for offline relative-time formatting
    - **Property 5: Offline relative-time formatting**
    - **Validates: Requirements 5.7**
    - Extract the `formatFechaRelativa` helper into `src/utils/formatFechaRelativa.js` and test it directly

- [ ] 8. Implement AuthScreen page
  - [~] 8.1 Create `src/pages/AuthScreen.jsx`
    - Render a card with "Iniciar sesión" and "Registrarse" tabs
    - Use `useAuth()` for `login` and `register`; on success use `useNavigate()` to redirect to `/`
    - Display inline error messages on failure without navigating away
    - On successful registration display a Spanish-language success message and reset form fields
    - Render "Ingresa con código →" link navigating to `/` and "← Volver al inicio" link navigating to `/`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 9. Implement OrgDashboard page
  - [~] 9.1 Create `src/hooks/useLeagueData.js` implementing the `useLeagueData(ligaId)` hook
    - Fetches `liga`, `equipos`, `partidos` from Supabase; exposes `loading`, `error`, and `refresh()`
    - `refresh()` is called on `visibilitychange` (visible) and `window focus` events; on re-fetch failure retain existing state and set `error`
    - _Requirements: 7.4, 7.10_

  - [~] 9.2 Create `src/pages/OrgDashboard.jsx` with tab state via `useState`
    - Render topbar with league name and logout button
    - Render tabs: Tabla, Fixture, Partidos, Equipos, Playoffs, Finanzas, Config — each as a sub-component receiving `{ liga, equipos, partidos, refresh }` as props
    - Render league selector when user has multiple leagues; render empty state with "Crear mi primera liga" when user has no leagues
    - No `window.cambiarTab`, `window._renderTab`, or `window.location.reload()` calls
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.9, 7.10_

  - [~] 9.3 Create `src/components/PushToggle.jsx`
    - Read `Notification.permission` on mount; render "Activadas" / "Bloqueadas" / "Activar" labels
    - On click call `Notification.requestPermission()` and update label reactively
    - Render disabled state when `window.Notification === undefined`
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [~] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement AdminPanel page
  - [~] 11.1 Create `src/pages/AdminPanel.jsx` with tab state via `useState`
    - Tabs: Métricas, Ligas, Usuarios, Peticiones — each as a sub-component
    - Métricas: display platform-wide counts and 5 most recent users/leagues
    - Ligas: display all leagues with active/inactive toggle; call `adminToggleLiga` on click and update UI without page reload
    - Usuarios: render role dropdown for superadmin; call `adminCambiarRol` on change
    - Peticiones: display pending requests with approve/reject buttons; call `adminAprobarPeticion` / `adminRechazarPeticion` and remove from list
    - All event handlers are React `onClick` props — no `window.adminToggleLiga`, `window.adminCambiarRol`, `window.adminToggleUser`, or `window.adminPeticion` globals
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 12. Implement DB alias validation and property test
  - [ ] 12.1 Ensure `actualizarAlias` in `src/lib/db.js` throws Spanish-language errors for: alias shorter than 3 characters, alias longer than 20 characters, alias containing characters outside `[a-z0-9-]`
    - _Requirements: 2.4_

  - [~] 12.2 Write property test for DB alias validation
    - **Property 6: DB alias validation rejects invalid inputs**
    - **Validates: Requirements 2.4**
    - Generate strings violating alias rules and assert `actualizarAlias` throws with a Spanish message; generate valid aliases and assert no validation error

- [ ] 13. Configure PWA with vite-plugin-pwa
  - [~] 13.1 Configure `vite-plugin-pwa` in `vite.config.js`
    - Set manifest: name "Liga Voleibol", theme color `#f59e0b`, icons for 192×192 and 512×512
    - Configure `workbox` to precache the app shell (entry HTML, main stylesheet, JS entry module)
    - Remove references to legacy `public/sw.js` and `public/manifest.json` from `index.html`
    - _Requirements: 1.4, 11.1, 11.2, 11.3, 11.4_

- [ ] 14. Verify build output and visual fidelity
  - [~] 14.1 Run `npm run build` and assert: exit code 0, `dist/index.html` exists, at least one `.js` and one `.css` file exist in `dist/`, a service worker file and `manifest.webmanifest` exist in `dist/`
    - Verify no literal Supabase URL or anon key appears in any `src/` file
    - _Requirements: 1.3, 1.4, 1.5_

  - [~] 14.2 Audit all React components to confirm they use the same CSS class names as the current app (`topbar`, `tab-nav`, `fixture-item`, `badge`, `auth-card`, `admin-table`, etc.) so the existing `styles.css` applies without modification
    - _Requirements: 12.1, 12.2_

- [~] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests use `fast-check` with a minimum of 100 iterations each; each test file includes a comment `// Feature: react-migration, Property N: <property text>`
- Unit tests use Vitest; property tests are complementary to unit tests, not replacements
- `fake-indexeddb` is required as a dev dependency for Property 4 (offline snapshot round-trip)
- The `src/lib/db.js`, `src/lib/offline.js`, `src/lib/push.js`, and `src/lib/ui.js` files are preserved with unchanged APIs — only their Supabase import is updated
- No `window` globals (`window._ligaState`, `window.cambiarTab`, `window.adminToggleLiga`, etc.) should exist in the migrated codebase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.3", "2.7"] },
    { "id": 1, "tasks": ["2.2", "2.4", "2.5", "2.6", "2.8", "2.9"] },
    { "id": 2, "tasks": ["4.1", "6.1", "12.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "6.2", "12.2"] },
    { "id": 4, "tasks": ["5.1", "5.3", "5.4", "9.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["7.1", "8.1", "9.2", "9.3", "11.1"] },
    { "id": 7, "tasks": ["7.2", "13.1"] },
    { "id": 8, "tasks": ["14.1", "14.2"] }
  ]
}
```
