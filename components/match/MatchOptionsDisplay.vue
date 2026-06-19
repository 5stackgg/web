<script lang="ts" setup>
import { defineComponent, h } from "vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import MiniMapDisplay from "~/components/MinIMapDisplay.vue";
import { useI18n } from "vue-i18n";

// Compact on/off status chip with an indicator dot — reads like a config
// readout rather than a plain "Yes/No".
const { t } = useI18n();
const BooleanPill = defineComponent({
  props: { value: { type: Boolean, default: false } },
  setup(props) {
    return () =>
      h("span", { class: ["settings-pill", props.value ? "is-on" : "is-off"] }, [
        h("span", { class: "settings-pill__dot" }),
        props.value ? t("common.boolean.yes") : t("common.boolean.no"),
      ]);
  },
});
</script>

<template>
  <template v-if="options.map_veto">
    <div class="my-3">
      <div class="flex gap-4">
        <MiniMapDisplay
          v-for="map in options.map_pool.maps"
          :key="map.id"
          :map="map"
        />
      </div>
    </div>

    <template v-if="showDetailsByDefault">
      <Separator />
    </template>
  </template>

  <Collapsible v-model:open="showDetails">
    <CollapsibleTrigger as-child v-if="!showDetailsByDefault">
      <button
        type="button"
        class="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 p-0 cursor-pointer"
      >
        <span
          class="w-1.5 h-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
        ></span>
        {{ $t("match.options.advanced_settings") }}
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="settings-grid-wrap mt-4">
        <div class="settings-grid">
          <!-- Game Settings -->
          <section class="settings-panel">
            <header class="settings-panel__head">
              <span class="settings-panel__tick"></span>
              {{ $t("match.options.group.game_settings") }}
            </header>
            <dl class="settings-panel__list">
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.type.label")
                }}</dt>
                <dd class="settings-row__value">{{ options.type }}</dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.best_of.label")
                }}</dt>
                <dd class="settings-row__value tabular-nums">{{
                  options.best_of
                }}</dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.max_rounds")
                }}</dt>
                <dd class="settings-row__value tabular-nums">{{
                  options.mr
                }}</dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.tv_delay")
                }}</dt>
                <dd class="settings-row__value tabular-nums">
                  {{ options.tv_delay }}
                  <span class="settings-row__unit">{{
                    $t("match.options.seconds")
                  }}</span>
                </dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.overtime")
                }}</dt>
                <dd><BooleanPill :value="options.overtime" /></dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.knife_round")
                }}</dt>
                <dd><BooleanPill :value="options.knife_round" /></dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.default_player_models")
                }}</dt>
                <dd><BooleanPill :value="options.default_models ?? false" /></dd>
              </div>
            </dl>
          </section>

          <!-- Control Settings -->
          <section class="settings-panel">
            <header class="settings-panel__head">
              <span class="settings-panel__tick"></span>
              {{ $t("match.options.group.control_settings") }}
            </header>
            <dl class="settings-panel__list">
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.timeout_setting")
                }}</dt>
                <dd class="settings-row__value">{{
                  options.timeout_setting
                }}</dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.tech_timeout_setting")
                }}</dt>
                <dd class="settings-row__value">{{
                  options.tech_timeout_setting
                }}</dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.ready_setting")
                }}</dt>
                <dd class="settings-row__value">{{ options.ready_setting }}</dd>
              </div>
              <div v-if="options.check_in_setting" class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.check_in_setting")
                }}</dt>
                <dd class="settings-row__value">{{
                  options.check_in_setting
                }}</dd>
              </div>
              <div v-if="options.match_mode" class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.advanced.match_mode.label")
                }}</dt>
                <dd class="settings-row__value">{{
                  options.match_mode === "auto"
                    ? $t("match.options.advanced.match_mode.options.auto")
                    : $t("match.options.advanced.match_mode.options.admin")
                }}</dd>
              </div>
              <div v-if="options.auto_cancellation != null" class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.advanced.auto_cancellation.label")
                }}</dt>
                <dd><BooleanPill :value="options.auto_cancellation" /></dd>
              </div>
              <div
                v-if="options.auto_cancellation && options.auto_cancel_duration != null"
                class="settings-row"
              >
                <dt class="settings-row__label">{{
                  $t(
                    "match.options.advanced.auto_cancellation.auto_cancel_duration.label",
                  )
                }}</dt>
                <dd class="settings-row__value tabular-nums">{{
                  options.auto_cancel_duration
                }}</dd>
              </div>
              <div
                v-if="options.auto_cancellation && options.live_match_timeout != null"
                class="settings-row"
              >
                <dt class="settings-row__label">{{
                  $t(
                    "match.options.advanced.auto_cancellation.live_match_timeout.label",
                  )
                }}</dt>
                <dd class="settings-row__value tabular-nums">{{
                  options.live_match_timeout
                }}</dd>
              </div>
            </dl>
          </section>

          <!-- Team Settings -->
          <section class="settings-panel">
            <header class="settings-panel__head">
              <span class="settings-panel__tick"></span>
              {{ $t("match.options.group.team_settings") }}
            </header>
            <dl class="settings-panel__list">
              <div class="settings-row">
                <dt class="settings-row__label">{{ $t("common.coaches") }}</dt>
                <dd><BooleanPill :value="options.coaches" /></dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.substitutes")
                }}</dt>
                <dd class="settings-row__value tabular-nums">{{
                  options.number_of_substitutes
                }}</dd>
              </div>
            </dl>
          </section>

          <!-- Veto Settings -->
          <section class="settings-panel">
            <header class="settings-panel__head">
              <span class="settings-panel__tick"></span>
              {{ $t("match.options.group.veto_settings") }}
            </header>
            <dl class="settings-panel__list">
              <div class="settings-row">
                <dt class="settings-row__label">{{ $t("common.map_veto") }}</dt>
                <dd><BooleanPill :value="options.map_veto" /></dd>
              </div>
              <div class="settings-row">
                <dt class="settings-row__label">{{
                  $t("match.options.region_veto")
                }}</dt>
                <dd><BooleanPill :value="options.region_veto" /></dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script lang="ts">
