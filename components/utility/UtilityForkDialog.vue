<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { GitFork } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toast";
import UtilityCollectionPicker from "~/components/utility/UtilityCollectionPicker.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { forkUtilityLineupMutation } from "~/graphql/utilityGraphql";
import { utilityLineupRoute } from "~/utilities/utilityDisplay";

const props = withDefaults(
  defineProps<{
    lineupId: string | null;
    sourceName?: string | null;
    // A fork lands on the same map as its source. Without this the copy still
    // opens, via the legacy route that looks the map up and redirects -- one
    // extra round trip for something the caller already knew.
    mapName?: string | null;
  }>(),
  {
    sourceName: null,
    mapName: null,
  },
);

const open = defineModel<boolean>("open", { default: false });

const { t } = useI18n();
const router = useRouter();

const name = ref("");
const collectionId = ref<string | null>(null);
const forking = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  name.value = props.sourceName
    ? t("pages.utility.fork.copy_of", { name: props.sourceName })
    : "";
  collectionId.value = null;
});

async function fork() {
  const id = props.lineupId;
  if (!id) {
    return;
  }
  forking.value = true;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: forkUtilityLineupMutation,
      variables: {
        utility_lineup_id: id,
        // Both are optional server side: omitting the name keeps the
        // original's, omitting the collection leaves the copy unfiled.
        name: name.value.trim() || null,
        collection_id: collectionId.value,
      },
    });
    const forkedId = (data as any)?.forkUtilityLineup?.id;
    if (!forkedId) {
      throw new Error("no lineup");
    }
    open.value = false;
    toast({ title: t("pages.utility.fork.forked") });
    await router.push(utilityLineupRoute(props.mapName, forkedId));
  } catch (error: any) {
    toast({
      title: t("pages.utility.fork.failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    forking.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("pages.utility.fork.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.utility.fork.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("common.name") }}
          </label>
          <Input
            v-model="name"
            maxlength="120"
            :placeholder="$t('pages.utility.fork.name_placeholder')"
          />
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.fork.collection") }}
          </label>
          <UtilityCollectionPicker v-model:chosen="collectionId" />
        </div>

        <p class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ $t("pages.utility.fork.private_note") }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button
          class="tac-amber-cta"
          :loading="forking"
          :disabled="!lineupId"
          @click="fork()"
        >
          <GitFork class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.fork.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
