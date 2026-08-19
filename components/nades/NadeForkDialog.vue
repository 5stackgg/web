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
import NadeCollectionPicker from "~/components/nades/NadeCollectionPicker.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { forkNadeLineupMutation } from "~/graphql/nadesGraphql";

const props = withDefaults(
  defineProps<{
    lineupId: string | null;
    sourceName?: string | null;
  }>(),
  {
    sourceName: null,
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
    ? t("pages.nades.fork.copy_of", { name: props.sourceName })
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
      mutation: forkNadeLineupMutation,
      variables: {
        nade_lineup_id: id,
        // Both are optional server side: omitting the name keeps the
        // original's, omitting the collection leaves the copy unfiled.
        name: name.value.trim() || null,
        collection_id: collectionId.value,
      },
    });
    const forkedId = (data as any)?.forkNadeLineup?.id;
    if (!forkedId) {
      throw new Error("no lineup");
    }
    open.value = false;
    toast({ title: t("pages.nades.fork.forked") });
    await router.push({ name: "nades-lineup-id", params: { id: forkedId } });
  } catch (error: any) {
    toast({
      title: t("pages.nades.fork.failed"),
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
        <DialogTitle>{{ $t("pages.nades.fork.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.nades.fork.description") }}
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
            :placeholder="$t('pages.nades.fork.name_placeholder')"
          />
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.fork.collection") }}
          </label>
          <NadeCollectionPicker v-model:chosen="collectionId" />
        </div>

        <p class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ $t("pages.nades.fork.private_note") }}
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
          {{ $t("pages.nades.fork.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
