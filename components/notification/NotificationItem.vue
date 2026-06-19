<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { Trash2, Check } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import TimeAgo from "~/components/TimeAgo.vue";
import NotificationContext from "~/components/notification/NotificationContext.vue";
import NotificationMessage from "~/components/notification/NotificationMessage.vue";

type NotificationAction = {
  label: string;
  graphql: {
    type: string;
    action: string;
    selection: Record<string, any>;
    variables?: Record<string, any>;
  };
};

type NotificationItemProps = {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    steam_id?: string | null;
    entity_id?: string | null;
    is_read: boolean;
    deletable?: boolean;
    created_at: string;
    actions?: NotificationAction[];
  };
  variant?: "sheet" | "hub";
  showContext?: boolean;
};

const props = withDefaults(defineProps<NotificationItemProps>(), {
  variant: "hub",
  showContext: true,
});

const emit = defineEmits<{
  (e: "dismiss", id: string): void;
  (e: "delete", id: string): void;
  (
    e: "action",
    notification: NotificationItemProps["notification"],
    action: NotificationAction,
  ): void;
}>();

const wrapperClass = computed(() =>
  props.variant === "sheet"
    ? "mb-4 p-4 rounded-lg shadow-md relative"
    : "mb-3 p-3 rounded-md border border-border bg-card/40 relative",
);

const deleting = ref(false);
const dismissed = ref(false);
const actioningIndex = ref<number | null>(null);
let deleteTimer: ReturnType<typeof setTimeout> | undefined;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;
let actionTimer: ReturnType<typeof setTimeout> | undefined;

function onDelete() {
  if (deleting.value) {
    return;
  }
  deleting.value = true;
  emit("delete", props.notification.id);
  deleteTimer = setTimeout(() => {
    deleting.value = false;
  }, 6000);
}

function onDismiss() {
  if (dismissed.value) {
    return;
  }
  dismissed.value = true;
  emit("dismiss", props.notification.id);
  dismissTimer = setTimeout(() => {
    dismissed.value = false;
  }, 1200);
}

function onAction(
  notification: NotificationItemProps["notification"],
  action: NotificationAction,
  index: number,
) {
  if (actioningIndex.value !== null) {
    return;
  }
  actioningIndex.value = index;
  emit("action", notification, action);
  actionTimer = setTimeout(() => {
    actioningIndex.value = null;
  }, 6000);
}

onBeforeUnmount(() => {
  clearTimeout(deleteTimer);
  clearTimeout(dismissTimer);
  clearTimeout(actionTimer);
});
</script>

<template>
  <div :class="wrapperClass">
    <Button
      v-if="notification.deletable !== false"
      size="icon"
      variant="ghost"
      :loading="deleting"
      @click="onDelete"
      class="absolute top-2 right-2"
    >
      <Trash2 class="h-4 w-4" />
      <span class="sr-only">{{ $t("common.delete") }}</span>
    </Button>
    <h3
      :class="[
        'text-lg font-semibold mb-2',
        notification.is_read ? 'text-muted-foreground' : '',
      ]"
    >
      {{ notification.title }}
    </h3>

    <template v-if="notification.type !== 'NameChangeRequest'">
      <p
        class="[&_a]:text-blue-500 [&_a]:underline [&_a:hover]:text-blue-700"
        :class="[
          'text-sm mb-2',
          notification.is_read
            ? 'text-muted-foreground/70'
            : 'text-muted-foreground',
        ]"
      >
        <NotificationMessage :html="notification.message" />
      </p>
    </template>
    <template v-else>
      <p
        class="[&_a]:text-blue-500 [&_a]:underline [&_a:hover]:text-blue-700"
        :class="[
          'text-sm mb-2',
          notification.is_read
            ? 'text-muted-foreground/70'
            : 'text-muted-foreground',
        ]"
      >
        {{ notification.message }}
      </p>
    </template>

    <NotificationContext
      v-if="
        showContext &&
        notification.entity_id &&
        notification.steam_id !== notification.entity_id
      "
      :type="notification.type"
      :entity-id="notification.entity_id"
      class="mb-2"
    />

    <div class="flex justify-between items-center">
      <span
        :class="[
          'text-xs',
          notification.is_read
            ? 'text-muted-foreground/50'
            : 'text-muted-foreground',
        ]"
      >
        <TimeAgo :date="notification.created_at" />
      </span>
      <template v-if="notification.actions">
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            :loading="actioningIndex === index"
            @click="onAction(notification, action, index)"
            :key="index"
            v-for="(action, index) of notification.actions"
          >
            {{ action.label }}
          </Button>
        </div>
      </template>
      <template v-else>
        <Button
          size="sm"
          variant="outline"
          :disabled="dismissed"
          @click="onDismiss"
          v-if="
            dismissed ||
            (!notification.is_read && notification.deletable !== false)
          "
        >
          <Check v-if="dismissed" class="h-4 w-4 text-green-500" />
          <template v-else>
            {{ $t("layouts.notifications.dismiss") }}
          </template>
        </Button>
      </template>
    </div>
  </div>
</template>
