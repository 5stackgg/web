# Draft Games: WebSocket → GraphQL migration

## Why

Draft games are the **only** feature doing CRUD over websockets. Every other
feature (matches, lobbies, clips, friends) uses plain Hasura mutations + Hasura
event triggers + Postgres triggers. The websocket approach caused the bugs that
kicked this off:

- `draft-games:created` is `redis.publish("send-message-to-steam-id")` → fans
  out to **every** socket of the user → all tabs force-redirected.
- A fake `setCreating` loading flag with a 15s `setTimeout` faked a
  request/response over a fire-and-forget socket.
- Redirects fired ahead of the GraphQL subscription, flashing the
  "you have a draft room" modal on cancel.

## Target architecture (mirror `matches`)

`matches` is the template:

- **Client** runs `insert_matches_one` (plain mutation). Insert permission has a
  `check` predicate + `set: organizer_steam_id = x-hasura-user-id`, limited
  columns. The mutation **returns the id**, and the initiating tab navigates
  (`MatchForm.vue:573`). No broadcast, no fake loading.
- **One event trigger** `match_events` (insert/update/delete, all columns) →
  `{{HASURA_GRAPHQL_EVENT_HOOK}}` → NestJS `@HasuraEvent() match_events(data)`
  which branches on `data.op` and `data.new.status` vs `data.old.status` to run
  all orchestration (server provisioning, voice, notifications, jobs, cleanup).
- **DB triggers** + column defaults fill derived values.

Draft games get the same three layers:

1. **Web → plain mutations** on `draft_games`, `draft_game_players`,
   `draft_game_picks`. These table mutations already exist in the schema /
   `generated/zeus` — no codegen needed. State/detection stays on the existing
   Hasura subscriptions (`myDraftGame`, `currentRoom`).
2. **Postgres DB triggers** for derived values + validation-by-RAISE.
3. **One Hasura event trigger** `draft_game_events` (+ optionally on the child
   tables) → a NestJS `@HasuraEvent()` handler that runs the orchestration,
   reusing the existing `DraftGameService` / `DraftService` methods.

The websocket gateway (`draft-games.gateway.ts`) is deleted; the services stay
and are invoked from the event handler / DB triggers instead of the gateway.

## Layer assignment

**DB triggers (Postgres, in a migration):**
- `draft_games` BEFORE INSERT: derive `capacity = ExpectedPlayers[type]`; force
  `access = 'Private'` when `mode='Teams'` AND both team ids set.
- `draft_game_players` BEFORE INSERT: populate `elo_snapshot` from
  `players.elo[type]`; RAISE if the player is banned / in cooldown / in another
  match / already in a non-terminal draft (this single trigger enforces the
  eligibility + "one active draft" rule for create **and** join **and** add);
  determine `status` (Accepted / Waitlist / Requested) from the draft's
  `require_approval`, `status`, and current accepted count vs `capacity`.
- `draft_game_picks` AFTER INSERT (or `draft_game_players` update): advance
  `current_pick_lineup` per `draft_order` (snake vs alternating). (Turn math is
  simple enough for SQL; the heavier auto-pick/finalize stays in the event
  handler.)

**Event-trigger handler (`@HasuraEvent() draft_game_events`):**
- `draft_games` INSERT → schedule `DraftFillTimeout`; seed players for Teams /
  add lobby members for keep-together; broadcast.
- `draft_games` UPDATE `status` → `Drafting`/`SelectingCaptains`: captain
  selection, auto-split, begin drafting, schedule `DraftPickTimeout`.
- `draft_games` UPDATE `status` → `Canceled` (or DELETE): remove fill + all pick
  timers, clean up match_options, notify members.
- `draft_game_picks` INSERT: schedule next `DraftPickTimeout`; finalize → create
  the match when the draft completes.
- `draft_game_players` changes: waitlist promotion; notifications
  (`draft-games:added` / `:accepted` stay as redis pushes to the affected user).

**Hasura permissions (role `user`) — currently only SELECT exists:**
- `draft_games`: insert (`set host_steam_id = x-hasura-user-id`; columns: type,
  mode, access, regions, captain_selection, draft_order, require_approval,
  team_1_id, team_2_id, inner_squad, map_pool_id, min_elo, max_elo,
  match_options); update (host-only, e.g. settings while `status='Open'`, and
  `status` transitions start/cancel/extend); delete (host-only) if we model
  cancel as delete instead of `status='Canceled'`.
- `draft_game_players`: insert (self-join; host adds others — predicate on
  `draft_game.host_steam_id`); update (team-assign / approve — host or self);
  delete (leave = self, kick/deny = host).
- `draft_game_picks`: insert (captain-on-their-turn predicate, or validated by a
  DB trigger).

## Per-action mapping

| Action | Web mutation | DB trigger | Event handler |
|---|---|---|---|
| create | `insert_draft_games_one` (nested host player + match_options) → returns id, navigate | capacity, access lock, host-player elo/eligibility | fill timeout, seed/add players, broadcast |
| update | `update_draft_games_by_pk` | reconcile on mode/capacity change | broadcast |
| join | `insert_draft_game_players_one` (self) | eligibility + status determination | bump fill timeout |
| join-party | N `insert_draft_game_players` (or array insert) | same trigger per row | bump fill timeout |
| leave | `delete_draft_game_players_by_pk` (self) | — | host replacement / waitlist / cancel-if-mid-draft |
| cancel | `update_draft_games_by_pk { status: Canceled }` (host) | — | remove timers, cleanup, notify |
| extend | `update_draft_games_by_pk` (host) | cap to max lifetime | reschedule fill timeout |
| start | `update_draft_games_by_pk { status: Drafting/SelectingCaptains }` (host) | — | captain select, auto-split, begin, pick timer, finalize |
| pick | `insert_draft_game_picks_one` | advance current_pick_lineup | next pick timer, auto-assign last, finalize |
| add | `insert_draft_game_players_one` (host) | eligibility + status | notify added, clear other requests |
| kick | `delete_draft_game_players_by_pk` (host) | — | waitlist promotion, notify |
| team-assign | `update_draft_game_players_by_pk` | team-membership + capacity check | broadcast |
| approve | `update_draft_game_players_by_pk { status }` (host) | status determination | notify, bump timeout |
| deny | `delete_draft_game_players_by_pk` (host) | — | notify |

