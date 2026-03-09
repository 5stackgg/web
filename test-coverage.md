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

#### `composables/useSound.spec.ts` — Sound Effects (5 tests)
Tests the sound playback composable with volume and mute controls.
- Plays sound effect by name
- Respects mute setting
- Adjusts volume level
- Handles missing sound files gracefully
- Caches audio instances for reuse

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

## CI/CD

GitHub Actions workflow (`.github/workflows/test.yml`) runs on push/PR to `main` and `develop`:
- Single `unit-tests` job: checkout → setup Node 20 → yarn install → vitest with coverage → upload coverage artifact
