import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { order_by } from "~/generated/zeus";

export type StreamMatchRow = {
  name: string;
  score: number | null;
  muted: boolean;
};

export type StreamMatchSummary = {
  eyebrow: string | null;
  rows: [StreamMatchRow, StreamMatchRow];
  meta: string | null;
  poster: string | null;
};

// Just what the stream caption shows — kept small because it runs for
// every viewer of a stream, next to the video.
const matchFields = {
  id: true,
  status: true,
  scheduled_at: true,
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  options: { best_of: true, type: true },
  lineup_1: { name: true },
  lineup_2: { name: true },
  tournament_brackets: [
    { limit: 1 },
    { stage: { tournament: { name: true } } },
  ],
  match_maps: [
    { order_by: [{ order: order_by.asc }] },
    {
      id: true,
      status: true,
      is_current_map: true,
      lineup_1_score: true,
      lineup_2_score: true,
      winning_lineup_id: true,
      map: { name: true, label: true, poster: true },
    },
  ],
};

const FINAL_STATUSES = ["Finished", "Tie", "Forfeit", "Surrendered"];
const PRE_LIVE_STATUS_KEYS: Record<string, string> = {
  Veto: "veto",
  WaitingForCheckIn: "check_in",
  WaitingForServer: "waiting_for_server",
  PickingPlayers: "picking_players",
};
const MAP_OVER_STATUSES = ["Finished", "WaitingForTV", "UploadingDemo"];

