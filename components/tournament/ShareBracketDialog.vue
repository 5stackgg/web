<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Copy, Check, ExternalLink } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  open: boolean;
  tournament: any;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const selectedStageOrder = ref<number>(1);
const cycleInterval = ref<number>(15);
const activeTab = ref<"specific" | "current" | "cycle">("current");
const copiedKey = ref<string | null>(null);

const orderedStages = computed(() => {
  return [...(props.tournament?.stages || [])].sort(
    (a: any, b: any) => (a.order || 0) - (b.order || 0),
  );
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      const firstStage = orderedStages.value[0];
      if (
        firstStage &&
        !orderedStages.value.find((s) => s.order === selectedStageOrder.value)
      ) {
        selectedStageOrder.value = firstStage.order || 1;
      }
    }
  },
);

const baseUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/embed/tournaments/${props.tournament?.id}/bracket`;
});

const specificStageUrl = computed(
  () => `${baseUrl.value}?stage=${selectedStageOrder.value}`,
);

const currentStageUrl = computed(() => `${baseUrl.value}?stage=current`);

const cycleAllUrl = computed(
  () => `${baseUrl.value}?cycle=1&interval=${cycleInterval.value}`,
);

const embedSnippet = (url: string) =>
  `<iframe src="${url}" width="1280" height="720" frameborder="0" allowfullscreen></iframe>`;

const copyValue = async (value: string, key: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    copiedKey.value = key;
    toast({ title: t("tournament.bracket.share_copied") });
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
    }, 1500);
  } catch (err) {
    console.error("copy failed", err);
  }
};

const openUrl = (url: string) => {
  if (typeof window === "undefined") return;
  window.open(
    url,
    "_blank",
    "width=1280,height=720,menubar=no,toolbar=no,location=no",
  );
};
</script>

<template>
  <Dialog :open="props.open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ $t("tournament.bracket.share_title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("tournament.bracket.share_description") }}
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="current">
            {{ $t("tournament.bracket.share_current_stage") }}
          </TabsTrigger>
          <TabsTrigger value="specific" :disabled="!orderedStages.length">
            {{ $t("tournament.bracket.share_specific_stage") }}
          </TabsTrigger>
          <TabsTrigger value="cycle" :disabled="orderedStages.length < 1">
            {{ $t("tournament.bracket.share_cycle_all") }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" class="space-y-4 pt-4">
          <p class="text-sm text-muted-foreground">
            {{ $t("tournament.bracket.share_current_stage_help") }}
          </p>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_link") }}</Label>
            <div class="flex gap-2">
              <Input
                :model-value="currentStageUrl"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue(currentStageUrl, 'current-url')"
                :title="$t('tournament.bracket.share_copy')"
              >
                <Check v-if="copiedKey === 'current-url'" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                @click="openUrl(currentStageUrl)"
                :title="$t('tournament.bracket.share_open')"
              >
                <ExternalLink class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_embed") }}</Label>
            <div class="flex gap-2">
              <Input
                :model-value="embedSnippet(currentStageUrl)"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="
                  copyValue(embedSnippet(currentStageUrl), 'current-embed')
                "
              >
                <Check v-if="copiedKey === 'current-embed'" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="specific" class="space-y-4 pt-4">
          <p class="text-sm text-muted-foreground">
            {{ $t("tournament.bracket.share_specific_stage_help") }}
          </p>
          <div class="space-y-2">
            <Label>{{ $t("tournament.stage.title") }}</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="stage of orderedStages"
                :key="stage.id"
                type="button"
                class="rounded-md border border-border px-3 py-1.5 text-sm transition-colors data-[active=true]:border-[hsl(var(--tac-amber))] data-[active=true]:bg-[hsl(var(--tac-amber)/0.12)] data-[active=true]:text-[hsl(var(--tac-amber))] hover:bg-muted/40"
                :data-active="selectedStageOrder === stage.order"
                @click="selectedStageOrder = stage.order"
              >
                <span class="font-mono mr-2 text-xs opacity-70">
                  {{ String(stage.order).padStart(2, "0") }}
                </span>
                {{ stage.e_tournament_stage_type?.description || stage.type }}
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_link") }}</Label>
            <div class="flex gap-2">
              <Input
                :model-value="specificStageUrl"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue(specificStageUrl, 'specific-url')"
              >
                <Check v-if="copiedKey === 'specific-url'" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                @click="openUrl(specificStageUrl)"
              >
                <ExternalLink class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_embed") }}</Label>
            <div class="flex gap-2">
              <Input
                :model-value="embedSnippet(specificStageUrl)"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="
                  copyValue(embedSnippet(specificStageUrl), 'specific-embed')
                "
              >
                <Check v-if="copiedKey === 'specific-embed'" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cycle" class="space-y-4 pt-4">
          <p class="text-sm text-muted-foreground">
            {{ $t("tournament.bracket.share_cycle_all_help") }}
          </p>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_cycle_interval") }}</Label>
            <Input
              v-model.number="cycleInterval"
              type="number"
              min="5"
              max="600"
              class="w-40 font-mono"
            />
          </div>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_link") }}</Label>
            <div class="flex gap-2">
              <Input
                :model-value="cycleAllUrl"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue(cycleAllUrl, 'cycle-url')"
              >
                <Check v-if="copiedKey === 'cycle-url'" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                @click="openUrl(cycleAllUrl)"
              >
                <ExternalLink class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>{{ $t("tournament.bracket.share_embed") }}</Label>
            <div class="flex gap-2">
              <Input
                :model-value="embedSnippet(cycleAllUrl)"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue(embedSnippet(cycleAllUrl), 'cycle-embed')"
              >
                <Check v-if="copiedKey === 'cycle-embed'" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
