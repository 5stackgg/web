<script setup lang="ts">
import { absoluteTime, relativeTime } from "~/utilities/alertTimeFormat";
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
  h,
  onMounted,
  onUnmounted,
} from "vue";
import { useI18n } from "vue-i18n";
import {
  Plus,
  Trash2,
  Info,
  TriangleAlert,
  OctagonAlert,
} from "lucide-vue-next";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { ToastAction, toast } from "~/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DateTimePicker from "~/components/common/DateTimePicker.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import SystemAlertBannerItem from "~/components/SystemAlertBannerItem.vue";
import AlertTimeline from "~/components/system-alerts/AlertTimeline.vue";
import {
  listCreateButtonClasses,
  createButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { order_by } from "@/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { systemAlertAdminFields } from "~/graphql/systemAlertsGraphql";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { dateLocale } from "~/utilities/dateLocale";
import {
  readRememberedView,
  saveRememberedView,
} from "~/composables/useRememberedView";
import {
  DAY,
  HOUR,
  RANGES,
  alertLabel,
  alertState,
  chipMatches,
  defaultRange,
  reuseEnd,
  roundTo5Minutes,
  showingSummary,
  toMs,
  type AlertType,
  type RangeKey,
  type TimelineAlert,
} from "~/utilities/alertTimeline";

definePageMeta({
  middleware: "admin",
});

const { t } = useI18n();

type AdminAlert = TimelineAlert & { created_by?: string | null };

const alerts = ref<AdminAlert[]>([]);
const loaded = ref(false);

// Optimistic patches from the Showing switches, laid over the subscription
// until the server row agrees (or the mutation fails).
type Patch = Partial<
  Pick<AdminAlert, "is_active" | "expires_at" | "updated_at">
>;
const overrides = reactive<Record<string, Patch>>({});

const sameTime = (a: string | null | undefined, b: string | null | undefined) =>
  toMs(a) === toMs(b);

function settled(row: AdminAlert, patch: Patch) {
  return (Object.keys(patch) as Array<keyof Patch>).every((key) =>
    key === "is_active"
      ? row.is_active === patch.is_active
      : sameTime(row[key] as string | null, patch[key] as string | null),
  );
}

const view = computed<AdminAlert[]>(() =>
  alerts.value.map((a) => (overrides[a.id] ? { ...a, ...overrides[a.id] } : a)),
);
const alertById = (id: string | null) =>
  (id && view.value.find((a) => a.id === id)) || null;

// Re-evaluated so an alert that reaches its end time drops to Expired
// without a server event, like the banner store does.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

// The range picked last time comes back; until one is picked, the first load
// chooses one that shows something.
const VIEW_KEY = "system-alerts";
const viewDefaults = () => ({ range: null as RangeKey | null });
const remembered = readRememberedView(VIEW_KEY, viewDefaults(), {
  range: (value) =>
    value === null ||
    (typeof value === "string" && Object.keys(RANGES).includes(value)),
});
const range = ref<RangeKey>(remembered.range ?? "week");
function pickRange(next: RangeKey) {
  range.value = next;
  saveRememberedView(VIEW_KEY, { range: next }, viewDefaults());
}
const includeOlder = ref(false);
const rangeOptions = computed(() =>
  (["day", "week", "month", "quarter"] as RangeKey[]).map((key) => ({
    key,
    label: t(`pages.system_alerts.range.${key}`),
  })),
);
watch(range, (next) => {
  if (next !== "quarter") includeOlder.value = false;
});
// On phones the range strip scrolls sideways; keep the picked range in view.
const rangeStrip = ref<HTMLElement | null>(null);
watch(
  [range, rangeStrip],
  () => {
    const strip = rangeStrip.value;
    const index = rangeOptions.value.findIndex((o) => o.key === range.value);
    const button = strip?.querySelectorAll("button")[index];
    if (!strip || !button) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = right - strip.clientWidth;
    }
  },
  { flush: "post" },
);
function widen() {
  if (range.value !== "quarter") {
    pickRange("quarter");
  } else {
    includeOlder.value = true;
  }
}

const summary = computed(() => showingSummary(view.value, now.value));

const iso = (ms: number) => new Date(ms).toISOString();
const rel = (ms: number) => relativeTime(ms, now.value);
const abs = (ms: number) => absoluteTime(ms);
const nameOf = (a: Pick<AdminAlert, "title" | "message">) =>
  alertLabel(a) || t("common.untitled");