// Live mode follows a match (`matchId`); replay mode describes one finished
// map (`matchMapId`), which is what demo playback shows.
export function useStreamMatchSummary(
  source: () => { matchId?: string | null; matchMapId?: string | null },
) {
  const { t, locale } = useI18n();
  const { client } = useApolloClient();

  const match = ref<any | null>(null);
  const replayMap = ref<any | null>(null);
  let subscription: { unsubscribe: () => void } | undefined;

  function stop() {
    subscription?.unsubscribe();
    subscription = undefined;
  }

  watch(
    () => [source().matchId, source().matchMapId] as const,
    async ([matchId, matchMapId]) => {
      stop();
      match.value = null;
      replayMap.value = null;
      if (matchMapId) {
        try {
          const { data } = await client.query({
            query: generateQuery({
              match_maps_by_pk: [
                { id: matchMapId },
                {
                  id: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                  map: { name: true, label: true, poster: true },
                  match: matchFields,
                },
              ],
            } as any),
          });
          if (source().matchMapId !== matchMapId) return;
          replayMap.value = (data as any)?.match_maps_by_pk ?? null;
          match.value = replayMap.value?.match ?? null;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[stream-match-summary] query error", err);
        }
        return;
      }
      if (!matchId) return;
      subscription = client
        .subscribe({
          query: generateSubscription({
            matches_by_pk: [{ id: matchId }, matchFields],
          } as any),
        })
        .subscribe({
          next: (result: any) => {
            match.value = result?.data?.matches_by_pk ?? null;
          },
          error: (err: any) => {
            // eslint-disable-next-line no-console
            console.error("[stream-match-summary] subscription error", err);
          },
        });
    },
    { immediate: true },
  );

  onBeforeUnmount(stop);

  const mapLabel = (mm: any): string | null =>
    mm?.map?.label || mm?.map?.name || null;

  const join = (parts: Array<string | null | false | undefined>) =>
    parts.filter(Boolean).join(" · ") || null;

  function startsAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const sameDay = d.toDateString() === new Date().toDateString();
    return d.toLocaleString(locale.value, {
      ...(sameDay ? {} : { weekday: "short" }),
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const summary = computed<StreamMatchSummary | null>(() => {
    const m = match.value;
    if (!m) return null;

    const maps: any[] = m.match_maps ?? [];
    const bestOf: number = m.options?.best_of ?? 1;
    const event =
      m.tournament_brackets?.[0]?.stage?.tournament?.name ??
      m.options?.type ??
      null;
    const bestOfLabel =
      bestOf > 1 ? t("match.stream.card.best_of", { count: bestOf }) : null;
    const mapOf = (mm: any) => {
      const idx = maps.findIndex((x) => x.id === mm?.id);
      return bestOf > 1 && idx >= 0
        ? t("match.stream.card.map_of", { current: idx + 1, total: bestOf })
        : null;
    };
    const rounds = (mm: any) =>
      t("match.stream.card.rounds", {
        count: (mm?.lineup_1_score ?? 0) + (mm?.lineup_2_score ?? 0),
      });
    const rows = (
      scores: [number | null, number | null],
      winnerId?: string | null,
    ): [StreamMatchRow, StreamMatchRow] => [
      {
        name: m.lineup_1?.name ?? "",
        score: scores[0],
        muted: !!winnerId && winnerId !== m.lineup_1_id,
      },
      {
        name: m.lineup_2?.name ?? "",
        score: scores[1],
        muted: !!winnerId && winnerId !== m.lineup_2_id,
      },
    ];

    const replay = replayMap.value;
    if (replay) {
      return {
        eyebrow: join([t("match.stream.card.replay"), event, bestOfLabel]),
        rows: rows(
          [replay.lineup_1_score ?? 0, replay.lineup_2_score ?? 0],
          replay.winning_lineup_id,
        ),
        meta: join([mapLabel(replay), rounds(replay), mapOf(replay)]),
        poster: replay.map?.poster ?? null,
      };
    }

    const current =
      maps.find((mm) => mm.is_current_map) ??
      [...maps].reverse().find((mm) => mm.winning_lineup_id) ??
      null;
    const poster = current?.map?.poster ?? maps[0]?.map?.poster ?? null;
    const eyebrow = join([event, bestOfLabel]);

    if (FINAL_STATUSES.includes(m.status)) {
      const played = maps.filter(
        (mm) => (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > 0,
      );
      const suffix =
        m.status === "Forfeit"
          ? t("match.stream.card.forfeit")
          : m.status === "Surrendered"
            ? t("match.stream.card.surrendered")
            : null;
      if (bestOf > 1) {
        const won = (lineupId: string) =>
          maps.filter((mm) => mm.winning_lineup_id === lineupId).length;
        return {
          eyebrow: join([t("match.stream.card.final"), eyebrow]),
          rows: rows(
            [won(m.lineup_1_id), won(m.lineup_2_id)],
            m.winning_lineup_id,
          ),
          meta: join([
            ...played.map(
              (mm) =>
                `${mapLabel(mm)} ${mm.lineup_1_score ?? 0}–${mm.lineup_2_score ?? 0}`,
            ),
            suffix,
          ]),
          poster,
        };
      }
      const mm = current ?? played[played.length - 1] ?? null;
      return {
        eyebrow: join([t("match.stream.card.final"), eyebrow]),
        rows: rows(
          mm ? [mm.lineup_1_score ?? 0, mm.lineup_2_score ?? 0] : [null, null],
          m.winning_lineup_id,
        ),
        meta: join([mapLabel(mm), mm && rounds(mm), suffix]),
        poster,
      };
    }

    if (m.status === "Canceled") {
      return {
        eyebrow,
        rows: rows([null, null]),
        meta: t("match.stream.card.canceled"),
        poster,
      };
    }

    if (m.status === "Live" && current) {
      const scores: [number, number] = [
        current.lineup_1_score ?? 0,
        current.lineup_2_score ?? 0,
      ];
      const round = t("match.stream.card.round", {
        round: scores[0] + scores[1] + 1,
      });
      switch (current.status) {
        case "Warmup":
          return {
            eyebrow,
            rows: rows([null, null]),
            meta: join([mapLabel(current), t("match.stream.card.warmup"), mapOf(current)]),
            poster,
          };
        case "Knife":
          return {
            eyebrow,
            rows: rows([null, null]),
            meta: join([mapLabel(current), t("match.stream.card.knife"), mapOf(current)]),
            poster,
          };
        case "Scheduled":
          return {
            eyebrow,
            rows: rows([null, null]),
            meta: join([mapLabel(current), t("match.stream.card.up_next"), mapOf(current)]),
            poster,
          };
        default:
          return {
            eyebrow,
            rows: rows(scores),
            meta: join([
              mapLabel(current),
              MAP_OVER_STATUSES.includes(current.status)
                ? t("match.stream.card.map_over")
                : join([
                    current.status === "Overtime" &&
                      t("match.stream.card.overtime"),
                    current.status === "Paused" &&
                      t("match.stream.card.paused"),
                    round,
                  ]),
              mapOf(current),
            ]),
            poster,
          };
      }
    }

    const preLive = PRE_LIVE_STATUS_KEYS[m.status];
    return {
      eyebrow,
      rows: rows([null, null]),
      meta: join([
        mapLabel(current),
        preLive
          ? t(`match.stream.card.${preLive}`)
          : m.scheduled_at
            ? t("match.stream.card.starts_at", { time: startsAt(m.scheduled_at) })
            : t("match.stream.card.scheduled"),
      ]),
      poster,
    };
  });

  return { summary };
}
