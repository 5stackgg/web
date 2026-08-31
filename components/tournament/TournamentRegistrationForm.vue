<script setup lang="ts">
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "~/components/ui/number-field";
import { Lock } from "lucide-vue-next";
import SettingHeader from "~/components/match/SettingHeader.vue";
import ScrimRegionPicker from "~/components/team/ScrimRegionPicker.vue";
import { Fold } from "~/components/ui/transitions";
import { SELECT_NONE } from "~/utilities/selectNone";
import {
  tacticalSectionLabelClasses as sectionLabelClasses,
  tacticalSectionTickClasses as sectionTickClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <div class="grid gap-8">
    <!-- Registration -->
    <section class="grid gap-5">
      <div :class="[sectionLabelClasses, 'mb-0']">
        <span :class="sectionTickClasses"></span>
        {{ $t("tournament.registration.section") }}
      </div>

      <FormField v-slot="{ value }" :name="field.registration_type">
        <FormItem>
          <FormLabel>{{ $t("tournament.registration.who.label") }}</FormLabel>
          <div class="grid gap-2.5 sm:grid-cols-3">
            <button
              v-for="option in registrationTypes"
              :key="option.value"
              type="button"
              :aria-pressed="value === option.value"
              :class="[
                optionCardClasses,
                value === option.value
                  ? optionCardActiveClasses
                  : optionCardIdleClasses,
              ]"
              @click="form.setFieldValue(field.registration_type, option.value)"
            >
              <span class="text-[0.85rem] font-bold leading-tight">{{
                option.label
              }}</span>
              <span class="text-[0.76rem] leading-snug text-muted-foreground">{{
                option.description
              }}</span>
            </button>
          </div>
          <FormMessage />
        </FormItem>
      </FormField>

      <div class="grid gap-5 sm:grid-cols-2">
        <FormField v-slot="{ value }" :name="field.min_role">
          <FormItem>
            <FormLabel>{{
              $t("tournament.registration.min_role.label")
            }}</FormLabel>
            <Select
              :model-value="value || SELECT_NONE"
              @update:model-value="onMinRoleChange"
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    :placeholder="$t('tournament.registration.min_role.none')"
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="SELECT_NONE">
                    {{ $t("tournament.registration.min_role.none") }}
                  </SelectItem>
                  <SelectItem v-for="role in roles" :key="role" :value="role">
                    {{ $t(`roles.${role}`) }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormDescription>{{
              $t("tournament.registration.min_role.description")
            }}</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- Two fields under one label: the pair only reads as a range when the
             inputs sit on one row, so neither gets its own FormItem. -->
        <div class="space-y-2">
          <Label :class="fieldLabelClasses">{{
            $t("tournament.registration.rank.label")
          }}</Label>
          <div class="flex items-center gap-2">
            <FormField v-slot="{ value }" :name="field.min_elo">
              <Input
                type="number"
                min="0"
                inputmode="numeric"
                :model-value="value ?? ''"
                :placeholder="$t('tournament.registration.rank.min')"
                @update:model-value="(elo) => setEloField(field.min_elo, elo)"
              />
            </FormField>
            <span class="text-muted-foreground">&ndash;</span>
            <FormField v-slot="{ value }" :name="field.max_elo">
              <Input
                type="number"
                min="0"
                inputmode="numeric"
                :model-value="value ?? ''"
                :placeholder="$t('tournament.registration.rank.max')"
                @update:model-value="(elo) => setEloField(field.max_elo, elo)"
              />
            </FormField>
          </div>
          <p class="text-sm text-muted-foreground">
            {{ $t("tournament.registration.rank.description") }}
          </p>
          <p
            v-if="eloRangeError"
            class="text-[0.8rem] font-medium text-destructive"
          >
            {{ eloRangeError }}
          </p>
        </div>
      </div>

      <FormField v-slot="{ value }" :name="field.regions">
        <FormItem>
          <FormLabel>{{
            $t("tournament.registration.regions.label")
          }}</FormLabel>
          <ScrimRegionPicker
            :regions="value ?? []"
            :empty-text="$t('tournament.registration.regions.empty')"
            @update:regions="
              (regions) => form.setFieldValue(field.regions, regions)
            "
          />
          <FormDescription>{{
            $t("tournament.registration.regions.description")
          }}</FormDescription>
        </FormItem>
      </FormField>

      <div class="border-t border-border pt-5">
        <FormField v-slot="{ value, handleChange }" :name="field.invite_only">
          <FormItem>
            <div
              class="flex cursor-pointer flex-row items-center justify-between gap-5"
              @click="handleChange(!value)"
            >
              <div class="space-y-0.5">
                <SettingHeader>{{
                  $t("tournament.registration.invite_only.label")
                }}</SettingHeader>
                <FormDescription>{{
                  $t("tournament.registration.invite_only.description")
                }}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  class="pointer-events-none"
                  :model-value="value"
                  @update:model-value="handleChange"
                />
              </FormControl>
            </div>
          </FormItem>
        </FormField>
      </div>
    </section>

    <!-- Check-In. Collapsed to the single switch row until it is turned on, so
         a tournament that never wants it is no longer to set up than before. -->
    <section class="grid gap-3 border-t border-border pt-6">
      <div :class="[sectionLabelClasses, 'mb-0']">
        <span :class="sectionTickClasses"></span>
        {{ $t("tournament.check_in.section") }}
      </div>

      <FormField
        v-slot="{ value, handleChange }"
        :name="field.check_in_required"
      >
        <FormItem>
          <div
            class="flex cursor-pointer flex-row items-center justify-between gap-5"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <SettingHeader>{{
                $t("tournament.check_in.required.label")
              }}</SettingHeader>
              <FormDescription>{{
                $t("tournament.check_in.required.description")
              }}</FormDescription>
            </div>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :model-value="value"
                @update:model-value="handleChange"
              />
            </FormControl>
          </div>
        </FormItem>
      </FormField>

      <Fold :open="!!form.values[field.check_in_required]">
        <div class="grid gap-6 pt-5">
          <!-- The lock is server-enforced (tbu_tournaments rejects the write
               outright); this only explains why the controls went dead. -->
          <div
            v-if="frozen"
            class="flex items-start gap-2.5 border-l-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.07)] px-3.5 py-2.5 text-[0.82rem] leading-snug"
          >
            <Lock
              class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]"
            />
            <span>{{ $t("tournament.check_in.frozen") }}</span>
          </div>

          <FormField v-slot="{ value }" :name="field.check_in_setting">
            <FormItem>
              <FormLabel>{{ $t("tournament.check_in.who.label") }}</FormLabel>
              <div class="grid gap-2.5 sm:grid-cols-3">
                <button
                  v-for="option in checkInSettings"
                  :key="option.value"
                  type="button"
                  :aria-pressed="value === option.value"
                  :class="[
                    optionCardClasses,
                    value === option.value
                      ? optionCardActiveClasses
                      : optionCardIdleClasses,
                  ]"
                  @click="
                    form.setFieldValue(field.check_in_setting, option.value)
                  "
                >
                  <span class="text-[0.85rem] font-bold leading-tight">{{
                    option.label
                  }}</span>
                  <span
                    class="text-[0.76rem] leading-snug text-muted-foreground"
                    >{{ option.description }}</span
                  >
                </button>
              </div>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="grid max-w-lg gap-5 sm:grid-cols-2">
            <FormField
              v-slot="{ value }"
              :name="field.check_in_opens_before_minutes"
            >
              <FormItem>
                <FormLabel>{{
                  $t("tournament.check_in.opens.label")
                }}</FormLabel>
                <NumberField
                  class="gap-2"
                  :disabled="frozen"
                  :min="opensMin"
                  :max="opensMax"
                  :model-value="value"
                  @update:model-value="
                    (minutes) =>
                      form.setFieldValue(
                        field.check_in_opens_before_minutes,
                        minutes,
                      )
                  "
                >
                  <NumberFieldContent>
                    <NumberFieldDecrement />
                    <FormControl>
                      <NumberFieldInput />
                    </FormControl>
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
                <FormDescription>{{
                  $t("tournament.check_in.minutes_before_start")
                }}</FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField
              v-slot="{ value }"
              :name="field.check_in_closes_before_minutes"
            >
              <FormItem>
                <FormLabel>{{
                  $t("tournament.check_in.closes.label")
                }}</FormLabel>
                <NumberField
                  class="gap-2"
                  :disabled="frozen"
                  :min="closesMin"
                  :max="closesMax"
                  :model-value="value"
                  @update:model-value="
                    (minutes) =>
                      form.setFieldValue(
                        field.check_in_closes_before_minutes,
                        minutes,
                      )
                  "
                >
                  <NumberFieldContent>
                    <NumberFieldDecrement />
                    <FormControl>
                      <NumberFieldInput />
                    </FormControl>
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
                <FormDescription>{{
                  $t("tournament.check_in.minutes_before_start")
                }}</FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <!-- opens -> closes -> start. Scrolls rather than reflowing: the
               nodes are placed proportionally, and stacking them on a narrow
               screen would destroy the one thing the diagram exists to show. -->
          <div class="-mx-1 overflow-x-auto px-1">
            <div class="relative min-w-[26rem] pb-9 pt-8">
              <div class="absolute inset-x-0 top-[3.05rem] h-px bg-border"></div>
              <div
                class="absolute top-[3.05rem] h-px bg-gradient-to-r from-[hsl(var(--tac-amber)/0.15)] to-[hsl(var(--tac-amber))] transition-[left,width] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                :style="{
                  left: `${timelinePoints[0].left}%`,
                  width: `${timelinePoints[2].left - timelinePoints[0].left}%`,
                }"
              ></div>
              <div
                v-for="point in timelinePoints"
                :key="point.key"
                class="absolute top-0 grid w-28 -translate-x-1/2 justify-items-center gap-2 transition-[left] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                :style="{ left: `${point.left}%` }"
              >
                <span
                  class="font-mono text-[0.62rem] tracking-[0.1em] text-muted-foreground"
                  >{{ point.time }}</span
                >
                <span
                  class="h-2.5 w-2.5 rounded-full border-2"
                  :class="
                    point.key === 'start'
                      ? 'border-foreground bg-foreground'
                      : 'border-[hsl(var(--tac-amber))] bg-background'
                  "
                ></span>
                <span
                  class="text-center text-[0.68rem] font-bold uppercase leading-tight tracking-[0.14em]"
                  :class="
                    point.key === 'start'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  "
                  >{{ point.label }}</span
                >
              </div>
            </div>
          </div>

          <div class="grid gap-2.5">
            <p
              class="border-l-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.07)] px-3.5 py-2.5 text-[0.82rem] leading-snug"
            >
              {{ $t("tournament.check_in.lock_note") }}
            </p>
            <p
              class="border-l-2 border-success bg-[hsl(var(--success)/0.07)] px-3.5 py-2.5 text-[0.82rem] leading-snug"
            >
              {{ $t("tournament.check_in.late_registration_note") }}
            </p>
            <p
              class="border-l-2 border-success bg-[hsl(var(--success)/0.07)] px-3.5 py-2.5 text-[0.82rem] leading-snug"
            >
              {{ $t("tournament.check_in.no_show_note") }}
            </p>
          </div>
        </div>
      </Fold>
    </section>
  </div>