// ---- Showing switch ----

async function applyPatch(id: string, patch: Patch): Promise<boolean> {
  const mine = { ...(overrides[id] ?? {}), ...patch };
  overrides[id] = mine;
  try {
    await getGraphqlClient().mutate({
      mutation: generateMutation({
        update_system_alerts_by_pk: [
          { pk_columns: { id }, _set: patch },
          { id: true },
        ],
      }),
    });
    const row = alerts.value.find((a) => a.id === id);
    if (row && overrides[id] === mine && settled(row, mine)) {
      delete overrides[id];
    }
    // Never let a patch outlive a subscription that missed the update.
    setTimeout(() => {
      if (overrides[id] === mine) delete overrides[id];
    }, 10_000);
    return true;
  } catch {
    // The app already toasts GraphQL errors; just put the row back.
    if (overrides[id] === mine) delete overrides[id];
    return false;
  }
}

function syncEditorEnd(id: string, exp: string | null) {
  if (editorMode.value !== "edit" || editingId.value !== id) return;
  form.exp = toMs(exp);
  snapshot.value = { ...snapshot.value, exp: form.exp };
  pickerKey.value++;
}

function actionToast(
  title: string,
  actions: Array<{ label: string; run: () => void }>,
) {
  toast({
    title,
    // The Toaster renders this with <component :is>, so it's a vnode.
    action: h(
      "div",
      { class: "flex shrink-0 gap-2" },
      actions.map((a) =>
        h(ToastAction, { altText: a.label, onClick: a.run }, () => a.label),
      ),
    ),
  });
}

// Off or Expired goes up now, reusing its last length; Showing comes down
// now. Locked alerts toggle the same way.
async function quickToggle(id: string, opts: { fromSheet?: boolean } = {}) {
  const alert = alertById(id);
  if (!alert) return;
  const n = Date.now();
  now.value = n;
  const before: Patch = {
    is_active: alert.is_active,
    expires_at: alert.expires_at,
    ...(alert.updated_at ? { updated_at: alert.updated_at } : {}),
  };
  const name = nameOf(alert);
  const undo = async () => {
    if (await applyPatch(id, before)) {
      syncEditorEnd(id, before.expires_at ?? null);
      toast({ title: t("pages.system_alerts.toast.restored", { name }) });
    }
  };

  if (alertState(alert, n) === "live") {
    if (!(await applyPatch(id, { is_active: false, updated_at: iso(n) }))) {
      return;
    }
    actionToast(t("pages.system_alerts.toast.turned_off", { name }), [
      { label: t("common.undo"), run: undo },
    ]);
    return;
  }

  const end = reuseEnd(alert, n);
  const expires_at = end ? iso(end) : null;
  if (
    !(await applyPatch(id, {
      is_active: true,
      updated_at: iso(n),
      expires_at,
    }))
  ) {
    return;
  }
  syncEditorEnd(id, expires_at);
  actionToast(
    end
      ? t("pages.system_alerts.toast.showing_ends", { name, time: rel(end) })
      : t("pages.system_alerts.toast.showing_no_end", { name }),
    [
      { label: t("common.undo"), run: undo },
      ...(opts.fromSheet
        ? []
        : [
            {
              label: t("pages.system_alerts.toast.change_end"),
              run: () => openEditor(id, "schedule"),
            },
          ]),
    ],
  );
}

// ---- Editor sheet ----

type AlertForm = {
  type: AlertType;
  title: string;
  message: string;
  dismissible: boolean;
  is_active: boolean;
  exp: number | null;
};

const blankForm = (): AlertForm => ({
  type: "info",
  title: "",
  message: "",
  dismissible: true,
  is_active: true,
  exp: null,
});

const sheetOpen = ref(false);
// Kept through the close animation, so the sheet never flips its title on
// the way out.
const editorMode = ref<"new" | "edit">("new");
const editingId = ref<string | null>(null);
const form = reactive<AlertForm>(blankForm());
const snapshot = ref<AlertForm>(blankForm());
const saving = ref(false);
const pickerKey = ref(0);
const scheduleRef = ref<HTMLElement | null>(null);
const messageRef = ref<InstanceType<typeof Textarea> | null>(null);
let openFocus: "schedule" | null = null;