export default {
  props: {
    options: {
      type: Object,
      required: true,
    },
    showDetailsByDefault: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      showDetails: this.showDetailsByDefault,
    };
  },
};
</script>

<style scoped>
/* Reflow by the grid's own available width (not the viewport — the sidebar
   shrinks the container independently). Two columns by default, snapping to a
   single row of four only once there's genuine room. Never an awkward 3-up. */
.settings-grid-wrap {
  container-type: inline-size;
}

.settings-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@container (min-width: 56rem) {
  .settings-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.settings-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: var(--radius);
  background: linear-gradient(
    180deg,
    hsl(var(--card) / 0.35),
    hsl(var(--card) / 0.1)
  );
  padding: 0.875rem 1rem 0.5rem;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.settings-panel:hover {
  border-color: hsl(var(--tac-amber) / 0.35);
}

.settings-panel__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: hsl(var(--foreground));
}

.settings-panel__tick {
  width: 2px;
  height: 0.7rem;
  background: hsl(var(--tac-amber));
}

.settings-panel__list {
  display: flex;
  flex-direction: column;
}

.settings-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
}

.settings-row:last-child {
  border-bottom: 0;
}

.settings-row__label {
  flex: 1 1 auto;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  line-height: 1.3;
  color: hsl(var(--muted-foreground) / 0.85);
}

.settings-row__value {
  flex: 0 0 auto;
  text-align: right;
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.settings-row__unit {
  font-size: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
}

.settings-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.1rem 0.5rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.settings-pill :deep(.settings-pill__dot) {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
}

.settings-pill.is-on {
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.12);
  color: hsl(var(--tac-amber));
}

.settings-pill.is-on :deep(.settings-pill__dot) {
  background: hsl(var(--tac-amber));
}

.settings-pill.is-off {
  border-color: hsl(var(--border) / 0.7);
  background: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
}

.settings-pill.is-off :deep(.settings-pill__dot) {
  background: hsl(var(--muted-foreground) / 0.6);
}
</style>
