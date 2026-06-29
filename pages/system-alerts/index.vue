<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Megaphone,
  Info,
  TriangleAlert,
  OctagonAlert,
  Lock,
} from "lucide-vue-next";
import DateTimePicker from "@/components/common/DateTimePicker.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import SystemAlertBannerItem from "~/components/SystemAlertBannerItem.vue";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { order_by } from "@/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { systemAlertAdminFields } from "~/graphql/systemAlertsGraphql";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";

definePageMeta({
  middleware: "admin",
});

const { t } = useI18n();

type AlertType = "info" | "warning" | "critical";

type AdminAlert = {
  id: string;
  type: AlertType;
  title: string | null;
  message: string;
  is_active: boolean;
  dismissible: boolean;
  expires_at: string | null;
  created_at: string;
};

const alerts = ref<AdminAlert[]>([]);
const loaded = ref(false);

const severity: Record<
  AlertType,
  { icon: any; accent: string; badge: string; color: string }
> = {
  info: {
    icon: Info,
    accent: "bg-info",
    badge: "bg-info/15 text-info",
    color: "text-info",
  },
  warning: {
    icon: TriangleAlert,
    accent: "bg-warning",
    badge: "bg-warning/15 text-warning",
    color: "text-warning",
  },
  critical: {
    icon: OctagonAlert,
    accent: "bg-destructive",
    badge: "bg-destructive/15 text-destructive",
    color: "text-destructive",
  },
};

const alertTypes = computed(() =>
  (["info", "warning", "critical"] as AlertType[]).map((value) => ({
    value,
    label: t(`system_alerts.types.${value}`),
    icon: severity[value].icon,
    color: severity[value].color,
  })),
);

const isExpired = (alert: AdminAlert) =>
  !!alert.expires_at && new Date(alert.expires_at).getTime() <= Date.now();

const blankForm = () => ({
  id: null as string | null,
  type: "info" as AlertType,
  title: "",
  message: "",
  dismissible: true,
  is_active: true,
  expires_at: "" as string,
});

const form = ref(blankForm());
const submitting = ref(false);
const sheetOpen = ref(false);

// Snapshot taken when the sheet opens — the floating save bar appears (in edit
// mode) only once the live form diverges from it; discard reverts to it.
const formSnapshot = ref("");
const snapshotForm = () => {
  formSnapshot.value = JSON.stringify(form.value);
};
const formDirty = computed(
  () => JSON.stringify(form.value) !== formSnapshot.value,
);
const formValid = computed(() => !!form.value.message.trim());
const discardForm = () => {
  form.value = JSON.parse(formSnapshot.value);
};

const isEditing = computed(() => form.value.id !== null);

const resetForm = () => {
  form.value = blankForm();
};

const openCreate = () => {
  resetForm();
  snapshotForm();
  sheetOpen.value = true;
};

const editAlert = (alert: AdminAlert) => {
  form.value = {
    id: alert.id,
    type: alert.type,
    title: alert.title ?? "",
    message: alert.message,
    dismissible: alert.dismissible,
    is_active: alert.is_active,
    expires_at: alert.expires_at ?? "",
  };
  snapshotForm();
  sheetOpen.value = true;
};

const onSheetUpdate = (open: boolean) => {
  sheetOpen.value = open;
  if (!open) {
    resetForm();
  }
};

const saveAlert = async () => {
  if (submitting.value || !form.value.message.trim()) {
    return;
  }
  submitting.value = true;
  try {
    const expires_at = form.value.expires_at
      ? new Date(form.value.expires_at).toISOString()
      : null;
    const title = form.value.title.trim() || null;

    if (isEditing.value) {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          update_system_alerts_by_pk: [
            {
              pk_columns: { id: form.value.id },
              _set: {
                type: form.value.type,
                title,
                message: form.value.message.trim(),
                dismissible: form.value.dismissible,
                is_active: form.value.is_active,
                expires_at,
                updated_at: new Date().toISOString(),
              },
            },
            { id: true },
          ],
        }),
      });
    } else {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          insert_system_alerts_one: [
            {
              object: {
                type: form.value.type,
                title,
                message: form.value.message.trim(),
                dismissible: form.value.dismissible,
                is_active: form.value.is_active,
                expires_at,
                created_by: useAuthStore().me?.steam_id,
              },
            },
            { id: true },
          ],
        }),
      });
    }

    toast({ title: t("system_alerts.saved") });
    sheetOpen.value = false;
    resetForm();
  } finally {
    submitting.value = false;
  }
};

const toggleActive = async (alert: AdminAlert) => {
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      update_system_alerts_by_pk: [
        {
          pk_columns: { id: alert.id },
          _set: {
            is_active: !alert.is_active,
            updated_at: new Date().toISOString(),
          },
        },
        { id: true },
      ],
    }),
  });
};

