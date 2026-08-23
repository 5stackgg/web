<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Save } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/toast";
import UtilityCollectionPicker from "~/components/utility/UtilityCollectionPicker.vue";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  saveUtilityLineupFromDemoMutation,
  saveUtilityLineupFromPracticeMutation,
} from "~/graphql/utilityGraphql";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityLineupOutput, UtilityVisibility } from "~/types/utility";

/**
 * One form for both server-side creation paths. They differ only in what
 * identifies the throw — a grenade in a demo, or a session that has one — so
 * the metadata half is shared rather than written twice.
 */
const props = withDefaults(
  defineProps<{
    source: "demo" | "practice";
    matchId?: string | null;
    matchMapId?: string | null;
    grenadeId?: number | null;
    sessionId?: string | null;
    utilityLineupId?: string | null;
    defaultName?: string | null;
  }>(),
  {
    matchId: null,
    matchMapId: null,
    grenadeId: null,
    sessionId: null,
    utilityLineupId: null,
    defaultName: null,
  },
);

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  (e: "saved", id: string): void;
}>();

const { t } = useI18n();

// Reka Select rejects an empty-string value, so "unset" rides a sentinel.
const NO_TEAM = "none";

const VISIBILITIES: UtilityVisibility[] = ["Private", "Team", "Public"];

const auth = useAuthStore();
const myTeams = computed(
  () =>
    (auth.me?.teams ?? []) as Array<{
      id: string;
      name: string;
      short_name?: string | null;
    }>,
);

const name = ref("");
const description = ref("");
const tagsInput = ref("");
const visibility = ref<UtilityVisibility>("Private");
const teamId = ref<string>(NO_TEAM);
const collectionId = ref<string | null>(null);
const saving = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  name.value = props.defaultName ?? "";
  description.value = "";
  tagsInput.value = "";
  visibility.value = "Private";
  teamId.value = NO_TEAM;
  collectionId.value = null;
});

const tags = computed(() =>
  tagsInput.value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0),
);

const isDemo = computed(() => props.source === "demo");

const hasTarget = computed(() => {
  if (isDemo.value) {
    return !!props.matchId && !!props.matchMapId && props.grenadeId != null;
  }
  return !!props.sessionId && !!props.utilityLineupId;
});

const canSave = computed(() => hasTarget.value && name.value.trim().length > 0);

const title = computed(() =>
  isDemo.value
    ? t("pages.utility.save.title_demo")
    : t("pages.utility.save.title_practice"),
);

const description_ = computed(() =>
  isDemo.value
    ? t("pages.utility.save.description_demo")
    : t("pages.utility.save.description_practice"),
);

/**
 * What the saved lineup will read as. A demo-mined one is graded `derived`
 * server side — its aim comes out of the flight, not out of anything recorded —
 * so the note goes on the form rather than being discovered afterwards. The
 * practice path is graded by whatever recorded the throw, which is not this
 * page's to claim, so it shows nothing.
 */
const confidencePreview = {
  confidence: "derived" as const,
  origin_source: "demo" as const,
  verified_at: null,
  view_yaw_delta: null,
  view_pitch_delta: null,
};

async function save() {
  if (!canSave.value) {
    return;
  }
  saving.value = true;
  try {
    const shared = {
      name: name.value.trim(),
      description: description.value.trim() || null,
      visibility: visibility.value,
      team_id: teamId.value === NO_TEAM ? null : teamId.value,
      tags: tags.value.length ? tags.value : null,
      collection_id: collectionId.value,
    };
    const { data } = await getGraphqlClient().mutate(
      isDemo.value
        ? {
            mutation: saveUtilityLineupFromDemoMutation,
            variables: {
              match_id: props.matchId,
              match_map_id: props.matchMapId,
              grenade_id: props.grenadeId,
              ...shared,
            },
          }
        : {
            mutation: saveUtilityLineupFromPracticeMutation,
            variables: {
              session_id: props.sessionId,
              utility_lineup_id: props.utilityLineupId,
              ...shared,
            },
          },
    );
    const id = isDemo.value
      ? ((data as any)?.saveUtilityLineupFromDemo as UtilityLineupOutput | undefined)
          ?.id
      : (
          (data as any)?.saveUtilityLineupFromPractice as
            | UtilityLineupOutput
            | undefined
        )?.id;
    if (!id) {
      throw new Error("no lineup");
    }
    open.value = false;
    toast({ title: t("pages.utility.save.saved") });
    emit("saved", id);
  } catch (error: any) {
    toast({
      title: t("pages.utility.save.failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description_ }}</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <UtilityConfidenceNote v-if="isDemo" :lineup="confidencePreview" />

        <p v-else class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ $t("pages.utility.save.practice_note") }}
        </p>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("common.name") }}
          </label>
          <Input
            v-model="name"
            maxlength="120"
            :placeholder="$t('pages.utility.save.name_placeholder')"
          />
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("common.description") }}
          </label>
          <Textarea
            v-model="description"
            rows="3"
            maxlength="1000"
            :placeholder="$t('pages.utility.save.description_placeholder')"
          />
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.filters.tags") }}
          </label>
          <Input
            v-model="tagsInput"
            maxlength="160"
            :placeholder="$t('pages.utility.save.tags_placeholder')"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <div>
            <label
              class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.utility.playbooks.visibility") }}
            </label>
            <Select v-model="visibility">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="entry of VISIBILITIES"
                  :key="entry"
                  :value="entry"
                >
                  {{ $t(`pages.utility.visibility.${entry}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.utility.playbooks.team") }}
            </label>
            <Select v-model="teamId">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NO_TEAM">{{ $t("common.none") }}</SelectItem>
                <SelectItem
                  v-for="team of myTeams"
                  :key="team.id"
                  :value="team.id"
                >
                  {{ team.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p
          v-if="visibility === 'Team' && teamId === NO_TEAM"
          class="text-[0.7rem] leading-snug text-[hsl(var(--tac-amber))]"
        >
          {{ $t("pages.utility.playbooks.team_required") }}
        </p>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.save.collection") }}
          </label>
          <UtilityCollectionPicker v-model:chosen="collectionId" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button
          class="tac-amber-cta"
          :loading="saving"
          :disabled="!canSave"
          @click="save()"
        >
          <Save class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.save.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
