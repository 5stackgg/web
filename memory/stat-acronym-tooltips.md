---
name: stat-acronym-tooltips
description: How stat acronym tooltips (KPR/ADR/HLTV/KAST/UDR/etc.) are wired across match + player tables/charts
metadata:
  type: project
---

Stat acronym tooltips on tables/charts use the reusable `components/common/StatLabel.vue` (`<StatLabel stat="kpr" :label="..." />` or slot form). It looks up `stat_glossary.<stat>.{label,description}` in `i18n/locales/en.json` via `te()` and renders a `FiveStackToolTip` (self-contained — wraps its own TooltipProvider, works anywhere). If the glossary has no entry it degrades to a plain label, so wrapping a dynamic `:stat="axis.key"`/`:stat="row.key"` is safe even when only some keys resolve.

Glossary keys live at the top of en.json under `stat_glossary` (hltv, rating, adr, kpr, dpr, kast, udr, hs, far, elo, kda, k, a, d, kd, mkr, cl, cast, awp). Auto-import is OFF (see nuxt.config `components`), so every consumer must `import StatLabel from "~/components/common/StatLabel.vue"`.

Wrapped acronym headers in: match — LineupOverview, PlayerStatStrip, MatchTeamStats (UDR row), MatchRoles (AWP signal), LineupRadarComparison (axis cells); player — PlayerMatchesTable, PlayerWeaponsTable, PlayerRoleRadar (axis cells), PlayerCareerDuels, plus pre-existing PlayerMapsGrid + PlayerIntroDashboard.

Deliberately left alone: the richer inline `<Tooltip>` pattern in LineupOverview (HLTV/KAST/Survived), LineupAimStats, LineupTradeStats (keyed off `match.lineup.stats.tooltips.*` with title/description/calculation) — those already work. Skipped per-row compact labels (PlayerMatchRow) and repeated per-card labels (PlayerMapsGrid card footers) to avoid dotted-underline noise on every row; their table/header views already carry the tooltip. Full-word headers (utility, opening duels) were not wrapped — only acronyms. See [[player-stats-source-split]].

User feedback during review: do NOT tooltip the raw/self-explanatory stats — removed tooltips from K, D, A (single letters), "K / D / A" combined, "Avg K/D/A", HS%, and ELO. Keep tooltips on derived/abbreviated stats (HLTV, KAST, ADR, KPR, UDR, DPR, K/D ratio, MKR, FAR, AWP). The StatLabel underline was bumped to `decoration-muted-foreground/70` + `hover:decoration-foreground` so the tooltip affordance is visible. Also user wants "Rating" spelled out as "HLTV Rating" wherever a column/axis means the HLTV rating (changed `player_match.headers.rating`, `pages.players.detail.maps.col_rating`, `weapons_table.rating`, `match.radar.axes.rating`), and "/Rd" written as "/Round" in radar axes. Glossary `k/a/d/cl/cast` entries remain but are now mostly unused (harmless; StatLabel guards with `te()`).
