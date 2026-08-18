<template>
  <div class="flex h-full flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-1.5 text-sm">
          {{ $t("pages.system_telemetry.distribution.versions") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.distribution.versions_hint") }}
          </FiveStackToolTip>
        </div>
        <div class="mt-2 text-3xl font-semibold leading-none">
          {{ current ? `${currentShare}%` : "—" }}
        </div>
        <div class="mt-1 text-[0.72rem] text-muted-foreground">
          {{ $t("pages.system_telemetry.distribution.on_current") }}
        </div>
      </div>

      <div v-if="behind" class="text-right">
        <div
          class="font-sans text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("pages.system_telemetry.distribution.behind") }}
        </div>
        <div class="mt-1 text-xl font-semibold leading-none">
          {{ behind }}
        </div>
      </div>
    </div>

    <FleetMeter v-if="rows.length" :segments="segments" />

    <ul v-if="rows.length" class="space-y-1.5">
      <li
        v-for="row of rows"
        :key="row.version"
        class="flex items-baseline justify-between gap-3 text-[0.78rem]"
      >
        <span class="flex min-w-0 items-center gap-2">
          <span
            class="shrink-0 rounded-[3px] px-1.5 py-0.5 font-sans text-[0.58rem] uppercase tracking-[0.12em]"
            :class="
              row.isCurrent
                ? 'bg-[hsl(var(--tac-step-1)/0.18)] text-[hsl(var(--tac-step-1))]'
                : 'bg-muted/50 text-muted-foreground'
            "
          >
            {{ row.tag }}
          </span>
          <span class="truncate font-mono text-muted-foreground">
            {{ row.short }}
          </span>
        </span>
        <span class="shrink-0 font-mono tabular-nums">
          {{ format(row.installs) }}
        </span>
      </li>
    </ul>

    <div
      v-else
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
    >
      {{ $t("pages.system_telemetry.no_data") }}
    </div>
  </div>
</template>

<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import FleetMeter from "./FleetMeter.vue";
</script>

<script lang="ts">
export default {
  props: {
    versions: {
      type: Array,
      required: true,
    },
    limit: {
      type: Number,
      default: 5,
    },
  },
  methods: {
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
  },
  computed: {
    total() {
      return this.versions.reduce(
        (sum, version) => sum + (version.installs ?? 0),
        0,
      );
    },
    // Newest first by position, never by reading `rank` as an absolute. Rank is
    // assigned server-side and is only guaranteed to order the list -- treating
    // 1 as "the current build" silently blanks the whole panel if the list ever
    // starts higher than 1.
    ordered() {
      return [...this.versions].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    },
    current() {
      return this.ordered[0];
    },
    currentShare() {
      if (!this.total) {
        return 0;
      }

      return Math.round(((this.current?.installs ?? 0) / this.total) * 100);
    },
    behind() {
      return this.total - (this.current?.installs ?? 0);
    },
    // Three bands rather than one slot per build: past "a release or two back"
    // the distance stops being actionable and it is all just old.
    segments() {
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.distribution.${key}`);
      const at = (index: number) => this.ordered[index]?.installs ?? 0;

      return [
        {
          label: t("build_current"),
          value: at(0),
          color: "hsl(var(--tac-step-1))",
        },
        {
          label: t("build_previous"),
          value: at(1),
          color: "hsl(var(--tac-step-3))",
        },
        {
          label: t("build_older"),
          value: this.ordered
            .slice(2)
            .reduce((sum, version) => sum + (version.installs ?? 0), 0),
          color: "hsl(var(--muted-foreground) / 0.25)",
        },
      ];
    },
    rows() {
      return this.ordered.slice(0, this.limit).map((version, index) => ({
        ...version,
        isCurrent: index === 0,
        short: (version.version ?? "").slice(0, 7),
        tag:
          index === 0
            ? this.$t("pages.system_telemetry.distribution.build_current")
            : `-${index}`,
      }));
    },
  },
};
</script>
