# Requirements Document

## Introduction

This feature migrates the Liga Voleibol app from a vanilla JavaScript, module-based SPA to a React application built with Vite. The current app uses imperative DOM manipulation, module-level mutable state, and `window` globals as workarounds for browser module-freezing issues (notably in Edge). The migration replaces all of that with React components, hooks, and context — while preserving every existing feature: authentication, league management, standings, fixture, match recording, finances, playoffs, offline support (IndexedDB), push notifications, and PWA capabilities.

The Supabase backend, database schema, and all existing CSS styles remain unchanged.

## Glossary

- **App**: The Liga Voleibol React application being built.
- **Vite**: The build tool and dev server used for the React project.
- **React_Router**: The client-side routing library (React Router v6) used to replace the custom `nav` event system.
- **Auth_Context**: A React context that exposes authentication state (`currentUser`, `currentProfile`) and actions (`login`, `logout`, `register`) to the component tree.
- **Supabase_Client**: The `@supabase/supabase-js` npm package instance configured with the project URL and anon key.
- **DB_Layer**: The data-access functions in `src/lib/db.js`, preserved as plain async functions callable from React hooks and components.
- **Public_View**: The unauthenticated view that shows league standings, results, and fixture given a league code or alias.
- **Org_Dashboard**: The authenticated organizer view with tabs for standings, fixture, matches, teams, playoffs, finances, and configuration.
- **Admin_Panel**: The authenticated admin/superadmin view with tabs for metrics, leagues, users, and join requests.
- **Offline_Store**: The IndexedDB-based snapshot system in `src/lib/offline.js` that caches league data for offline use.
- **PWA**: Progressive Web App — the service worker and web manifest that enable installability and offline caching.
- **Push_Notification**: A browser Notification API notification triggered when a match result is saved.
- **calcularTabla**: The pure function that computes the standings table from a list of teams and matches.
- **generarFixture**: The pure function that generates all round-robin matchups from a list of team names.

---

## Requirements

### Requirement 1: Project Setup and Build Tooling

**User Story:** As a developer, I want the project to use Vite and React, so that I have a modern build pipeline with fast HMR, TypeScript-ready tooling, and a production-optimized bundle.

#### Acceptance Criteria

1. THE App SHALL be scaffolded as a Vite + React project with `react` and `react-dom` listed as runtime dependencies in `package.json`.
2. THE App SHALL include a `package.json` with scripts: `dev` (start dev server), `build` (production build), and `preview` (preview production build).
3. WHEN the `build` script is executed, THE App SHALL exit with code 0, produce no stderr output, and generate a `dist/` folder containing `index.html`, at least one `.js` file, and at least one `.css` file.
4. WHEN the `build` script completes successfully, THE `dist/` folder SHALL contain a generated service worker file and a `manifest.webmanifest` file; the legacy `public/sw.js` and `public/manifest.json` files SHALL NOT be referenced as the PWA artifacts in the built output.
5. THE App SHALL read the Supabase URL and anon key exclusively from `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`; no literal Supabase URL or anon key string SHALL appear in any source file under `src/`.
6. IF `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are not set at build time, THEN THE Supabase_Client SHALL use non-empty placeholder strings that allow `createClient` to be called without throwing, and THE App SHALL render its initial UI with no JavaScript runtime error in the browser console.

---

### Requirement 2: Supabase Client and Data Layer

**User Story:** As a developer, I want the Supabase client to be initialized from an npm package and environment variables, so that the app works correctly in both development and production without CDN dependencies.

#### Acceptance Criteria

1. THE Supabase_Client SHALL be initialized using `@supabase/supabase-js` installed as an npm package, replacing the `esm.sh` CDN import.
2. THE Supabase_Client SHALL read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env` at initialization time.
3. THE DB_Layer SHALL expose all of the following async functions with the same parameter names and return shapes as the current `src/lib/db.js`: `getLigaByCodigo(codigo)`, `getLigaById(id)`, `getMisLigas(userId)`, `crearLiga({nombre, temporada, ownerId, config, reglas, playoffsCfg})`, `actualizarLiga(id, updates)`, `renovarCodigo(id)`, `actualizarAlias(id, alias)`, `getEquipos(ligaId)`, `agregarEquipo(ligaId, nombre)`, `actualizarEquipo(id, updates)`, `eliminarEquipo(id)`, `getPartidos(ligaId)`, `guardarPartido(ligaId, data)`, `actualizarPartido(id, updates)`, `eliminarPartido(id)`, `getPlayoffs(ligaId)`, `guardarPlayoffs(ligaId, data)`, `invitarCoAdmin(ligaId, email)`, `quitarMiembro(ligaId, userId)`, `getMiembros(ligaId)`, `contarLigasDeUsuario(userId)`, `enviarPeticion(userId, mensaje)`, `adminGetMetrics()`, `adminGetLigas()`, `adminToggleLiga(id, activa)`, `adminGetUsers()`, `adminCambiarRol(id, rol)`, `adminToggleUser(id, activo)`, `adminGetPeticiones()`, `adminAprobarPeticion(id)`, `adminRechazarPeticion(id)`.
4. IF a DB_Layer function receives invalid input (e.g., an alias shorter than 3 characters or containing characters outside `[a-z0-9-]`) or Supabase returns an error, THEN THE DB_Layer SHALL throw an `Error` whose message includes the reason for the failure in Spanish.