## Notifications stay as redis pushes (legit websocket use)

`draft-games:added` / `:accepted` / `:canceled` are server→affected-user pushes
(like chat) and stay. They're emitted from the **services** (kept), not the
gateway (deleted). The web keeps those toast listeners. `draft-games:error` and
`:created` go away (errors come from the mutation rejection; created returns the
id to the caller).

## Sequencing (slice by slice, each applied + tested in the dev stack)

1. **cancel** — cleanest: `update status=Canceled` + host update permission +
   event handler for timer/cleanup. Integrates with the already-shipped
   subscription-driven leave (page bails to /play on `status==='Canceled'`).
2. leave, deny, kick — delete-based, host/self permissions.
3. join, add, approve — insert/update + eligibility DB trigger.
4. extend, start, team-assign — status/update + event handler.
5. pick — pick insert + turn DB trigger + finalize event handler.
6. create — insert (nested) + derive triggers + fill-timeout/seed event handler.
7. Delete the gateway; remove remaining draft socket plumbing.

## Status — COMPLETE (needs `hasura metadata apply` + migration + api restart to test)

**DB triggers** — `api/hasura/triggers/draft_games.sql` + `draft_game_players.sql`
(`tbi_`/`tai_`/`tad_`, applied idempotently by `hasura.service`): capacity,
access lock, elo snapshot, player-status determination via the Hasura session
actor, clear-other-drafts, host replacement, waitlist promotion, mid-draft
cancel, cancel-on-empty.

**Hasura** — `user` insert/update/delete permissions on all 3 tables; event
triggers `draft_game_events` (draft_games) + `draft_game_pick_events`
(draft_game_picks); actions `createDraftGame` / `updateDraftGame` /
`joinDraftGame` / `joinDraftGameAsParty` / `extendDraftGame`.

**API** — `draft-games.gateway.ts` deleted; new `draft-games.controller.ts`
holds the two `@HasuraEvent` handlers + the 5 `@HasuraAction`s, reusing the
existing services. `draft.service`: `beginDraft` accepts the `Filled` start
signal; `performPick` is orchestration-only (no insert); `autoPick` inserts a
pick row; new `applyPick`. `draft-game.service`: new `onDraftCanceled`.

**Web** — `DraftGamesStore`: every action is GraphQL now. Plain mutations:
cancel/leave/kick/deny/add/approve/teamAssign, **start** (`update status=Filled`),
**pick** (`insert_draft_game_picks_one`). Actions:
create/update/join/joinParty/extend. `create` returns the id → the creating tab
navigates (`CreateDraftGame`, `DraftGames.rehost`). Dead websocket waiter
machinery removed; `Socket.ts` keeps only the `added`/`canceled` notification
toasts.

**Mapping mutation vs action:** pure CRUD / state-transition → plain mutation +
DB triggers; complex app logic (match_options, settings reconciliation, join
access-control, party resolution, BullMQ timer reschedule) → Hasura action
reusing the tested service. No draft CRUD is on websockets anymore.

**No draft websocket listeners remain.** Lobby expiry is the `expires_at`
column (migration `1860000000300_draft_games_expires_at`; set by `tbi_draft_games`,
capped to created+120m by `tbu_draft_games`) delivered via subscription. Expiry
enforcement is a once-a-minute cron (`CleanExpiredDraftGames`) that deletes any
Open, past-`expires_at` draft (full lobbies included) — no per-draft BullMQ fill
timer. There is no `Canceled` status: leaving/teardown deletes the row
(`tad_draft_game_players`), and an unready `Open→Filled` start is rejected by
`tbu_draft_games` so a draft can never get stuck. Extend is a
plain `update expires_at` mutation. Cancel is `delete_draft_games_by_pk`; the
subscription (currentRoom → null / myDraftGame gone) drives the leave,
`tad_draft_games` deletes the orphaned match_options, and the DELETE event clears
the pick timer. The pick row carries only `picked_steam_id` — `tbi_draft_game_picks`
derives `captain_steam_id` + `lineup` from the session actor + `current_pick_lineup`
and rejects out-of-turn picks (like the map-veto trigger). Only the 30s pick timer
remains on BullMQ (too fine-grained for a minute cron).

## Follow-ups to verify in the stack
- Caller-side error toasts: mutation/action rejections replace the old
  `draft-games:error` toast — `CreateDraftGame` handles it; add the same to
  `DraftRoom` actions if desired.
- Host-mode assignment goes through `teamAssign`; confirm the Host-mode
  finalize path.
- Dead service methods the deleted gateway used (`leaveDraftGame`, `kickPlayer`,
  `approveRequest`, `addPlayer`, `denyRequest`, `cancelByHost`, `teamAssign`,
  `expireFillTimeout`, `cancelDraftGame`, `promoteFromWaitlist`) are now replaced
  by mutations + triggers — safe to delete in a follow-up sweep.

## Cannot be verified without the dev stack

This rearchitects tested real-time logic across api + Hasura metadata + DB
migrations + web. Each slice needs `hasura metadata apply`, the migration run,
the NestJS api restarted, and the flow exercised. The code can be written here
but must be applied and tested in the running stack.
