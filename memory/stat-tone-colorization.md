---
name: stat-tone-colorization
description: Red→amber→green tone ramp for RadialStat rings and HLTV/K-D text tint
metadata:
  type: reference
---

`utils/statTiers.ts` is the home of the continuous red→amber→green colorization (added on `feature/stats-galore`):

- `statScore(value, good, bad)` → 0..1 quality (null if non-finite); lower-is-better passes good < bad.
- `toneColor(score)` → `hsl(...)` on a two-segment ramp: 0 red → 0.5 amber(hue 48) → 1 green(hue 142).
- `kdColor(value)` / `hltvColor(value)` → convenience tints using `KD_RANGE {good:1.3,bad:0.8}` / `HLTV_RANGE {good:1.2,bad:0.85}`; return `undefined` when unusable so callers can spread into `:style` safely.

`components/charts/RadialStat.vue` takes a `:score` prop (0..1). When set it drives the ring's **color, opacity (floor 0.35 → 1), AND arc length** all from the score — a mediocre stat reads as a short dim reddish arc instead of a loud full-white ring. Falls back to `:percentage`/`strokeColor` when `score` is absent. The four ring scales: KAST (80/55), HS% (55/5 — deliberately forgiving, 20% reads orange not red), duel win% (58/42), clutch win% (50/15), maps rating (1.2/0.85).

HLTV/K-D **text** tint (`kdColor`/`hltvColor` into `:style="{ color }"`) is applied app-wide: intro K-D card, LineupOverviewRow, LineupBuyTypes, PlayerStatStrip, MatchScoreboardOverlay, ReplayViewer KDR tooltip (added `kdrNum`), PlayerMatchRow, PlayerWeaponsTable, PlayerMapsGrid, PlayerCareerDuels, TeamCareerStats, tournament StageStandings + TournamentResults (replaced their old binary green/red `kdr>=1` style). Chevrons (`StatChevron`) are kept alongside the tint. Revives the old `utilities/kdrColor.ts` (deleted in the "enhanced stats" commit) as a smooth gradient. Related: [[player-stats-source-split]], [[stat-acronym-tooltips]].
