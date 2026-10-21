import { dateLocale } from "~/utilities/dateLocale";

export type DurationUnit = "day" | "hour" | "minute" | "second";

const UNITS: DurationUnit[] = ["day", "hour", "minute", "second"];

const UNIT_MS: Record<DurationUnit, number> = {
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1_000,
};

const FALLBACK: Record<DurationUnit, string> = {
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

export function durationUnit(
  value: number,
  unit: DurationUnit,
  options: Intl.NumberFormatOptions = {},
) {
  try {
    return new Intl.NumberFormat(dateLocale(), {
      style: "unit",
      unit,
      unitDisplay: "narrow",
      ...options,
    }).format(value);
  } catch {
    return `${value}${FALLBACK[unit]}`;
  }
}

type CompactDurationOptions = {
  largest?: DurationUnit;
  smallest?: DurationUnit;
  parts?: 1 | 2;
  pad?: boolean;
};

export default function compactDuration(
  ms: number,
  {
    largest = "day",
    smallest = "second",
    parts = 1,
    pad = false,
  }: CompactDurationOptions = {},
) {
  const units = UNITS.slice(
    UNITS.indexOf(largest),
    UNITS.indexOf(smallest) + 1,
  );
  let rest =
    Math.floor(Math.max(0, ms || 0) / UNIT_MS[smallest]) * UNIT_MS[smallest];
  const amounts = units.map((unit) => {
    const amount = Math.floor(rest / UNIT_MS[unit]);
    rest -= amount * UNIT_MS[unit];
    return amount;
  });
  const first = amounts.findIndex((amount) => amount > 0);
  const lead = first === -1 ? units.length - 1 : first;

  return units
    .slice(lead, lead + parts)
    .map((unit, index) =>
      durationUnit(
        amounts[lead + index],
        unit,
        pad && index > 0 ? { minimumIntegerDigits: 2 } : {},
      ),
    )
    .join(" ");
}
