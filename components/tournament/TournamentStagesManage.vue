<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Pencil, Plus, Trash2, Lock } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Fold } from "~/components/ui/transitions";
import ManageSection from "~/components/common/ManageSection.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_tournament_status_enum } from "~/generated/zeus";

const props = defineProps<{ tournament: Record<string, any> }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp() as any;

// Stages are edited in place, one open at a time; "new" is the add form.
const editing = ref<string | null>(null);
const deleting = ref<Record<string, any> | null>(null);
const removing = ref(false);

const stages = computed(() =>
  [...(props.tournament.stages ?? [])].sort(
    (a: any, b: any) => (a.order ?? 1) - (b.order ?? 1),
  ),
);
const nextOrder = computed(
  () => Math.max(0, ...stages.value.map((s: any) => s.order ?? 1)) + 1,
);
const locked = computed(
  () =>
    props.tournament.status === e_tournament_status_enum.Live ||
    props.tournament.status === e_tournament_status_enum.Finished,
);

const bestOf = (stage: any) =>
  stage.default_best_of ??
  stage.options?.best_of ??
  props.tournament.options?.best_of ??
  null;

function toggle(key: string) {
  editing.value = editing.value === key ? null : key;
}

async function confirmDelete() {
  const stage = deleting.value;
  if (!stage) return;
  removing.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        delete_tournament_stages_by_pk: [
          { id: stage.id },
          { __typename: true },
        ],
      }),
    });
    toast({ title: t("tournament.stage.deleted") });
  } catch {
    toast({
      title: t("tournament.stage.delete_failed"),
      variant: "destructive",
    });
  } finally {
    removing.value = false;
    deleting.value = null;
  }
}
</script>

<template>
  <ManageSection
    :label="$t('tournament.manage.stages')"
    :hint="locked ? $t('tournament.manage.stages_locked') : undefined"
  >
    <div class="grid gap-2">
      <div
        v-for="stage in stages"
        :key="stage.id"
        class="rounded-md border border-border bg-muted/10"
      >
        <div class="flex items-center gap-3 px-3 py-2.5">
          <span
            class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[hsl(var(--tac-amber)/0.14)] text-sm font-bold tabular-nums text-[hsl(var(--tac-amber))]"
          >
            {{ stage.order }}
          </span>
          <div class="grid min-w-0 flex-1">
            <span class="truncate text-sm font-semibold">
              {{ stage.e_tournament_stage_type?.description ?? stage.type }}
              <span
                v-if="bestOf(stage)"
                class="font-normal text-muted-foreground"
              >
                · Bo{{ bestOf(stage) }}
              </span>
            </span>
            <span class="truncate text-xs text-muted-foreground">
              {{
                $t("tournament.manage.stage_summary", {
                  min: stage.min_teams ?? 2,
                  max: stage.max_teams ?? "—",
                })
              }}
              <template v-if="(stage.groups ?? 1) > 1">
                · {{ $t("tournament.manage.groups", { count: stage.groups }) }}
              </template>
            </span>
          </div>
          <template v-if="!locked">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :aria-expanded="editing === stage.id"
              @click="toggle(stage.id)"
            >
              <Pencil class="mr-1.5 h-3.5 w-3.5" />
              {{ $t("common.edit") }}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-destructive"
              :aria-label="$t('tournament.stage.delete')"
              @click="deleting = stage"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </template>
          <Lock v-else class="h-4 w-4 text-muted-foreground" />
        </div>
        <Fold :open="editing === stage.id">
          <div class="border-t border-border px-3 py-4">
            <TournamentStageForm
              v-if="editing === stage.id"
              :stage="stage"
              :order="stage.order"
              :tournament="tournament"
              @updated="editing = null"
            />
          </div>
        </Fold>
      </div>

      <div
        v-if="!stages.length && editing !== 'new'"
        class="grid justify-items-start gap-2 rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground"
      >
        <span class="text-base font-semibold text-foreground">
          {{ $t("tournament.manage.no_stages") }}
        </span>
        {{ $t("tournament.manage.no_stages_hint") }}
      </div>

      <template v-if="!locked">
        <Fold :open="editing === 'new'">
          <div
            class="rounded-md border border-[hsl(var(--tac-amber)/0.45)] px-3 py-4"
          >
            <TournamentStageForm
              v-if="editing === 'new'"
              :order="nextOrder"
              :tournament-id="tournament.id"
              :tournament="tournament"
              @updated="editing = null"
            />
          </div>
        </Fold>
        <Button
          v-if="editing !== 'new'"
          type="button"
          variant="outline"
          class="justify-self-start"
          @click="toggle('new')"
        >
          <Plus class="mr-1.5 h-4 w-4" />
          {{
            stages.length
              ? $t("tournament.stage.add_another")
              : $t("tournament.manage.add_first_stage")
          }}
        </Button>
      </template>
    </div>
  </ManageSection>

  <AlertDialog
    :open="!!deleting"
    @update:open="(open) => !open && (deleting = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("tournament.stage.confirm_delete")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("tournament.stage.delete_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <!-- Not AlertDialogAction: it closes (and clears `deleting`) before the async click runs. -->
        <Button
          variant="destructive"
          :loading="removing"
          @click="confirmDelete"
        >
          {{ $t("tournament.stage.delete") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
