<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Fold } from "~/components/ui/transitions";
import { RotateCcw, ShieldAlert } from "lucide-vue-next";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SanctionLadderEditor from "~/components/settings/SanctionLadderEditor.vue";
import {
  cloneSanctionPolicy,
  sanctionPoliciesEqual,
  type SanctionPolicy,
  type SanctionScope,
  type SanctionSource,
} from "~/utilities/sanctions";

/**
 * One `e_sanction_sources` row rendered as a settings section. The page loops
 * the table rather than hardcoding the three shipped sources, so a fourth one
 * added server-side appears here with no frontend change — which is why every
 * label falls back to the row's own `description` when there is no translation
 * for that source key.
 */
const props = defineProps<{
  source: SanctionSource;
  scopes: SanctionScope[];
  policy: SanctionPolicy;
  defaults: SanctionPolicy;
}>();

const emit = defineEmits<{
  (e: "update:policy", value: SanctionPolicy): void;
}>();

const { t, te } = useI18n();

const i18nBase = `pages.settings.application.sanctions.sources.${props.source.value}`;

const title = computed(() =>
  te(`${i18nBase}.title`)
    ? t(`${i18nBase}.title`)
    : props.source.value.replace(/_/g, " "),
);

// The DB `description` is the contract's own plain-language sentence; a
// translated override is preferred when one exists for a shipped source.
const description = computed(() =>
  te(`${i18nBase}.description`)
    ? t(`${i18nBase}.description`)
    : props.source.description,
);

const scopeDescription = computed(
  () =>
    props.scopes.find((scope) => scope.value === props.policy.scope)
      ?.description ?? "",
);

function scopeLabel(scope: SanctionScope): string {
  const key = `pages.settings.application.sanctions.scopes.${scope.value}`;
  return te(key) ? t(key) : scope.description;
}

const isDefault = computed(() =>
  sanctionPoliciesEqual(props.policy, props.defaults),
);

// Singular gets its own KEY rather than vue-i18n's `a | b` pipe form: the pipe
// form needs the `$t(key, plural, named)` overload, which is not in the i18n
// types this repo type-checks against (see the pre-existing TS2554 on
// components/MatchTableRow.vue's `$t("clips.clip_count", clipCount)`).
const thresholdHint = computed(() => {
  const free = props.policy.threshold - 1;
  if (free < 1) {
    return t("pages.settings.application.sanctions.threshold.first_offence");
  }
  const base = "pages.settings.application.sanctions.threshold.free_passes";
  return t(free === 1 ? `${base}_one` : base, { count: free });
});

const windowHint = computed(() => {
  if (props.policy.window_days === 0) {
    return t("pages.settings.application.sanctions.window.never");
  }
  const base = "pages.settings.application.sanctions.window.decays";
  return t(props.policy.window_days === 1 ? `${base}_one` : base, {
    count: props.policy.window_days,
  });
});

/**
 * `vac_ban` at scope `both` writes a real platform ban row; anything narrower
 * writes only a scoped cooldown and the account keeps the other half of the
 * platform. That is a big behavioural change hidden inside a dropdown, so it is
 * called out the moment the scope leaves `both`.
 */
const platformBanNarrowed = computed(
  () => props.source.writes_platform_ban && props.policy.scope !== "both",
);

function patch(changes: Partial<SanctionPolicy>) {
  emit("update:policy", { ...cloneSanctionPolicy(props.policy), ...changes });
}

function toggleEnabled() {
  patch({ enabled: !props.policy.enabled });
}

// An emptied number box must not save as NaN. Threshold floors at 1 (the API
// clamps it there anyway) and the window floors at 0, which is its own
// meaningful value: never decays.
function setThreshold(raw: string | number) {
  const parsed = Number(String(raw).trim());
  patch({
    threshold: Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1,
  });
}

function setWindowDays(raw: string | number) {
  const parsed = Number(String(raw).trim());
  patch({
    window_days: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
  });
}
</script>

<template>
  <SettingsSection
    :id="`sanction-${source.value}`"
    :title="title"
    :description="description"
    clickable-header
    @header-click="toggleEnabled"
  >
    <template #action>
      <Switch
        :model-value="policy.enabled"
        @update:model-value="toggleEnabled"
      />
    </template>

    <Fold :open="policy.enabled">
      <div class="grid gap-6">
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="grid gap-1.5">
            <label class="text-sm font-medium">
              {{ $t("pages.settings.application.sanctions.threshold.label") }}
            </label>
            <Input
              type="number"
              min="1"
              inputmode="numeric"
              :model-value="policy.threshold"
              @update:model-value="setThreshold"
            />
            <p class="text-xs text-muted-foreground/70">{{ thresholdHint }}</p>
          </div>

          <div class="grid gap-1.5">
            <label class="text-sm font-medium">
              {{ $t("pages.settings.application.sanctions.window.label") }}
            </label>
            <Input
              type="number"
              min="0"
              inputmode="numeric"
              :model-value="policy.window_days"
              @update:model-value="setWindowDays"
            />
            <!-- 0 is not "no window", it is an infinite one. Said outright,
                 because the number alone reads as the feature being off. -->
            <p class="text-xs text-muted-foreground/70">{{ windowHint }}</p>
          </div>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium">
            {{ $t("pages.settings.application.sanctions.ladder.label") }}
          </label>
          <SanctionLadderEditor
            :model-value="policy.durations"
            @update:model-value="(durations) => patch({ durations })"
          />
        </div>

        <div class="grid max-w-sm gap-1.5">
          <label class="text-sm font-medium">
            {{ $t("pages.settings.application.sanctions.scope.label") }}
          </label>
          <Select
            :model-value="policy.scope"
            @update:model-value="(scope) => patch({ scope: String(scope) })"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="scope in scopes"
                  :key="scope.value"
                  :value="scope.value"
                >
                  {{ scopeLabel(scope) }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground/70">
            {{ scopeDescription }}
          </p>
        </div>

        <p
          v-if="platformBanNarrowed"
          class="flex items-start gap-2.5 border-l-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.07)] px-3.5 py-2.5 text-[0.82rem] leading-snug"
        >
          <ShieldAlert
            class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]"
          />
          <span>{{
            $t("pages.settings.application.sanctions.platform_ban_narrowed")
          }}</span>
        </p>
      </div>
    </Fold>

    <div v-if="!isDefault" class="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="gap-1.5 text-muted-foreground hover:text-foreground"
        @click="emit('update:policy', cloneSanctionPolicy(defaults))"
      >
        <RotateCcw class="h-3.5 w-3.5" />
        {{ $t("pages.settings.application.sanctions.reset") }}
      </Button>
    </div>
  </SettingsSection>
</template>