const editingAlert = computed(() =>
  editorMode.value === "edit" ? alertById(editingId.value) : null,
);
const isNew = computed(() => editorMode.value === "new");
const dirty = computed(
  () =>
    !isNew.value &&
    JSON.stringify({ ...form, is_active: null }) !==
      JSON.stringify({ ...snapshot.value, is_active: null }),
);
const valid = computed(() => !!form.message.trim());

function formOf(a: AdminAlert): AlertForm {
  return {
    type: a.type,
    title: a.title ?? "",
    message: a.message,
    dismissible: a.dismissible,
    is_active: a.is_active,
    exp: toMs(a.expires_at),
  };
}

function openEditor(id: string | null, focus: "schedule" | null = null) {
  const alert = alertById(id);
  Object.assign(form, alert ? formOf(alert) : blankForm());
  snapshot.value = { ...form };
  editingId.value = alert ? alert.id : null;
  editorMode.value = alert ? "edit" : "new";
  openFocus = focus;
  pickerKey.value++;
  now.value = Date.now();
  sheetOpen.value = true;
}

function onSheetOpen(open: boolean) {
  sheetOpen.value = open;
}

// Deleted from somewhere else while open: nothing left to edit.
watch(editingAlert, (alert) => {
  if (sheetOpen.value && editorMode.value === "edit" && !alert) {
    sheetOpen.value = false;
  }
});

function onSheetAutoFocus(event: Event) {
  event.preventDefault();
  nextTick(() => {
    if (openFocus === "schedule") {
      scheduleRef.value?.scrollIntoView({ block: "center" });
      scheduleRef.value?.querySelector<HTMLElement>("button")?.focus({
        preventScroll: true,
      });
    } else if (isNew.value) {
      (messageRef.value?.$el as HTMLElement | undefined)?.focus?.();
    }
    openFocus = null;
  });
}

function discard() {
  Object.assign(form, snapshot.value);
  pickerKey.value++;
}

// What the timeline draws for the alert being edited: the saved row with
// the form's text, severity and end time. Showing stays the row's own.
const editingView = computed(() => {
  const a = editingAlert.value;
  if (!a || !sheetOpen.value || isNew.value) return null;
  return {
    id: a.id,
    dirty: dirty.value,
    alert: {
      ...a,
      type: form.type,
      title: form.title.trim() || null,
      message: form.message,
      dismissible: form.dismissible,
      expires_at: form.exp ? iso(form.exp) : null,
    },
  };
});

const draftView = computed<TimelineAlert | null>(() =>
  sheetOpen.value && isNew.value
    ? {
        id: "draft",
        type: form.type,
        title: form.title.trim() || null,
        message: form.message,
        is_active: true,
        dismissible: form.dismissible,
        expires_at: form.exp ? iso(form.exp) : null,
        created_at: iso(now.value),
        updated_at: null,
      }
    : null,
);

const chips = computed(() => [
  { value: null, label: t("pages.system_alerts.chips.none") },
  { value: HOUR, label: t("pages.system_alerts.chips.hour") },
  { value: 6 * HOUR, label: t("pages.system_alerts.chips.six_hours") },
  { value: DAY, label: t("pages.system_alerts.chips.day") },
  { value: 3 * DAY, label: t("pages.system_alerts.chips.three_days") },
]);

function pickChip(value: number | null) {
  form.exp = value === null ? null : roundTo5Minutes(Date.now() + value);
  pickerKey.value++;
}

const scheduleLine = computed(() => {
  if (!form.exp) return t("pages.system_alerts.schedule.no_end");
  return t(
    form.exp <= now.value
      ? "pages.system_alerts.schedule.ended"
      : "pages.system_alerts.schedule.ends",
    { time: abs(form.exp), relative: rel(form.exp) },
  );
});

const severityIcons = {
  info: Info,
  warning: TriangleAlert,
  critical: OctagonAlert,
};
const severityOptions = computed(() =>
  (["info", "warning", "critical"] as AlertType[]).map((key) => ({
    key,
    label: t(`system_alerts.types.${key}`),
    icon: severityIcons[key],
  })),
);

const sheetShowing = computed(() =>
  isNew.value
    ? form.is_active
    : !!editingAlert.value &&
      alertState(editingAlert.value, now.value) === "live",
);

