<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronDown, ChevronUp, Layers, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import TimeAgo from "~/components/TimeAgo.vue";
import NotificationItem from "~/components/notification/NotificationItem.vue";
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

type StackNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_id?: string | null;
  is_read: boolean;
  deletable?: boolean;
  created_at: string;
  actions?: NotificationAction[];
};

const props = withDefaults(
  defineProps<{
    notifications: StackNotification[];
    variant?: "sheet" | "hub";
  }>(),
  { variant: "hub" },
);

const emit = defineEmits<{
  (e: "dismiss", id: string): void;
  (e: "delete", id: string): void;
  (
    e: "action",
    notification: StackNotification,
    action: NotificationAction,
  ): void;
  (e: "dismissAll", ids: string[]): void;
  (e: "deleteAll", ids: string[]): void;
}>();

const top = computed(() => props.notifications[0]);
const extraCount = computed(() => props.notifications.length - 1);
const hasUnread = computed(() => props.notifications.some((n) => !n.is_read));
const unreadIds = computed(() =>
  props.notifications.filter((n) => !n.is_read).map((n) => n.id),
);
const deletableIds = computed(() =>
  props.notifications.filter((n) => n.deletable !== false).map((n) => n.id),
);

const topCardClass = computed(() =>
  props.variant === "sheet"
    ? "relative w-full text-left rounded-lg shadow-md bg-accent p-4 hover:brightness-110 transition"
    : "relative w-full text-left rounded-md border border-border bg-card/60 p-3 hover:bg-card/80 transition-colors",
);

const peekBaseClass = computed(() =>
  props.variant === "sheet"
    ? "absolute inset-0 rounded-lg shadow-md bg-accent/70"
    : "absolute inset-0 rounded-md border border-border bg-card/40",
);

const expandedWrapperClass = computed(() =>
  props.variant === "sheet"
    ? "mb-4 rounded-lg bg-accent/30 p-2"
    : "mb-3 rounded-md border border-border bg-card/20 p-2",
);

const isOpen = ref(false);

function handleTopClick(event: MouseEvent) {
  const el = event.target as HTMLElement | null;
  if (el?.closest("a, button")) return;
  isOpen.value = true;
}
</script>

<template>
  <Collapsible v-model:open="isOpen" class="block">
    <div v-if="!isOpen" class="relative mb-4">
      <div
        v-if="notifications.length >= 3"
        :class="peekBaseClass"
        class="scale-[0.92] translate-y-3 opacity-70"
        aria-hidden="true"
      />
      <div
        v-if="notifications.length >= 2"
        :class="peekBaseClass"
        class="scale-[0.96] translate-y-1.5 opacity-85"
        aria-hidden="true"
      />

      <div
        role="button"
        tabindex="0"
        :class="[topCardClass, 'cursor-pointer']"
        @click="handleTopClick"
        @keydown.enter.prevent="isOpen = true"
        @keydown.space.prevent="isOpen = true"
      >
        <div class="absolute top-2 right-2 flex items-center gap-1">
          <span
            v-if="hasUnread"
            class="inline-block h-2 w-2 rounded-full bg-red-500 mr-1"
            aria-hidden="true"
          />
          <Button
            v-if="!top.is_read && top.deletable !== false"
            size="icon"
            variant="ghost"
            class="h-6 w-6"
            @click.stop="emit('dismiss', top.id)"
          >
            <Check class="h-3.5 w-3.5" />
            <span class="sr-only">{{ $t("layouts.notifications.dismiss") }}</span>
          </Button>
          <Button
            v-if="top.deletable !== false"
            size="icon"
            variant="ghost"
            class="h-6 w-6"
            @click.stop="emit('delete', top.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
            <span class="sr-only">{{ $t("common.delete") }}</span>
          </Button>
        </div>

        <h3
          :class="[
            'text-lg font-semibold pr-20',
            top.is_read ? 'text-muted-foreground' : '',
          ]"
        >
          {{ top.title }}
        </h3>

        <p
          v-if="top.type !== 'NameChangeRequest'"
          class="[&_a]:text-blue-500 [&_a]:underline [&_a:hover]:text-blue-700 text-sm mt-1 line-clamp-2"
          :class="
            top.is_read ? 'text-muted-foreground/70' : 'text-muted-foreground'
          "
        >
          <NotificationMessage :html="top.message" />
        </p>
        <p
          v-else
          class="text-sm mt-1 line-clamp-2"
          :class="
            top.is_read ? 'text-muted-foreground/70' : 'text-muted-foreground'
          "
        >
          {{ top.message }}
        </p>

        <NotificationContext
          v-if="top.entity_id"
          :type="top.type"
          :entity-id="top.entity_id"
          class="mt-2"
        />

        <div class="flex justify-between items-center mt-2">
          <span
            :class="[
              'text-xs',
              top.is_read
                ? 'text-muted-foreground/50'
                : 'text-muted-foreground',
            ]"
          >
            <TimeAgo :date="top.created_at" />
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground"
          >
            <Layers class="h-3 w-3" />
            +{{ extraCount }}
            <ChevronDown class="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>

    <CollapsibleContent>
      <div :class="expandedWrapperClass">
        <div class="flex items-center justify-between px-1 mb-2">
          <CollapsibleTrigger as-child>
            <Button size="sm" variant="ghost">
              <ChevronUp class="h-4 w-4 mr-1" />
              {{ notifications.length }}
            </Button>
          </CollapsibleTrigger>
          <div class="flex gap-2">
            <Button
              v-if="unreadIds.length > 0"
              size="sm"
              variant="outline"
              @click="emit('dismissAll', unreadIds)"
            >
              {{ $t("layouts.notifications.dismiss_all") }}
            </Button>
            <Button
              v-if="deletableIds.length > 0"
              size="sm"
              variant="outline"
              class="bg-destructive text-white"
              @click="emit('deleteAll', deletableIds)"
            >
              {{ $t("common.delete") }}
            </Button>
          </div>
        </div>

        <NotificationContext
          v-if="top.entity_id"
          :type="top.type"
          :entity-id="top.entity_id"
          class="mx-1 mb-2"
        />

        <NotificationItem
          v-for="n of notifications"
          :key="n.id"
          :notification="n"
          :variant="variant"
          :show-context="false"
          @dismiss="(id) => emit('dismiss', id)"
          @delete="(id) => emit('delete', id)"
          @action="
            (notification, action) => emit('action', notification, action)
          "
        />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
