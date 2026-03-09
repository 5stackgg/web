# Test Coverage — Web

## Overview

- **Framework:** Vitest + Vue Test Utils + happy-dom
- **Coverage threshold:** 40% global minimum (branches, functions, lines, statements)
- **Test command:** `npx vitest run --coverage`

---

## Middleware

#### `middleware/auth.global.spec.ts` — Auth Route Guard (14 tests)
Tests the global authentication middleware that protects routes.

Uses `vi.hoisted()` to stub Nuxt auto-imports (`defineNuxtRouteMiddleware`, `navigateTo`, `useNuxtApp`) before module evaluation.

- **Unauthenticated users:**
  - Redirects to login when accessing protected routes
  - Allows access to public routes (login, register, landing)
  - Allows access to Steam callback routes
  - Preserves redirect URL in query params
- **Authenticated users:**
  - Allows access to protected routes
  - Redirects away from login page to dashboard
  - Allows access to admin routes with admin role
  - Blocks access to admin routes without admin role
- **Edge cases:**
  - Handles missing auth state gracefully
  - Handles routes with no meta defined
  - Handles query parameters in redirect URLs
  - Handles nested route paths

---

## Composables

#### `composables/useHubState.spec.ts` — Hub State Management (4 tests)
Tests the reactive hub/server connection state composable.
- Initializes with default disconnected state
- Updates connection status on connect
- Updates connection status on disconnect
- Tracks reconnection attempts

#### `composables/useChatTabs.spec.ts` — Chat Tab Management (10 tests)
Tests the chat tabs composable for managing multiple chat channels.
- Initializes with default tab
- Adds new chat tabs
- Removes chat tabs
- Switches active tab
- Handles duplicate tab creation
- Marks tabs with unread messages
- Clears unread count on tab focus
- Reorders tabs
- Persists tab state
- Handles maximum tab limit

#### `composables/useRightSidebar.spec.ts` — Right Sidebar State (8 tests)
Tests the right sidebar composable with module-level refs for open/close, hover peek, and pin state.
- Opens and closes sidebar via `setRightSidebarOpen`
- Toggles sidebar open/closed via `toggleRightSidebar`
- `startHoverPeek` opens sidebar when closed, no-ops when already open
- `endHoverPeek` closes sidebar when not pinned, keeps open when pinned
- `togglePin` persists pin state to localStorage ("right-hub-pinned")
- `togglePin` removes localStorage key when unpinning

#### `composables/useInvites.spec.ts` — Invite Aggregation (7 tests)
Tests computed aggregation over matchmaking store data for invites and pending friends.
Mocks `useMatchmakingStore` and `useAuthStore` as Nuxt auto-import globals.
- Filters `pendingFriends` by "Pending" status excluding self-invited
- Returns pending friends sorted by name
- `hasInvites` true when any of matchInvites/lobbyInvites/pendingFriends non-empty
- `hasInvites` false when all empty
- `totalCount` sums all three invite arrays

#### `composables/useSound.spec.ts` — Sound Effects (10 tests)
Tests the sound playback composable with volume clamping, enable/disable, and guard conditions.
- Clamps volume to 0.0–1.0 range
- Accepts valid volume values
- Toggles enabled state
- Keeps volume within bounds after multiple updates
- Defaults to enabled with volume 0.7
- `playMatchFoundSound` / `playTickSound` / `playCountdownSound` return early when disabled (guard check)

---

## Utility Functions

#### `utilities/formatBytes.spec.ts` — File Size Formatting (6 tests)
Tests human-readable file size conversion.
- Formats bytes (< 1 KB)
- Formats kilobytes
- Formats megabytes
- Formats gigabytes
- Handles zero bytes
- Handles decimal precision

#### `utilities/formatStatValue.spec.ts` — Stat Display Formatting (5 tests)
Tests formatting of game statistics for display.
- Formats integer stats (kills, deaths)
- Formats percentage stats (headshot %)
- Formats decimal stats (KDR, ADR)
- Handles zero values
- Handles null/undefined values

#### `utilities/tournamentRoundLabels.spec.ts` — Tournament Round Names (16 tests)
Tests generation of round labels for various tournament bracket formats.
- Single elimination round names (Quarterfinals, Semifinals, Final)
- Double elimination upper bracket names
- Double elimination lower bracket names
- Grand Final label
- Handles 4, 8, 16, 32 team brackets
- Round-robin group stage labels
- Swiss format round labels
- Consolation/third-place match labels

#### `utilities/tournamentRoundCalculator.spec.ts` — Bracket Math (13 tests)
Tests tournament bracket calculation logic.
- Calculates rounds needed for N teams (single elimination)
- Calculates rounds needed for N teams (double elimination)
- Calculates total matches per round
- Handles non-power-of-2 team counts (byes)
- Calculates seeds for balanced brackets
- Determines next-round matchups
- Handles edge cases (1 team, 2 teams)
- Validates minimum team requirements

