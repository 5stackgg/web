export type SanctionKind = "ban" | "mute" | "gag";

type SanctionFlags = {
  is_banned?: boolean | null;
  is_muted?: boolean | null;
  is_gagged?: boolean | null;
};

const SANCTION_FLAGS: Array<[SanctionKind, keyof SanctionFlags]> = [
  ["ban", "is_banned"],
  ["mute", "is_muted"],
  ["gag", "is_gagged"],
];

export function activeSanctions(
  player: SanctionFlags | null | undefined,
): SanctionKind[] {
  if (!player) {
    return [];
  }

  return SANCTION_FLAGS.filter(([, flag]) => !!player[flag]).map(
    ([kind]) => kind,
  );
}

export function durationParts(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));

  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export function sinceSeconds(iso: string | null | undefined, now: number) {
  if (!iso) {
    return 0;
  }

  const started = Date.parse(iso);

  return Number.isNaN(started) ? 0 : Math.max(0, (now - started) / 1000);
}

export function killDeathRatio(kills: number, deaths: number) {
  return (kills / Math.max(deaths, 1)).toFixed(2);
}

export interface HourBucket {
  hour: string;
  seconds: number;
  players: number;
}

export interface DayBucket {
  key: string;
  date: Date;
  seconds: number;
  peakPlayers: number;
  today: boolean;
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// The api reports whole UTC hours; a viewer's day starts at their own
// midnight, so the buckets are regrouped by the local date each hour began in.
// Players can't be summed across hours (the same player is in many), so a
// day carries its busiest hour instead of a unique-player count.
export function dailyActivity(
  hourly: HourBucket[],
  now: Date = new Date(),
  days = 7,
): DayBucket[] {
  const result: DayBucket[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset,
    );

    result.push({
      key: localDayKey(date),
      date,
      seconds: 0,
      peakPlayers: 0,
      today: offset === 0,
    });
  }

  const byKey = new Map(result.map((day) => [day.key, day]));

  for (const bucket of hourly) {
    const day = byKey.get(localDayKey(new Date(bucket.hour)));

    if (!day) {
      continue;
    }

    day.seconds += bucket.seconds;
    day.peakPlayers = Math.max(day.peakPlayers, bucket.players);
  }

  return result;
}

export function niceScale(maxValue: number, targetTicks = 4) {
  const top = maxValue > 0 ? maxValue : 1;
  const rough = top / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;

  let step = 10 * magnitude;

  if (normalized <= 1) {
    step = magnitude;
  } else if (normalized <= 2) {
    step = 2 * magnitude;
  } else if (normalized <= 5) {
    step = 5 * magnitude;
  }

  const max = Math.ceil(top / step - 1e-9) * step;
  const ticks: number[] = [];

  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }

  return { max, ticks };
}

// Each account's peers on the same IP, so a row can say who else is behind it.
export function ipPeers<T>(
  rows: T[],
  idOf: (row: T) => string,
  ipOf: (row: T) => string | null | undefined,
): Map<string, T[]> {
  const byIp = new Map<string, T[]>();

  for (const row of rows) {
    const ip = ipOf(row);

    if (!ip) {
      continue;
    }

    const list = byIp.get(ip) ?? [];

    if (!list.some((existing) => idOf(existing) === idOf(row))) {
      list.push(row);
    }

    byIp.set(ip, list);
  }

  const peers = new Map<string, T[]>();

  for (const row of rows) {
    const ip = ipOf(row);
    const others = ip
      ? (byIp.get(ip) ?? []).filter((other) => idOf(other) !== idOf(row))
      : [];

    peers.set(idOf(row), others);
  }

  return peers;
}