const pendingDelete = ref<AdminAlert | null>(null);

const askDelete = (alert: AdminAlert) => {
  pendingDelete.value = alert;
};

const confirmDelete = async () => {
  const alert = pendingDelete.value;
  pendingDelete.value = null;
  if (!alert) {
    return;
  }
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      delete_system_alerts_by_pk: [{ id: alert.id }, { id: true }],
    }),
  });
  if (form.value.id === alert.id) {
    sheetOpen.value = false;
    resetForm();
  }
  toast({ title: t("system_alerts.deleted") });
};

onMounted(() => {
  const { subscribe } = useSubscriptionManager();
  subscribe(
    "system-alerts:admin",
    getGraphqlClient()
      .subscribe({
        query: generateSubscription({
          system_alerts: [
            { order_by: [{ created_at: order_by.desc }] },
            systemAlertAdminFields,
          ],
        }),
      })
      .subscribe({
        next: ({ data }) => {
          alerts.value = data.system_alerts;
          loaded.value = true;
        },
      }),
  );
});

onUnmounted(() => {
  useSubscriptionManager().unsubscribe("system-alerts:admin");
});
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("system_alerts.page_title") }}</template>
      <template #subtitle>{{ $t("system_alerts.description") }}</template>

      <template #actions>
        <button
          v-if="alerts.length"
          type="button"
          :class="[
            tacticalCtaButtonClasses,
            tacticalHeaderActionClasses,
            'max-md:aspect-square max-md:!px-0',
          ]"
          :title="$t('system_alerts.create')"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          <span class="hidden md:inline">{{ $t("system_alerts.create") }}</span>
        </button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-6">
    <div class="space-y-3">
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses" />
        {{ $t("system_alerts.active_title") }}
      </div>

      <template v-if="!loaded">
        <div
          v-for="n in 3"
          :key="`skeleton-${n}`"
          class="relative flex items-stretch gap-3 overflow-hidden rounded-lg border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-border"
          />
          <div class="min-w-0 flex-1 space-y-2 py-4 pl-5 pr-2">
            <div class="flex items-center gap-2">
              <Skeleton class="h-4 w-12 rounded" />
              <Skeleton class="h-3 w-3 rounded-full" />
            </div>
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-3 w-3/4" />
          </div>
          <div class="flex shrink-0 items-center gap-2 pr-3">
            <Skeleton class="h-5 w-9 rounded-full" />
            <Skeleton class="h-8 w-8 rounded-md" />
          </div>
        </div>
      </template>

      <Empty v-else-if="!alerts.length" class="min-h-[200px]">
        <EmptyTitle>{{ $t("system_alerts.empty") }}</EmptyTitle>
        <EmptyDescription>{{
          $t("system_alerts.empty_description")
        }}</EmptyDescription>
        <button
          type="button"
          :class="tacticalCtaButtonClasses"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          {{ $t("system_alerts.create") }}
        </button>
      </Empty>

      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="relative flex items-stretch gap-3 overflow-hidden rounded-lg border border-border/60 bg-card/40 transition-colors [backdrop-filter:blur(6px)] hover:border-border"
        :class="{ 'opacity-60': !alert.is_active || isExpired(alert) }"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          :class="
            alert.is_active && !isExpired(alert)
              ? severity[alert.type].accent
              : 'bg-border'
          "
        />

        <button
          type="button"
          class="min-w-0 flex-1 space-y-1.5 py-4 pl-5 pr-2 text-left"
          @click="editAlert(alert)"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em]"
              :class="severity[alert.type].badge"
            >
              {{ $t(`system_alerts.types.${alert.type}`) }}
            </span>
            <span
              v-if="!alert.is_active"
              class="rounded bg-muted px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ $t("system_alerts.inactive") }}
            </span>
            <span
              v-else-if="isExpired(alert)"
              class="rounded bg-muted px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ $t("system_alerts.expired") }}
            </span>
            <span
              v-if="!alert.dismissible"
              class="inline-flex items-center"
              :title="$t('system_alerts.not_dismissible')"
            >
              <Lock
                class="size-3 text-muted-foreground"
                :aria-label="$t('system_alerts.not_dismissible')"
              />
            </span>
          </div>
          <p v-if="alert.title" class="font-semibold leading-tight">
            {{ alert.title }}
          </p>
          <p
            class="line-clamp-2 whitespace-pre-line break-words text-sm leading-snug text-muted-foreground"
          >
            {{ alert.message }}
          </p>
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[0.68rem] text-muted-foreground/80"
          >
            <TimeAgo :date="alert.created_at" class="font-mono" />
            <span v-if="alert.expires_at" class="font-mono">
              ·
              {{
                isExpired(alert)
                  ? $t("system_alerts.expired")
                  : $t("system_alerts.expires")
              }}
              {{ new Date(alert.expires_at).toLocaleString() }}
            </span>
          </div>
        </button>

        <div class="flex shrink-0 items-center gap-1 pr-3">
          <Switch
            :model-value="alert.is_active"
            :title="$t('system_alerts.fields.is_active')"
            @update:model-value="toggleActive(alert)"
          />
          <Button
            variant="ghost"
            size="icon"
            :title="$t('system_alerts.delete')"
            @click="askDelete(alert)"
          >
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  </PageTransition>

  <Sheet :open="sheetOpen" @update:open="onSheetUpdate">
    <SheetContent
      class="flex w-full flex-col gap-0 overflow-y-auto border-l-[hsl(var(--tac-amber)/0.25)] sm:max-w-lg"
    >
      <SheetHeader class="border-b border-border/60 pb-4 text-left">
        <SheetTitle
          class="flex items-center gap-2 font-sans text-base font-bold uppercase tracking-[0.18em]"
        >
          <Megaphone class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{
            isEditing
              ? $t("system_alerts.edit_title")
              : $t("system_alerts.create_title")
          }}
        </SheetTitle>
        <SheetDescription
          class="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]"
        >
          {{ $t("system_alerts.description") }}
        </SheetDescription>
      </SheetHeader>

      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="saveAlert">
        <div class="-mx-1 flex-1 space-y-5 overflow-y-auto px-1 py-5">
          <!-- Live preview of the banner as it will appear at the top. -->
          <div class="space-y-2">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("system_alerts.preview") }}
            </span>
            <div class="overflow-hidden rounded-md border border-border/60">
              <SystemAlertBannerItem
                :type="form.type"
                :title="form.title.trim() || null"
                :message="
                  form.message.trim() || $t('system_alerts.preview_placeholder')
                "
                :dismissible="form.dismissible"
                preview
              />
            </div>
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {{ $t("system_alerts.fields.type") }}
            </label>
            <Tabs v-model="form.type" class="w-full">
              <TabsList class="grid w-full grid-cols-3">
                <TabsTrigger
                  v-for="option in alertTypes"
                  :key="option.value"
                  :value="option.value"
                  class="text-xs font-bold uppercase tracking-[0.1em]"
                >
                  <span
                    class="flex items-center justify-center gap-1.5 leading-none"
                  >
                    <component
                      :is="option.icon"
                      class="size-3.5 shrink-0"
                      :class="option.color"
                    />
                    <span class="leading-none">{{ option.label }}</span>
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {{ $t("system_alerts.fields.title") }}
            </label>
            <Input
              v-model="form.title"
              :placeholder="$t('system_alerts.fields.title_placeholder')"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {{ $t("system_alerts.fields.message") }}
            </label>
            <Textarea
              v-model="form.message"
              :rows="4"
              :placeholder="$t('system_alerts.fields.message_placeholder')"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {{ $t("system_alerts.fields.expires_at") }}
            </label>
            <DateTimePicker v-model="form.expires_at" />
          </div>

          <div
            class="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div
                class="cursor-pointer select-none space-y-0.5"
                @click="form.is_active = !form.is_active"
              >
                <p class="text-sm font-medium">
                  {{ $t("system_alerts.fields.is_active") }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ $t("system_alerts.fields.is_active_hint") }}
                </p>
              </div>
              <Switch v-model="form.is_active" />
            </div>
            <div
              class="flex items-center justify-between gap-3 border-t border-border/40 pt-3"
            >
              <div
                class="cursor-pointer select-none space-y-0.5"
                @click="form.dismissible = !form.dismissible"
              >
                <p class="text-sm font-medium">
                  {{ $t("system_alerts.fields.dismissible") }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ $t("system_alerts.fields.dismissible_hint") }}
                </p>
              </div>
              <Switch v-model="form.dismissible" />
            </div>
          </div>
        </div>

        <SettingsSaveBar
          contained
          :dirty="formDirty"
          :submitting="submitting"
          :force-visible="!isEditing"
          :valid="formValid"
          :hide-discard="!isEditing"
          :action-label="
            isEditing ? $t('system_alerts.update') : $t('system_alerts.create')
          "
          @save="saveAlert"
          @discard="discardForm"
        />
      </form>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="!!pendingDelete"
    @update:open="(o) => !o && (pendingDelete = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("system_alerts.delete_confirm_title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("system_alerts.delete_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("system_alerts.cancel") }}</AlertDialogCancel>
        <Button
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmDelete"
        >
          {{ $t("system_alerts.delete") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
