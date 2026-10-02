<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BellOff, MoreVertical, Settings } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ToastAction, toast } from "~/components/ui/toast";

const props = defineProps<{
  type: string;
  triggerClass?: string;
}>();

const { t } = useI18n();
const { preferences, set } = useNotificationPreferences();
const { kindTitle } = useNotificationKinds();

const kind = computed(() => kindTitle(props.type));

const canTurnOff = computed(() =>
  preferences.value.in_app.some(
    (entry) => entry.key === props.type && entry.enabled,
  ),
);

const open = ref(false);

watch(open, (isOpen, wasOpen) => {
  const rightSidebar = useRightSidebar();
  if (isOpen && !wasOpen) {
    rightSidebar.suspendHoverClose();
  } else if (!isOpen && wasOpen) {
    rightSidebar.resumeHoverClose();
  }
});

onBeforeUnmount(() => {
  if (open.value) {
    useRightSidebar().resumeHoverClose();
  }
});

async function setKind(type: string, enabled: boolean): Promise<boolean> {
  try {
    await set("in_app", type, enabled);
    return true;
  } catch {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: t("pages.settings.notifications.save_failed"),
    });
    return false;
  }
}

// Captured up front: in a stack this menu sits on the top card, which shows
// the next row's kind as soon as this one is filtered out of the bell, so
// props.type no longer names what Undo has to restore.
async function turnOff() {
  const type = props.type;
  const label = kindTitle(type);
  const previous =
    preferences.value.in_app.find((entry) => entry.key === type)?.enabled ??
    true;

  if (!(await setKind(type, false))) {
    return;
  }

  toast({
    title: t("layouts.notifications.kind_menu.turned_off", { kind: label }),
    description: t("layouts.notifications.kind_menu.turned_off_hint"),
    // The Toaster renders this with <component :is>, so it has to be a real
    // component rather than a {label, onClick} bag.
    action: h(
      ToastAction,
      {
        altText: t("common.undo"),
        onClick: () => setKind(type, previous),
      },
      () => t("common.undo"),
    ),
  });
}
</script>

<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        size="icon"
        variant="ghost"
        :class="[
          'text-muted-foreground hover:text-foreground data-[state=open]:text-foreground',
          triggerClass,
        ]"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <MoreVertical class="h-4 w-4" />
        <span class="sr-only">{{
          $t("layouts.notifications.kind_menu.label")
        }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60" data-right-hub-interactive>
      <DropdownMenuItem v-if="canTurnOff" @select="turnOff">
        <BellOff />
        <span>{{
          $t("layouts.notifications.kind_menu.turn_off", { kind })
        }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem as-child>
        <NuxtLink to="/settings/notifications">
          <Settings />
          <span>{{ $t("layouts.notifications.settings") }}</span>
        </NuxtLink>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
