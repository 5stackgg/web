import { useI18n } from "vue-i18n";
import { dateLocale } from "~/utilities/dateLocale";
import { durationParts } from "~/utilities/communityStats";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function useCommunityFormat() {
  const { t } = useI18n();

  function played(totalSeconds: number | null | undefined) {
    const { hours, minutes, seconds } = durationParts(totalSeconds ?? 0);

    if (hours > 0) {
      return t("community.format.hours_minutes", {
        hours: hours.toLocaleString(dateLocale()),
        minutes: String(minutes).padStart(2, "0"),
      });
    }

    if (minutes > 0) {
      return t("community.format.minutes", { minutes });
    }

    return t("community.format.seconds", { seconds });
  }

  function hours(totalSeconds: number | null | undefined) {
    const value = (totalSeconds ?? 0) / 3600;

    if (value > 0 && value < 1) {
      return t("community.format.minutes", {
        minutes: Math.max(1, Math.round(value * 60)),
      });
    }

    return t("community.format.hours", {
      hours: value.toLocaleString(dateLocale(), {
        maximumFractionDigits: value < 10 ? 1 : 0,
      }),
    });
  }

  function count(value: number | null | undefined) {
    return (value ?? 0).toLocaleString(dateLocale());
  }

  // A coarse time is one the api rounded down to the hour, so anything under an
  // hour old reads as "within the last hour" rather than a fake minute count.
  function ago(
    iso: string | null | undefined,
    options: { coarse?: boolean; now?: number } = {},
  ) {
    if (!iso) {
      return "";
    }

    const now = options.now ?? Date.now();
    const elapsed = Math.max(0, now - Date.parse(iso));
    const rtf = new Intl.RelativeTimeFormat(dateLocale(), {
      numeric: "auto",
      style: "short",
    });

    if (elapsed < HOUR && options.coarse) {
      return t("community.format.within_hour");
    }

    if (elapsed < MINUTE) {
      return t("community.format.just_now");
    }

    if (elapsed < HOUR) {
      return rtf.format(-Math.floor(elapsed / MINUTE), "minute");
    }

    if (elapsed < DAY) {
      return rtf.format(-Math.floor(elapsed / HOUR), "hour");
    }

    const startOfDay = (value: Date) =>
      new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
      ).getTime();
    const days = Math.round(
      (startOfDay(new Date(now)) - startOfDay(new Date(iso))) / DAY,
    );

    if (days < 14) {
      return rtf.format(-Math.max(1, days), "day");
    }

    if (days < 60) {
      return rtf.format(-Math.floor(days / 7), "week");
    }

    if (days < 365) {
      return rtf.format(-Math.floor(days / 30), "month");
    }

    return rtf.format(-Math.floor(days / 365), "year");
  }

  function exact(iso: string | null | undefined) {
    if (!iso) {
      return "";
    }

    return new Date(iso).toLocaleString(dateLocale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function day(iso: string | Date) {
    return new Date(iso).toLocaleDateString(dateLocale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function time(iso: string | Date) {
    return new Date(iso).toLocaleTimeString(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function date(iso: string | Date) {
    return new Date(iso).toLocaleDateString(dateLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return { played, hours, count, ago, exact, day, time, date };
}