#### `utilities/swissBracketUtils.spec.ts` — Swiss Bracket Utilities (26 tests)
Tests utilities extracted from SwissBracketViewer component.

- **`parseGroupToRecord` (18 tests):**
  - Parses encoded group numbers (e.g., 201 → 2 wins, 1 loss)
  - Handles zero (0-0 record)
  - Handles losses-only (< 100 → 0-N record)
  - Handles string number inputs
  - Handles null and undefined inputs
  - Handles string "wins-losses" format
- **`getBorderColor` (4 tests):**
  - Returns green for advancement records (3-0, 3-1, 3-2)
  - Returns red for elimination records (0-3, 1-3, 2-3)
  - Returns neutral for in-progress records
  - Returns default for unknown records
- **`getBackgroundColor` (4 tests):**
  - Returns green tint for advancement
  - Returns red tint for elimination
  - Returns neutral for in-progress
  - Returns default for unknown

#### `utilities/match-options-validator.spec.ts` — Match Config Validation (8 tests)
Tests validation of match creation options.
- Validates required fields (map pool, team size)
- Rejects invalid team sizes
- Validates overtime settings
- Validates knife round settings
- Rejects conflicting options
- Handles missing optional fields with defaults
- Validates server region selection
- Validates match type (competitive, scrim, tournament)

#### `utilities/cleanMapName.spec.ts` — Map Name Formatting (4 tests)
Tests the `cleanMapName` utility for CS2 map display names.
- Strips `de_` prefix and title-cases (`"de_dust2"` → `"Dust2"`)
- Replaces underscores with spaces and title-cases each word
- Handles empty string

#### `utilities/separateByCapitalLetters.spec.ts` — CamelCase Spacing (5 tests)
Tests inserting spaces before capital letters in camelCase strings.
- Inserts space before capitals (`"HelloWorld"` → `"Hello World"`)
- Handles multiple camelCase transitions
- Preserves already-spaced strings
- Handles all-lowercase and all-uppercase

#### `utilities/uuid.spec.ts` — UUID Generation (2 tests)
Tests the `guid()` utility for generating UUID-like identifiers.
- Returns string matching 8-4-4-4-12 hex format
- Generates unique values on successive calls

#### `utilities/loginLinks.spec.ts` — Auth Login URLs (2 tests)
Tests login link generation using runtime config.
Uses `vi.hoisted()` to stub `useRuntimeConfig` before module evaluation.
- Steam link uses `webDomain` from runtime config
- Discord link uses `webDomain` from runtime config

#### `utilities/setupOptions.spec.ts` — Match Setup Options (16 tests)
Tests match creation option setup, validation, and mutation generation.
Mocks `useAuthStore` (role checks) and Zeus `$` / enum imports.

- **`setupOptions` (1 test):** Calls `form.setValues` with all option fields and applies overrides
- **`setupOptionsVariables` (9 tests):**
  - Throws for each missing required field (mr, type, best_of, knife_round, map_pool)
  - Uses `additional.mapPoolId` over `values.map_pool_id` when both present
  - Includes check_in/auto_cancel/match_mode fields for tournament_organizer+ roles
  - Omits admin fields for roles below tournament_organizer
  - Creates inline `map_pool` data object when no mapPoolId
  - Includes `matchOptionsId` when provided
- **`setupOptionsSetMutation` (4 tests):**
  - Includes `map_pool_id` when `hasMapPoolId=true`, `map_pool` when false
  - Includes/omits admin fields based on role

#### `utilities/debounce.spec.ts` — Debounce Utility (4 tests)
Tests the debounce helper function.
- Delays function execution
- Resets timer on subsequent calls
- Executes only once after delay
- Handles immediate execution option

#### `utilities/kdrColor.spec.ts` — KDR Color Scale (9 tests)
Tests kill/death ratio color mapping for UI display.
- Returns red for KDR < 0.5
- Returns orange for KDR 0.5–0.8
- Returns yellow for KDR 0.8–1.0
- Returns light green for KDR 1.0–1.2
- Returns green for KDR 1.2–1.5
- Returns bright green for KDR > 1.5
- Handles exactly 1.0 KDR
- Handles zero KDR
- Handles very high KDR values

---

## Pinia Stores

#### `stores/AuthStore.spec.ts` — Auth Store & Role Hierarchy (8 tests)
Tests the auth Pinia store's role-based access control logic.
Mocks dependent stores (`SearchStore`, `MatchmakingStore`, `NotificationStore`, `ApplicationSettingsStore`), GraphQL client, and WebSocket. Uses `createPinia()` + `setActivePinia()`.

