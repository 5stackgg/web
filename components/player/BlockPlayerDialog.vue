<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "~/components/ui/toast";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";

const props = defineProps<{
  player: { steam_id: string | number; name?: string | null };
}>();

const open = defineModel<boolean>("open", { default: false });

const { t } = useI18n();

const { block } = usePlayerBlocks();

const name = computed(
  () => props.player?.name || String(props.player?.steam_id ?? ""),
);

// A plain Button rather than AlertDialogAction: the action closes the dialog
// before the request settles, and this has to stay open until it does.
async function confirmBlock() {
  if (!props.player?.steam_id) {
    return;
  }

  try {
    await block(props.player.steam_id);
  } catch {
    return;
  }

  open.value = false;

  toast({ title: t("player_blocks.toasts.blocked", { name: name.value }) });
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent data-right-hub-interactive>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ $t("player_blocks.confirm.title", { name }) }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("player_blocks.confirm.description", { name }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <Button variant="destructive" @click="confirmBlock">
          {{ $t("player_blocks.confirm.action") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
