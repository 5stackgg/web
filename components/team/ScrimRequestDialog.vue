<script lang="ts">
import { $ } from "~/generated/zeus";
import mapLabel from "~/utilities/mapLabel";
import teamAvatarSrc from "~/utilities/teamAvatar";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Clock } from "lucide-vue-next";
import { parseDate } from "@internationalized/date";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  buildAvailableSet,
  buildFreeSet,
  durationSlots,
  slotFits,
  firstFittingStart,
} from "~/utilities/scrimAvailability";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import TeamScrimAvailabilityPicker from "~/components/team/TeamScrimAvailabilityPicker.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default {
  components: {
    Button,
    Avatar,
    AvatarImage,
    AvatarFallback,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Calendar,
    Input,
    CalendarIcon,
    Clock,
    TeamRankSummary,
    TeamScrimAvailabilityPicker,
    FadeSwap,
  },
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    posting: {
      type: Object as () => any,
      default: null,
    },
  },
  emits: ["update:open", "sent"],
  data() {
    return {
      myTeams: [] as any[],
      mapsById: {} as Record<string, any>,
      selectedFromTeam: "",
      pickedSlot: null as { day: number; slot: number } | null,
      bestOf: "1",
      targetDate: localDateStr(new Date()),
      freeMode: false,
      freeTime: "19:00",
      submitting: false,
      sectionLabelClasses: tacticalSectionLabelClasses,
      sectionTickClasses: tacticalSectionTickClasses,
    };
  },
  computed: {
    mySteamId(): string | undefined {
      return useAuthStore().me?.steam_id;
    },
    dateModel: {
      get() {
        return this.targetDate ? parseDate(this.targetDate) : undefined;
      },
      set(value: any) {
        this.targetDate = value ? value.toString() : "";
      },
    },
    eligibleFromTeams(): any[] {
      return this.myTeams.filter(
        (team) => team.id !== this.posting?.team_id,
      );
    },
    opponentAvailableSet(): Set<string> {
      return buildAvailableSet(this.posting?.team?.scrim_availability ?? []);
    },
    opponentFreeSet(): Set<string> {
      return buildFreeSet(this.opponentAvailableSet);
    },
    hasAvailability(): boolean {
      return this.opponentAvailableSet.size > 0;
    },
    canRequestOutside(): boolean {
      return (
        this.posting?.allow_outside_availability === true ||
        !this.hasAvailability
      );
    },
  },
  apollo: {
    $subscribe: {
      myTeams: {
        query: typedGql("subscription")({
          teams: [
            {
              where: {
                _or: [
                  { owner_steam_id: { _eq: $("steamId", "bigint!") } },
                  {
                    roster: {
                      _and: [
                        { role: { _eq: "Admin" } },
                        { player_steam_id: { _eq: $("steamId", "bigint!") } },
                      ],
                    },
                  },
                ],
              },
            },
            { id: true, name: true },
          ],
        }),
        variables() {
          return { steamId: this.mySteamId };
        },
        skip() {
          return !this.mySteamId;
        },
        result({ data }) {
          this.myTeams = data.teams ?? [];
        },
      },
    },
  },
  mounted() {
    this.loadMaps();
  },
  watch: {
    open(value: boolean) {
      if (!value) {
        return;
      }
      this.bestOf = "1";
      this.targetDate = localDateStr(new Date());
      this.freeMode = !this.hasAvailability;
      this.selectedFromTeam = this.eligibleFromTeams.at(0)?.id ?? "";
      this.pickedSlot = firstFittingStart(
        this.opponentAvailableSet,
        this.opponentFreeSet,
        durationSlots(Number(this.bestOf)),
      );
    },
    bestOf() {
      const slots = durationSlots(Number(this.bestOf));
      if (
        this.pickedSlot &&
        slotFits(
          this.opponentFreeSet,
          this.pickedSlot.day,
          this.pickedSlot.slot,
          slots,
        )
      ) {
        return;
      }
      this.pickedSlot = firstFittingStart(
        this.opponentAvailableSet,
        this.opponentFreeSet,
        slots,
      );
    },
  },
  methods: {
    async loadMaps() {
      const { data } = await this.$apollo.query({
        query: typedGql("query")({
          maps: [{}, { id: true, name: true, patch: true }],
        }),
      });
      const byId: Record<string, any> = {};
      for (const map of data.maps ?? []) {
        byId[map.id] = map;
      }
      this.mapsById = byId;
    },
    checkDate({ day, month, year }: { day: number; month: number; year: number }) {
      return new Date(year, month - 1, day + 1) < new Date();
    },
    teamAvatar(team: any): string | null {
      return teamAvatarSrc(team);
    },
    mapPatches(mapIds: Array<string>): Array<any> {
      return (mapIds ?? [])
        .map((id) => this.mapsById[id])
        .filter((map) => map && map.patch);
    },
    cleanName(map: any): string {
      return mapLabel(map);
    },
    proposedIso(): string | null {
      if (this.freeMode) {
        if (!this.targetDate || !this.freeTime) {
          return null;
        }
        const dt = new Date(`${this.targetDate}T${this.freeTime}:00`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
      }
      if (!this.pickedSlot) {
        return null;
      }
      const { day, slot } = this.pickedSlot;
      const base = this.targetDate
        ? new Date(`${this.targetDate}T00:00:00`)
        : new Date();
      base.setHours(0, 0, 0, 0);
      const occ = new Date(base);
      occ.setDate(base.getDate() + ((day - base.getDay() + 7) % 7));
      occ.setHours(Math.floor(slot / 4), (slot % 4) * 15, 0, 0);
      const now = new Date();
      while (occ <= now) {
        occ.setDate(occ.getDate() + 7);
      }
      return occ.toISOString();
    },
    proposedLabel(): string {
      const iso = this.proposedIso();
      if (!iso) {
        return "";
      }
      const start = new Date(iso);
      const end = new Date(start.getTime() + Number(this.bestOf) * 3600000);
      const startLabel = start.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const endLabel = end.toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      return `${startLabel} → ${endLabel}`;
    },
    bestOfFits(option: string): boolean {
      if (this.freeMode) {
        return true;
      }
      if (this.opponentAvailableSet.size === 0) {
        return false;
      }
      return (
        firstFittingStart(
          this.opponentAvailableSet,
          this.opponentFreeSet,
          durationSlots(Number(option)),
        ) !== null
      );
    },
    async sendRequest() {
      const iso = this.proposedIso();
      if (!this.selectedFromTeam || !iso) {
        return;
      }
      if (this.selectedFromTeam === this.posting?.team_id) {
        toast({
          title: this.$t("scrim.cannot_scrim_self"),
          variant: "destructive",
        });
        return;
      }
      if (new Date(iso) <= new Date()) {
        toast({
          title: this.$t("scrim.time_must_be_future"),
          variant: "destructive",
        });
        return;
      }
      this.submitting = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            sendScrimRequest: [
              {
                from_team_id: this.selectedFromTeam,
                to_team_id: this.posting.team_id,
                proposed_scheduled_at: iso,
                best_of: Number(this.bestOf),
              },
              { success: true },
            ],
          }),
        });
        toast({ title: this.$t("scrim.request_sent") });
        this.$emit("sent");
        this.$emit("update:open", false);
      } catch (error) {
        toast({
          title: this.$t("scrim.request_send_error"),
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<template>
  <Dialog :open="open" @update:open="(value) => $emit('update:open', value)">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle class="sr-only">
          {{ $t("scrim.request_scrim_vs", { name: posting?.team?.name }) }}
        </DialogTitle>
      </DialogHeader>

      <div
        class="relative overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.3)] [background:linear-gradient(110deg,hsl(var(--tac-amber)/0.12)_0%,hsl(var(--card)/0.4)_55%)] p-4 before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-3 before:w-3 before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-3 after:w-3 after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']"
      >
        <span
          class="inline-flex items-center gap-2 font-sans text-[0.6rem] uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]"
        >
          <span class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]" />
          {{ $t("scrim.request_scrim") }}
        </span>
        <div class="mt-3 flex flex-wrap items-center gap-4">
          <NuxtLink
            :to="`/teams/${posting?.team_id}`"
            class="flex min-w-0 items-center gap-3"
          >
            <Avatar shape="square" class="h-12 w-12 rounded-md">
              <AvatarImage
                v-if="teamAvatar(posting?.team)"
                :src="teamAvatar(posting?.team)"
                :alt="posting?.team?.name"
              />
              <AvatarFallback class="rounded-md text-sm font-semibold uppercase">
                {{ (posting?.team?.name || "?").slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <div
                class="truncate font-sans text-xl font-bold uppercase leading-none tracking-[0.02em] text-foreground [font-stretch:80%]"
              >
                {{ posting?.team?.name }}
              </div>
              <div class="mt-1.5">
                <TeamRankSummary
                  :ranks="posting?.team?.ranks"
                  :reputation="posting?.team?.reputation"
                />
              </div>
            </div>
          </NuxtLink>
          <div
            v-if="mapPatches(posting?.map_ids).length"
            class="ml-auto flex flex-col items-end gap-1.5"
          >
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ $t("scrim.preferred_maps") }}
            </span>
            <div class="flex flex-wrap items-center justify-end gap-1.5">
              <img
                v-for="map in mapPatches(posting?.map_ids)"
                :key="map.id"
                :src="map.patch"
                :alt="cleanName(map)"
                :title="cleanName(map)"
                class="h-7 w-7 object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="min-w-0 space-y-4">
        <label class="space-y-1 block">
          <span :class="sectionLabelClasses">
            <span :class="sectionTickClasses" />
            {{ $t("scrim.your_team") }}
          </span>
          <Select v-model="selectedFromTeam">
            <SelectTrigger>
              {{
                eligibleFromTeams.find((team) => team.id === selectedFromTeam)
                  ?.name ?? $t("scrim.select_team")
              }}
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="team in eligibleFromTeams"
                :key="team.id"
                :value="team.id"
              >
                {{ team.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>

        <div class="min-w-0 space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span :class="sectionLabelClasses">
              <span :class="sectionTickClasses" />
              {{ $t("scrim.proposed_time") }}
            </span>
            <button
              v-if="canRequestOutside && hasAvailability"
              type="button"
              class="text-xs text-[hsl(var(--tac-amber))] hover:underline"
              @click="freeMode = !freeMode"
            >
              {{ freeMode ? $t("scrim.pick_from_availability") : $t("scrim.request_other_time") }}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="justify-start text-left font-normal"
                  :class="{ 'text-muted-foreground': !targetDate }"
                >
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ targetDate || $t("common.pick_date") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :is-date-disabled="checkDate"
                  v-model="dateModel"
                  initial-focus
                />
              </PopoverContent>
            </Popover>
            <Transition
              enter-active-class="transition-opacity duration-300 ease-out motion-reduce:!duration-0"
              leave-active-class="transition-opacity duration-200 ease-in motion-reduce:!duration-0"
              enter-from-class="opacity-0"
              leave-to-class="opacity-0"
            >
              <Input
                v-if="freeMode"
                v-model="freeTime"
                type="time"
                style="color-scheme: dark"
                class="h-8 w-[120px]"
              />
            </Transition>
          </div>

          <div
            v-if="proposedLabel()"
            class="flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2"
          >
            <Clock class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
            <span class="text-sm font-semibold text-foreground">
              {{ proposedLabel() }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ $t("scrim.best_of_indicator", { bestOf }) }}
            </span>
          </div>

          <FadeSwap>
            <div v-if="!freeMode" key="availability" class="space-y-1">
              <TeamScrimAvailabilityPicker
                v-model="pickedSlot"
                :availability="posting?.team?.scrim_availability ?? []"
                :best-of="Number(bestOf)"
              />
              <p class="text-xs text-muted-foreground">
                {{ $t("scrim.availability_help", Number(bestOf), { count: bestOf }) }}
              </p>
            </div>
            <p v-else key="free" class="text-xs text-muted-foreground">
              {{
                hasAvailability
                  ? $t("scrim.accepts_outside_hours")
                  : $t("scrim.accepts_any_time")
              }}
              {{ $t("scrim.they_must_accept") }}
            </p>
          </FadeSwap>
        </div>

        <div class="space-y-1">
          <span :class="sectionLabelClasses">
            <span :class="sectionTickClasses" />
            {{ $t("scrim.series") }}
          </span>
          <div class="flex gap-2">
            <button
              v-for="option in ['1', '3', '5']"
              :key="option"
              type="button"
              :disabled="!bestOfFits(option)"
              :title="
                !bestOfFits(option)
                  ? $t('scrim.no_hour_slot', { team: posting?.team?.name, hours: option })
                  : ''
              "
              class="flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              :class="
                bestOf === option
                  ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              "
              @click="bestOf = option"
            >
              {{ $t("scrim.best_of", { option }) }}
            </button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          class="tac-amber-cta"
          :loading="submitting"
          :disabled="!selectedFromTeam || !proposedIso()"
          @click="sendRequest"
        >
          {{ $t("scrim.send_request") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