function onSheetShowing(value: boolean) {
  if (isNew.value) {
    form.is_active = value;
    return;
  }
  if (editingAlert.value) {
    void quickToggle(editingAlert.value.id, { fromSheet: true });
  }
}

async function save() {
  if (saving.value || !valid.value) return;
  saving.value = true;
  const n = Date.now();
  const fields = {
    type: form.type,
    title: form.title.trim() || null,
    message: form.message.trim(),
    dismissible: form.dismissible,
    expires_at: form.exp ? iso(form.exp) : null,
  };
  try {
    if (isNew.value) {
      // `created_by` is a Hasura session preset on insert: never sent.
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          insert_system_alerts_one: [
            { object: { ...fields, is_active: form.is_active } },
            { id: true },
          ],
        }),
      });
      const showing = form.is_active && (!form.exp || form.exp > n);
      toast({
        title: showing
          ? t("pages.system_alerts.toast.created_showing")
          : t("pages.system_alerts.toast.created_off"),
      });
    } else {
      const alert = editingAlert.value!;
      const wasLive = alertState(alert, n) === "live";
      const willBeLive =
        alertState({ ...alert, expires_at: fields.expires_at }, n) === "live";
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          update_system_alerts_by_pk: [
            {
              pk_columns: { id: alert.id },
              // updated_at marks when it went up (the bar's start), so only
              // an edit that puts it back up stamps it.
              _set: {
                ...fields,
                ...(!wasLive && willBeLive ? { updated_at: iso(n) } : {}),
              },
            },
            { id: true },
          ],
        }),
      });
      toast({ title: t("system_alerts.saved") });
    }
    onSheetOpen(false);
  } catch {
    // Toasted by the app; the sheet stays open with the edits.
  } finally {
    saving.value = false;
  }
}

const deleteOpen = ref(false);
const deleting = ref(false);
async function confirmDelete() {
  const id = editingAlert.value?.id;
  if (!id || deleting.value) return;
  deleting.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: generateMutation({
        delete_system_alerts_by_pk: [{ id }, { id: true }],
      }),
    });
    deleteOpen.value = false;
    onSheetOpen(false);
    toast({ title: t("system_alerts.deleted") });
  } finally {
    deleting.value = false;
  }
}

// ---- Data ----

let previousLive = new Set<string>();
function noteExpiries() {
  const live = new Set(
    view.value
      .filter((a) => alertState(a, now.value) === "live")
      .map((a) => a.id),
  );
  const expired = [...previousLive]
    .filter((id) => !live.has(id))
    .map((id) => alertById(id))
    .filter(
      (a): a is AdminAlert =>
        !!a && !overrides[a.id] && alertState(a, now.value) === "expired",
    );
  previousLive = live;
  if (expired.length) {
    toast({
      title: t("pages.system_alerts.toast.expired", {
        name: nameOf(expired[0]),
      }),
    });
  }
}

let rangeChosen = remembered.range !== null;

onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
    noteExpiries();
  }, 30_000);

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
          alerts.value = data.system_alerts as AdminAlert[];
          for (const id of Object.keys(overrides)) {
            const row = alerts.value.find((a) => a.id === id);
            if (!row || settled(row, overrides[id])) delete overrides[id];
          }
          if (!rangeChosen) {
            range.value = defaultRange(alerts.value, Date.now());
            rangeChosen = true;
          }
          if (!loaded.value) {
            previousLive = new Set(
              view.value
                .filter((a) => alertState(a, now.value) === "live")
                .map((a) => a.id),
            );
          }
          loaded.value = true;
        },
      }),
  );
});

onUnmounted(() => {
  if (ticker) clearInterval(ticker);
  useSubscriptionManager().unsubscribe("system-alerts:admin");
});

const fieldLabel = "text-sm font-medium text-foreground";
</script>

