<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import AwardBadge from "./AwardBadge.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";
import { Check, Plus } from "lucide-vue-next";

interface CatalogAward {
  id: string;
  name?: string | null;
  tier?: string | null;
  silhouette?: number | null;
  image_url?: string | null;
  system_key?: string | null;
}

const props = defineProps<{
  open: boolean;
  awards: CatalogAward[];
  /** Currently linked award, or "" when the placement uses its default. */
  selected: string;
  /** The award the placement falls back to, shown as the default option. */
  fallback?: CatalogAward | null;
  /** Authoring a new catalog award needs public.create_awards_role. */
  canCreate?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "select", awardId: string): void;
  (e: "created", awardId: string): void;
}>();

const TIERS = ["special", "mvp", "gold", "silver", "bronze"];

const { client } = useApolloClient();

const creating = ref(false);
const saving = ref(false);
const draft = ref({ name: "", tier: "special" });

watch(
  () => props.open,
  (open) => {
    if (!open) {
      creating.value = false;
      draft.value = { name: "", tier: "special" };
    }
  },
);

// Built-ins first so the tournament defaults are the obvious pick.
const sorted = computed(() =>
  [...props.awards].sort((a, b) => {
    const bySystem = Number(!!b.system_key) - Number(!!a.system_key);
    return bySystem || (a.name ?? "").localeCompare(b.name ?? "");
  }),
);

function choose(awardId: string) {
  emit("select", awardId);
  emit("update:open", false);
}

// Always an INSERT (no id), so authoring from a tournament can never overwrite
// a built-in or another tournament's award.
async function createAward() {
  saving.value = true;
  try {
    const { data } = await client.mutate({
      mutation: typedGql("mutation")({
        saveAward: [
          { name: $("name", "String!"), tier: $("tier", "String!") },
          { id: true, name: true, tier: true, image_url: true },
        ],
      }),
      variables: { name: draft.value.name.trim(), tier: draft.value.tier },
    });
    const created = (data as any)?.saveAward;
    if (created?.id) {
      emit("created", created.id);
      emit("select", created.id);
      emit("update:open", false);
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {{ $t("tournament.awards_config.pick_award") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("tournament.awards_config.pick_award_hint") }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="!creating"
        class="grid max-h-[24rem] grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3"
      >
        <!-- Default: whatever the automation resolves on its own. Absent when
             the caller has no fallback, e.g. a hand-granted award. -->
        <button
          v-if="fallback"
          type="button"
          class="relative flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors duration-150"
          :class="
            selected === ''
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.08)]'
              : 'border-border hover:border-[hsl(var(--tac-amber)/0.45)]'
          "
          @click="choose('')"
        >
          <Check
            v-if="selected === ''"
            class="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
          <AwardBadge
            :award="fallback"
            :seed-key="fallback?.id"
            size="sm"
            :interactive="false"
            :show-name="false"
          />
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("tournament.awards_config.award_default") }}
          </span>
          <span class="line-clamp-2 text-[0.7rem] font-semibold leading-tight">
            {{ fallback?.name || "—" }}
          </span>
        </button>

        <button
          v-for="award in sorted"
          :key="award.id"
          type="button"
          class="relative flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors duration-150"
          :class="
            selected === award.id
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.08)]'
              : 'border-border hover:border-[hsl(var(--tac-amber)/0.45)]'
          "
          @click="choose(award.id)"
        >
          <Check
            v-if="selected === award.id"
            class="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
          <AwardBadge
            :award="award"
            :seed-key="award.id"
            size="sm"
            :interactive="false"
            :show-name="false"
          />
          <span class="line-clamp-2 text-[0.7rem] font-semibold leading-tight">
            {{ award.name }}
          </span>
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ award.tier }}
          </span>
        </button>

        <button
          v-if="canCreate"
          type="button"
          class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-3 text-center text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] hover:text-foreground"
          @click="creating = true"
        >
          <Plus class="h-5 w-5" />
          <span
            class="font-mono text-[0.55rem] uppercase leading-tight tracking-[0.18em]"
          >
            {{ $t("tournament.awards_config.new_award") }}
          </span>
        </button>
      </div>

      <div v-else class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">{{ $t("pages.awards.name") }}</span>
          <Input v-model="draft.name" maxlength="60" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">{{ $t("pages.awards.tier") }}</span>
          <select
            v-model="draft.tier"
            class="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option v-for="tier in TIERS" :key="tier" :value="tier">
              {{ tier }}
            </option>
          </select>
        </label>
        <p class="text-xs text-muted-foreground">
          {{ $t("tournament.awards_config.new_award_hint") }}
        </p>
      </div>

      <DialogFooter>
        <template v-if="creating">
          <Button
            variant="outline"
            :disabled="saving"
            @click="creating = false"
          >
            {{ $t("common.cancel") }}
          </Button>
          <Button :disabled="!draft.name.trim() || saving" @click="createAward">
            {{ saving ? $t("common.saving") : $t("common.save") }}
          </Button>
        </template>
        <Button v-else variant="outline" @click="emit('update:open', false)">
          {{ $t("common.close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