---

### Requirement 3: Authentication State Management

**User Story:** As a user, I want my login session to persist across page reloads and browser restarts, so that I do not have to log in every time I open the app.

#### Acceptance Criteria

1. THE Auth_Context SHALL expose `currentUser`, `currentProfile`, `isLoggedIn`, `isAdmin`, `isSuperAdmin`, `login`, `logout`, and `register` to all descendant components via React context.
2. WHEN the App mounts, THE Auth_Context SHALL call `supabase.auth.getSession()` to restore any existing session; WHILE the session check is in progress, protected routes SHALL NOT render their content; IF `getSession()` throws or returns an error, THE Auth_Context SHALL treat the user as unauthenticated and render the public view.
3. WHEN a `SIGNED_IN` event is received from Supabase, THE Auth_Context SHALL update `currentUser` and `currentProfile` and redirect the user to the Org_Dashboard (for organizers) or Admin_Panel (for admins/superadmins).
4. WHEN a `SIGNED_OUT` event is received from Supabase, THE Auth_Context SHALL clear `currentUser` and `currentProfile`, remove the `localStorage` key `ligaActualId`, and redirect the user to the public view.
5. IF `login` is called with incorrect credentials, THEN THE Auth_Context SHALL throw an `Error` with a Spanish-language message (e.g., "Correo o contraseña incorrectos").

---

### Requirement 4: Client-Side Routing

**User Story:** As a user, I want the app URL to reflect the current view, so that I can share a link to a specific league's public page and use the browser back button.

#### Acceptance Criteria

1. THE App SHALL use React_Router to define the following routes: `/` (home — renders based on auth state), `/?liga=<code>` (public league view), and `/login` (authentication screen); no `document.dispatchEvent(new CustomEvent('nav', ...))` call SHALL exist anywhere in the codebase.
2. WHEN a user navigates to `/?liga=<code>`, THE App SHALL render the Public_View for that league code without requiring authentication.
3. IF the `liga` query parameter is provided but the code is not found, THE App SHALL render the Public_View search form with a Spanish-language error message indicating the league was not found.
4. WHILE the authentication state is being resolved on initial load, THE App SHALL render a loading indicator instead of the home route content.
5. WHEN an authenticated user navigates to `/` (with no `liga` query parameter), THE App SHALL render the Org_Dashboard if the user's role is `organizer`, or the Admin_Panel if the user's role is `admin` or `superadmin`.
6. WHEN an unauthenticated user navigates to `/` (with no `liga` query parameter), THE App SHALL render the Public_View with the league search form.
7. WHEN a user navigates to `/login`, THE App SHALL render the authentication screen.
8. IF an already-authenticated user navigates to `/login`, THE App SHALL redirect them to `/`.

---

### Requirement 5: Public View Component

**User Story:** As a visitor, I want to view a league's standings, results, and fixture by entering a league code, so that I can follow my team's progress without creating an account.

#### Acceptance Criteria