- **`isRoleAbove` (5 tests):**
  - Returns false when `me` is null
  - Returns true when user role >= target role
  - Returns false when user role < target role
  - Returns true for same role
  - Validates full hierarchy: user < verified_user < streamer < match_organizer < tournament_organizer < administrator
- **Computed role checks (3 tests):**
  - `isAdmin` true only for administrator
  - `isUser` true only for user role
  - `isMatchOrganizer` true only for match_organizer

#### `stores/ApplicationSettings.spec.ts` — Application Settings Store (25 tests)
Tests the application settings Pinia store's computed properties and setting-lookup logic.
Mocks `useAuthStore` (controllable `me` + `isRoleAbove`), `useMatchmakingStore`, GraphQL client. Uses `createPinia()` + `setActivePinia()`.

- **`matchCreateRole` / `tournamentCreateRole` (6 tests):**
  - Returns false when settings is null
  - Returns setting value when present
  - Falls back to `e_player_roles_enum.user` when setting not found
- **`matchmakingAllowed` (4 tests):**
  - Returns false when settings is null
  - Returns false when matchmaking setting is "false"
  - Returns true when no matchmaking setting and no min role (defaults enabled)
  - Calls `isRoleAbove` with min role when setting exists
- **`canCreateMatch` (2 tests):**
  - Returns false when `me` is null
  - Delegates to `isRoleAbove` with `matchCreateRole` value
- **`canAddWithoutInvite` (2 tests):**
  - Returns true when no setting
  - Calls `isRoleAbove` when setting exists
- **`isMatchmakingTypeEnabled` (3 tests):**
  - Returns true when setting not found
  - Returns false when setting is "false"
  - Returns true when setting is "true"
- **`showSeparators` / `showReportIssue` (4 tests):**
  - Default to true when no setting
  - Return false only when setting is explicitly "false"
- **`githubUrl` (2 tests):**
  - Returns default URL when no setting
  - Returns setting value when present
- **`brandName` / `logoUrl` / `faviconUrl` (2 tests):**
  - Return undefined when no setting
  - Return setting values when present

#### `stores/MatchmakingStore.spec.ts` — Matchmaking Store (13 tests)
Tests the matchmaking Pinia store's computed properties, friend filtering, and region preferences.
Mocks `useAuthStore`, `useApplicationSettingsStore` (via globalThis for Nuxt auto-imports), GraphQL client, WebRTC. Uses `createPinia()` + `setActivePinia()`.

- **`onlineFriends` (2 tests):**
  - Filters out Pending friends
  - Includes only friends in `onlinePlayerSteamIds`
- **`offlineFriends` (2 tests):**
  - Filters out Pending friends
  - Includes only friends NOT in `onlinePlayerSteamIds`
- **`lobbyInvites` (2 tests):**
  - Filters out lobby matching `me.current_lobby_id`
  - Returns empty when lobbies is empty
- **`currentLobby` (2 tests):**
  - Finds lobby matching `me.current_lobby_id`
  - Returns undefined when no match
- **`getRegionlatencyResult` (2 tests):**
  - Returns undefined when no latency data
  - Returns formatted latency and isLan flag
- **`togglePreferredRegion` (2 tests):**
  - Adds region and persists to localStorage
  - Removes existing region on second toggle
- **`updateMaxAcceptableLatency` (1 test):**
  - Updates ref and persists to localStorage

#### `stores/NotificationStore.spec.ts` — Notification Store (4 tests)
Tests the notification Pinia store's `hasNotifications` computed property.
Mocks `useAuthStore` (via globalThis), GraphQL client. Uses `createPinia()` + `setActivePinia()`.

- `hasNotifications` true when `team_invites` non-empty
- `hasNotifications` true when `tournament_team_invites` non-empty
- `hasNotifications` true when any notification has `is_read: false`
- `hasNotifications` false when all empty / all read

#### `stores/SearchStore.spec.ts` — Player Search Store (6 tests)
Tests the search Pinia store with MiniSearch integration for player search and filtering.
Mocks `useMatchmakingStore` (`playersOnline`). Uses `createPinia()` + `setActivePinia()`.

- Empty query returns first 10 players from `playersOnline`
- Empty query excludes players in exclude list
- Search query returns fuzzy-matched results
- Search excludes players in exclude list
- `onlineOnly` defaults to true
- `onlineOnly` reads from localStorage ("playerSearchOnlineOnly")

---

## CI/CD

GitHub Actions workflow (`.github/workflows/test.yml`) runs on push/PR to `main` and `develop`:
- Single `unit-tests` job: checkout → setup Node 20 → yarn install → vitest with coverage → upload coverage artifact
