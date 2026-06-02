<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { LogOut } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "@/components/ui/toast";

const props = defineProps<{
  player: Record<string, any>;
  serverId: string;
}>();

const emit = defineEmits<{ (e: "kicked"): void }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const open = ref(false);
const reason = ref("");
const submitting = ref(false);

const kickMutation = gql`
  mutation KickServerPlayer(
    $serverId: String!
    $steam_id: String!
    $reason: String
  ) {
    kickServerPlayer(
      serverId: $serverId
      steam_id: $steam_id
      reason: $reason
    ) {
      kicked
      message
    }
  }
`;

async function kick() {
  if (submitting.value) {
    return;
  }

  submitting.value = true;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: kickMutation,
      variables: {
        serverId: props.serverId,
        steam_id: props.player.steam_id,
        reason: reason.value || null,
      },
    });

    const result = data?.kickServerPlayer;

    if (result?.kicked) {
      toast({ title: t("player.kick.kicked", { name: props.player.name }) });
    } else {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: result?.message,
      });
    }

    open.value = false;
    reason.value = "";
    emit("kicked");
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <button
    type="button"
    :title="$t('player.kick.button')"
    :aria-label="$t('player.kick.button')"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-amber-500/45 bg-amber-500/10 text-amber-400 transition-colors hover:border-amber-500/80 hover:bg-amber-500/20 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    @click="open = true"
  >
    <LogOut class="h-4 w-4" />
  </button>

  <Dialog :open="open" @update:open="open = $event">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{ $t("player.kick.title", { name: player.name }) }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("player.kick.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-2 py-2">
        <Label>{{ $t("player.kick.reason_label") }}</Label>
        <Input
          v-model="reason"
          :placeholder="$t('player.kick.reason_placeholder')"
          @keyup.enter="kick"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button :loading="submitting" @click="kick">
          {{ $t("player.kick.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