<template>
  <h1 class="sr-only">{{ $t("system_alerts.page_title") }}</h1>

  <PageTransition :delay="0">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div
        v-if="loaded && alerts.length"
        ref="rangeStrip"
        class="flex max-w-full overflow-x-auto [scrollbar-width:none]"
      >
        <AnimatedFilters
          :model-value="range"
          :options="rangeOptions"
          square
          class="max-sm:w-max max-sm:max-w-none max-sm:flex-nowrap"
          @update:model-value="(v) => pickRange(v as RangeKey)"
        />
      </div>
      <p
        v-if="loaded && alerts.length"
        class="text-sm text-muted-foreground"
        aria-live="polite"
      >
        <template v-if="summary.showing">
          <i18n-t
            keypath="pages.system_alerts.summary.showing"
            :plural="summary.showing"
            tag="span"
            scope="global"
          >
            <template #count>
              <b class="font-semibold tabular-nums text-foreground">{{
                summary.showing
              }}</b>
            </template>
          </i18n-t>
          <template v-if="summary.locked">
            <span aria-hidden="true"> · </span>
            <span class="text-destructive">{{
              $t(
                "pages.system_alerts.summary.locked",
                { count: summary.locked },
                summary.locked,
              )
            }}</span>
          </template>
        </template>
        <template v-else>{{ $t("pages.system_alerts.summary.none") }}</template>
      </p>
      <Button
        size="sm"
        class="ml-auto"
        :class="listCreateButtonClasses"
        :title="$t('pages.system_alerts.create')"
        @click="openEditor(null)"
      >
        <Plus class="h-4 w-4" />
        <span class="max-md:sr-only">{{
          $t("pages.system_alerts.create")
        }}</span>
      </Button>
    </div>
  </PageTransition>

  <PageTransition :delay="60" class="mt-5">
    <FadeSwap>
      <div
        v-if="!loaded"
        key="loading"
        class="grid gap-px overflow-hidden rounded-lg border border-border"
      >
        <div
          v-for="n in 3"
          :key="n"
          class="grid grid-cols-[232px_minmax(0,1fr)] items-center gap-4 px-3 py-3 max-sm:grid-cols-1"
        >
          <div class="grid gap-1.5">
            <Skeleton class="h-3.5 w-40" />
            <Skeleton class="h-3 w-24" />
          </div>
          <Skeleton class="h-3.5 w-1/2 max-sm:hidden" />
        </div>
      </div>

      <SectionEmpty
        v-else-if="!alerts.length && !(sheetOpen && isNew)"
        key="empty"
        :title="$t('pages.system_alerts.empty')"
        :description="$t('system_alerts.empty_description')"
      >
        <Button
          size="sm"
          :class="createButtonClasses"
          @click="openEditor(null)"
        >
          <Plus class="h-4 w-4" />
          {{ $t("pages.system_alerts.create") }}
        </Button>
      </SectionEmpty>

      <div v-else key="timeline" class="grid gap-2">
        <AlertTimeline
          :alerts="view"
          :now="now"
          :range="range"
          :include-older="includeOlder"
          :editing="editingView"
          :draft="draftView"
          @open="(id) => openEditor(id)"
          @toggle="(id) => quickToggle(id)"
          @widen="widen"
        />
        <p class="text-xs text-muted-foreground/70">
          {{ $t("pages.system_alerts.hint") }}
        </p>
      </div>
    </FadeSwap>
  </PageTransition>

  <Sheet :open="sheetOpen" @update:open="onSheetOpen">
    <SheetContent
      class="flex w-full flex-col gap-0 p-0 sm:max-w-[500px]"
      overlay-class="bg-black/40"
      @open-auto-focus="onSheetAutoFocus"
    >
      <div
        class="flex items-start gap-4 border-b border-border px-6 pb-4 pr-12 pt-5"
      >
        <div class="grid min-w-0 flex-1 gap-1">
          <SheetTitle class="text-base font-semibold">
            {{
              isNew
                ? $t("pages.system_alerts.new_alert")
                : $t("pages.system_alerts.edit_alert")
            }}
          </SheetTitle>
          <SheetDescription class="text-xs">
            <template v-if="editingAlert">{{
              $t("pages.system_alerts.created_at", {
                time: abs(toMs(editingAlert.created_at) ?? now),
              })
            }}</template>
            <template v-else>{{ $t("pages.system_alerts.new_hint") }}</template>
          </SheetDescription>
        </div>
        <div class="flex shrink-0 items-center gap-2 pt-0.5">
          <Label
            for="alert-sheet-showing"
            class="text-sm text-muted-foreground"
          >
            {{ $t("pages.system_alerts.showing") }}
          </Label>
          <Switch
            id="alert-sheet-showing"
            :model-value="sheetShowing"
            @update:model-value="onSheetShowing"
          />
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <!-- The banner as visitors will see it, pinned while the form
             scrolls under it. -->
        <div
          class="sticky top-0 z-10 -mx-6 grid gap-2 border-b border-border bg-background px-6 pb-4 pt-4"
        >
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("system_alerts.preview") }}
          </div>
          <div class="overflow-hidden rounded-md border border-border">
            <p
              class="border-b border-border/60 bg-muted/30 px-3 py-1 text-[0.7rem] text-muted-foreground"
            >
              {{ $t("pages.system_alerts.preview_caption") }}
            </p>
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

        <form class="grid gap-0 pb-6" @submit.prevent="save">
          <section class="grid gap-4 py-5">
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("pages.system_alerts.sections.message") }}
            </div>
            <div class="grid gap-2">
              <Label for="alert-title" :class="fieldLabel">
                {{ $t("system_alerts.fields.title") }}
              </Label>
              <Input
                id="alert-title"
                v-model="form.title"
                :placeholder="$t('system_alerts.fields.title_placeholder')"
              />
            </div>
            <div class="grid gap-2">
              <Label for="alert-message" :class="fieldLabel">
                {{ $t("system_alerts.fields.message") }}
              </Label>
              <Textarea
                id="alert-message"
                ref="messageRef"
                v-model="form.message"
                :rows="4"
                :placeholder="$t('system_alerts.fields.message_placeholder')"
              />
              <p class="text-xs text-muted-foreground">
                {{ $t("system_alerts.fields.message_link_hint") }}
              </p>
            </div>
          </section>

          <section class="grid gap-4 border-t border-border/60 py-5">
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("pages.system_alerts.sections.display") }}
            </div>
            <div class="grid gap-2">
              <span :class="fieldLabel">{{
                $t("system_alerts.fields.type")
              }}</span>
              <AnimatedFilters
                :model-value="form.type"
                :options="severityOptions"
                square
                block
                @update:model-value="(v) => (form.type = v as AlertType)"
              />
            </div>
            <label
              class="flex min-h-11 cursor-pointer items-center gap-3 border-y border-border/60 text-sm"
            >
              <span class="grow">{{
                $t("pages.system_alerts.can_close")
              }}</span>
              <Switch v-model="form.dismissible" />
            </label>
          </section>

          <section
            ref="scheduleRef"
            class="grid gap-3 border-t border-border/60 py-5"
          >
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("pages.system_alerts.sections.schedule") }}
            </div>
            <span :class="fieldLabel">{{
              $t("pages.system_alerts.ends")
            }}</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="chip in chips"
                :key="chip.label"
                type="button"
                class="h-7 rounded-md border px-2.5 text-xs font-semibold transition-colors duration-150"
                :class="
                  chipMatches(chip.value, form.exp, now)
                    ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                    : 'border-border text-muted-foreground hover:text-foreground'
                "
                :aria-pressed="chipMatches(chip.value, form.exp, now)"
                @click="pickChip(chip.value)"
              >
                {{ chip.label }}
              </button>
            </div>
            <DateTimePicker
              :key="pickerKey"
              :model-value="form.exp ? new Date(form.exp).toISOString() : ''"
              size="sm"
              @update:model-value="(v: string) => (form.exp = toMs(v))"
            />
            <p class="text-xs tabular-nums text-muted-foreground">
              {{ scheduleLine }}
            </p>
          </section>

          <div
            v-if="editingAlert"
            class="flex items-center justify-between gap-4 border-t border-border/60 pt-5"
          >
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.system_alerts.delete_hint") }}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="deleteOpen = true"
            >
              <Trash2 class="size-3.5" />
              {{ $t("pages.system_alerts.delete") }}
            </Button>
          </div>
        </form>

        <SettingsSaveBar
          contained
          :dirty="dirty"
          :submitting="saving"
          :force-visible="isNew"
          :valid="valid"
          :hide-discard="isNew"
          :action-label="
            isNew ? $t('pages.system_alerts.create') : $t('common.save_changes')
          "
          @save="save"
          @discard="discard"
        />
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("system_alerts.delete_confirm_title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("system_alerts.delete_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="gap-2">
        <AlertDialogCancel :disabled="deleting">{{
          $t("system_alerts.cancel")
        }}</AlertDialogCancel>
        <Button
          variant="destructive"
          :loading="deleting"
          @click="confirmDelete"
        >
          {{ $t("pages.system_alerts.delete") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