</template>

<script lang="ts">
import { unref } from "vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { roleOrder } from "~/stores/AuthStore";
import { dateLocale } from "~/utilities/dateLocale";
import {
  REGISTRATION_TYPES,
  REGISTRATION_FIELD,
} from "~/utilities/tournamentRegistration";
import {
  CHECK_IN_CLOSES_DEFAULT_MINUTES,
  CHECK_IN_CLOSES_MAX_MINUTES,
  CHECK_IN_CLOSES_MIN_MINUTES,
  CHECK_IN_OPENS_DEFAULT_MINUTES,
  CHECK_IN_OPENS_MAX_MINUTES,
  CHECK_IN_OPENS_MIN_MINUTES,
  CHECK_IN_SETTINGS,
  checkInTimeline,
  isTournamentScheduleFrozen,
} from "~/utilities/tournamentCheckIn";

export default {
  props: {
    form: {
      type: Object,
      required: true,
    },
    // Absent while creating — there is no row to freeze yet.
    tournament: {
      type: Object,
      required: false,
      default: null,
    },
    // Drives the "Every player" copy: a team is in once this many players
    // confirm, so a roster carrying substitutes is not held hostage by them.
    minPlayersPerLineup: {
      type: Number,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      field: REGISTRATION_FIELD,
      opensMin: CHECK_IN_OPENS_MIN_MINUTES,
      opensMax: CHECK_IN_OPENS_MAX_MINUTES,
      closesMin: CHECK_IN_CLOSES_MIN_MINUTES,
      closesMax: CHECK_IN_CLOSES_MAX_MINUTES,
      fieldLabelClasses:
        "font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground",
      optionCardClasses:
        "grid cursor-pointer gap-1.5 rounded-md border p-3.5 text-left transition-[border-color,background-color] duration-150 motion-reduce:transition-none",
      optionCardIdleClasses:
        "border-border bg-card/40 hover:border-[hsl(var(--tac-amber)/0.35)]",
      optionCardActiveClasses:
        "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.07)]",
    };
  },
  computed: {
    frozen(): boolean {
      return isTournamentScheduleFrozen(this.tournament);
    },
    roles(): e_player_roles_enum[] {
      return roleOrder;
    },
    registrationTypes() {
      return REGISTRATION_TYPES.map((value) => ({
        value,
        label: this.$t(`tournament.registration.who.${value}.label`),
        description: this.$t(
          `tournament.registration.who.${value}.description`,
        ),
      }));
    },
    checkInSettings() {
      return CHECK_IN_SETTINGS.map((value) => ({
        value,
        // Only the Players mode carries a number, and it is the lineup minimum
        // rather than the roster size — substitutes never have to check in.
        description:
          value === "Players"
            ? this.$t("tournament.check_in.who.Players.description", {
                count: this.minPlayersPerLineup ?? 5,
              })
            : this.$t(`tournament.check_in.who.${value}.description`),
        label: this.$t(`tournament.check_in.who.${value}.label`),
      }));
    },
    // vee-validate reports the cross-field ELO issue on max_elo, but the pair
    // shares one label block and so has no FormMessage to render it.
    eloRangeError(): string | undefined {
      const errors = unref(this.form.errors) as
        | Record<string, string>
        | undefined;
      return errors?.[REGISTRATION_FIELD.max_elo];
    },
    timelinePoints() {
      const opens = Number(
        this.form.values[REGISTRATION_FIELD.check_in_opens_before_minutes] ??
          CHECK_IN_OPENS_DEFAULT_MINUTES,
      );
      const closes = Number(
        this.form.values[REGISTRATION_FIELD.check_in_closes_before_minutes] ??
          CHECK_IN_CLOSES_DEFAULT_MINUTES,
      );
      const timeline = checkInTimeline(
        this.form.values.start ?? this.tournament?.start,
        opens,
        closes,
      );

      // Both end nodes are inset from the container edge so their labels are
      // not clipped; the closes node is placed proportionally between them.
      const span = opens > 0 ? opens : 1;
      const closesFraction = Math.min(Math.max((span - closes) / span, 0), 1);

      return [
        {
          key: "opens",
          left: 8,
          label: this.$t("tournament.check_in.timeline.opens"),
          time: this.formatTime(timeline?.opensAt),
        },
        {
          key: "closes",
          left: 8 + closesFraction * 84,
          label: this.$t("tournament.check_in.timeline.closes"),
          time: this.formatTime(timeline?.closesAt),
        },
        {
          key: "start",
          left: 92,
          label: this.$t("tournament.check_in.timeline.start"),
          time: this.formatTime(timeline?.startsAt),
        },
      ];
    },
  },
  methods: {
    formatTime(date?: Date): string {
      if (!date) {
        return "—";
      }
      return date.toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    // reka-ui's Select emits AcceptableValue, not string.
    onMinRoleChange(value: any) {
      this.form.setFieldValue(
        REGISTRATION_FIELD.min_role,
        value === SELECT_NONE ? null : value,
      );
    },
    // An emptied number input has to become null ("no bound"), not 0 — 0 is a
    // real ELO floor that excludes nobody yet still reads as a gate that is set.
    setEloField(name: string, value: string | number) {
      const raw = typeof value === "string" ? value.trim() : value;
      if (raw === "" || raw === null || raw === undefined) {
        this.form.setFieldValue(name, null);
        return;
      }
      const parsed = Number(raw);
      this.form.setFieldValue(name, Number.isNaN(parsed) ? null : parsed);
    },
  },
};
</script>