1. WHEN a valid league code or alias is provided, THE Public_View SHALL fetch and display the league's standings table, match results, and fixture in three tabs.
2. WHEN the device is online and an invalid or unknown code is provided, THE Public_View SHALL display a Spanish-language error message indicating the code was not found.
3. WHILE the league data is loading, THE Public_View SHALL display a loading spinner.
4. THE calcularTabla function SHALL accept an array of teams, an array of matches, and a configuration object (`cfg`), and return a standings array sorted by: points descending (only when `cfg.usarPuntos` is `true`), then wins descending, then set difference descending (only when `cfg.usarSets` is `true`).
5. FOR ALL valid combinations of teams and matches, THE calcularTabla function SHALL return a standings array where every team in the input appears exactly once in the output (invariant: no teams are lost or duplicated).
6. FOR ALL valid combinations of teams and matches, THE calcularTabla function SHALL return a standings array where the sum of all `pj` (games played) values equals twice the number of non-playoff played matches (invariant: each non-playoff played match contributes to exactly two teams' records).
7. IF the device is offline and a snapshot exists in the Offline_Store, THEN THE Public_View SHALL render the cached data and display an offline indicator badge showing the relative time of the last save, where: less than 1 minute is shown as "hace un momento", less than 60 minutes as "hace Xm", less than 24 hours as "hace Xh", and 24 hours or more as "hace Xd".
8. WHEN league data is successfully fetched online, THE Public_View SHALL save a snapshot to the Offline_Store for future offline use.
9. IF the device is offline and no snapshot exists in the Offline_Store for the requested code, THEN THE Public_View SHALL display a Spanish-language error message indicating there is no connection and no saved data for that league.

---

### Requirement 6: Authentication UI Component

**User Story:** As an organizer, I want to log in or register from a dedicated screen, so that I can access my league management dashboard.

#### Acceptance Criteria

1. THE Auth_Screen SHALL render a card with two tabs: "Iniciar sesión" and "Registrarse".
2. WHEN the login form is submitted with valid credentials, THE Auth_Screen SHALL call `login` from Auth_Context; WHEN `login` resolves successfully, THE App SHALL navigate to the Org_Dashboard (for organizers) or Admin_Panel (for admins/superadmins).
3. IF the login form is submitted and `login` throws an error, THEN THE Auth_Screen SHALL display the error message below the form without navigating away.
4. WHEN the register form is submitted successfully, THE Auth_Screen SHALL display a Spanish-language success message and reset all form fields to empty.
5. IF the register form is submitted and registration fails, THEN THE Auth_Screen SHALL display the error message below the form without navigating away.
6. THE Auth_Screen SHALL render a link with the text "Ingresa con código →"; WHEN the link is clicked, THE App SHALL navigate to the public view search form at `/`.
7. THE Auth_Screen SHALL render a link with the text "← Volver al inicio"; WHEN the link is clicked, THE App SHALL navigate to `/`.

---

### Requirement 7: Organizer Dashboard Component

**User Story:** As a league organizer, I want a tabbed dashboard to manage my league's teams, matches, standings, finances, and configuration, so that I can run my league from a single interface.

#### Acceptance Criteria

1. THE Org_Dashboard SHALL render a top navigation bar displaying the current league's name (up to 60 characters) and a logout button.
2. THE Org_Dashboard SHALL render tabs: Tabla, Fixture, Partidos, Equipos, Playoffs, Finanzas, and Config.
3. WHEN a tab is selected, THE Org_Dashboard SHALL render the corresponding section without triggering a full page navigation or calling `window.location.reload()`.
4. THE Org_Dashboard SHALL hold the current league, teams, and matches in an in-memory React state object that is the authoritative source of truth for the session, where the session lasts until the user logs out or closes the browser tab.
5. WHEN the user has multiple leagues, THE Org_Dashboard SHALL render a league selector screen before showing the tabbed dashboard.
6. WHEN the user has no leagues, THE Org_Dashboard SHALL render an empty state with a "Crear mi primera liga" button.
7. THE generarFixture function SHALL accept an array of N team name strings (N ≥ 2) and return an array of matchup objects, where each matchup object contains exactly two fields — `local` (string) and `visitante` (string) — covering all unique pairs exactly once (round-robin invariant).
8. FOR ALL arrays of N team names (N ≥ 2), THE generarFixture function SHALL return exactly N*(N-1)/2 matchup objects.
9. WHEN a match is saved and the browser notification permission status is `granted`, THE Org_Dashboard SHALL trigger a push notification via the Push_Notification utility; IF the permission status is not `granted`, THE Org_Dashboard SHALL skip the notification silently and still update the Offline_Store snapshot.
10. WHEN the user returns to the app after minimizing (visibility change to `visible` or window focus event), THE Org_Dashboard SHALL re-fetch the current league record, its teams, and its matches from Supabase and update the in-memory state, replacing the current `window.location.reload()` workaround; IF the re-fetch fails, THE Org_Dashboard SHALL retain the existing in-memory state and display an error message indicating that data could not be refreshed.

---

### Requirement 8: Admin Panel Component

**User Story:** As an admin or superadmin, I want a dedicated panel to manage users, leagues, and join requests, so that I can oversee the entire platform.

#### Acceptance Criteria

1. THE Admin_Panel SHALL render tabs: Métricas, Ligas, Usuarios, and Peticiones.
2. WHEN the Métricas tab is active, THE Admin_Panel SHALL display platform-wide counts (total users, total leagues, total teams, total matches played) and the 5 most recently created users and leagues, ordered by creation date descending.
3. WHEN the Ligas tab is active, THE Admin_Panel SHALL display all leagues with their current active/inactive status and a toggle button; WHEN the toggle is clicked, THE Admin_Panel SHALL call `adminToggleLiga` and update the displayed status without a full page reload.
4. WHEN the Usuarios tab is active and the current user's role is `superadmin`, THE Admin_Panel SHALL render a role dropdown for each user; WHEN a role is selected, THE Admin_Panel SHALL call `adminCambiarRol` and reflect the new role in the UI.
5. WHEN the Peticiones tab is active, THE Admin_Panel SHALL display all pending join requests with an approve button and a reject button for each; WHEN approve is clicked, THE Admin_Panel SHALL call `adminAprobarPeticion` and remove the request from the list; WHEN reject is clicked, THE Admin_Panel SHALL call `adminRechazarPeticion` and remove the request from the list.
6. THE Admin_Panel SHALL handle all user interactions via React event handlers; no `window.adminToggleLiga`, `window.adminCambiarRol`, `window.adminToggleUser`, or `window.adminPeticion` globals SHALL exist in the codebase.

---

### Requirement 9: Offline Support

**User Story:** As a visitor, I want to view a league's data even when I have no internet connection, so that I can check standings at the venue without reliable connectivity.

#### Acceptance Criteria

1. THE Offline_Store SHALL expose `saveSnapshot(ligaId, data)` and `loadSnapshot(ligaId)` as async functions; `saveSnapshot` SHALL persist the data and resolve without error; `loadSnapshot` SHALL return the most recently saved data for the given key, or `null` if no snapshot exists.
2. WHEN `saveSnapshot(key, s)` is called followed by `loadSnapshot(key)`, THE returned object SHALL have `liga`, `equipos`, and `partidos` fields that are deeply equal to those in `s`.
3. IF `navigator.onLine` is `false` when the App loads or transitions to offline, THEN THE App SHALL display a fixed banner at the top of the screen indicating no internet connection.
4. WHEN the `online` event fires on `window`, THE App SHALL hide the offline banner automatically.
5. IF the device is offline and `loadSnapshot` returns `null` for the requested league, THEN THE App SHALL display a Spanish-language error message indicating there is no connection and no saved data available.

---

### Requirement 10: Push Notifications

**User Story:** As an organizer, I want to receive a browser notification when a match result is saved, so that I am immediately aware of score updates.

#### Acceptance Criteria

1. THE Org_Dashboard SHALL render a push notification toggle that displays "Activadas" when `Notification.permission` is `granted`, "Bloqueadas" when it is `denied`, and "Activar" when it is `default`.
2. WHEN the user clicks the "Activar" toggle and `Notification.requestPermission()` resolves to `granted`, THE toggle SHALL update to display "Activadas".
3. IF `Notification.requestPermission()` resolves to `denied`, THEN THE toggle SHALL update to display "Bloqueadas".
4. WHEN a match is saved and `Notification.permission` is `granted`, THE App SHALL display a browser notification whose body includes the league name and the match score in `sets_a:sets_b` format (e.g., "2:1").
5. IF `window.Notification` is `undefined`, THEN THE App SHALL render the push notification toggle in a non-interactive, disabled state with a label indicating the browser does not support notifications.

---

### Requirement 11: PWA Support

**User Story:** As a user on a mobile device, I want to install the app to my home screen and use it offline, so that it behaves like a native app.

#### Acceptance Criteria

1. THE App SHALL include a web manifest with the app name "Liga Voleibol", theme color `#f59e0b`, and icon entries for 192×192 and 512×512 pixel sizes.
2. THE App SHALL register a service worker that caches the app shell (the entry HTML file, the main stylesheet, and the JS entry module) during installation; IF the installation step fails, THE service worker SHALL still activate and attempt to cache the app shell on the next fetch.
3. WHEN the app is requested while offline and the service worker has previously cached the app shell, THE service worker SHALL respond with the cached entry HTML without making a network request.
4. THE App's deployment configuration SHALL serve all routes by falling back to `index.html` so that React Router handles client-side navigation without returning a 404 from the server.

---

### Requirement 12: CSS and Visual Fidelity

**User Story:** As a user, I want the migrated React app to look identical to the current app, so that the migration is transparent and does not disrupt my workflow.

#### Acceptance Criteria

1. THE App SHALL import `styles.css` in the root component or entry file so that all CSS custom properties, component classes, and utility classes defined in it are available globally to every React component.
2. THE App SHALL use the same CSS class names in its rendered HTML output as the current app uses (e.g., `topbar`, `tab-nav`, `fixture-item`, `badge`, `auth-card`, `admin-table`) so that the existing stylesheet rules apply without modification.
3. THE App SHALL include the Google Fonts stylesheet link for the Inter and JetBrains Mono font families, either in `index.html` or imported via CSS, so that both fonts load in the browser.
