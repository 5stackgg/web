<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
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
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  createButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  nodeName,
  type GpuPoolHealth,
} from "~/components/gpu-nodes/gpuSessions";
import { useGpuNodeActions } from "~/composables/useGpuNodeActions";

type Account = {
  id: string;
  username: string;
  claims?: Array<{
    purpose: string;
    node_id: string | null;
    created_at: string;
  }>;
};

const props = defineProps<{
  accounts: Account[];
  nodes: any[];
  health: GpuPoolHealth;
  /** The first list has arrived; rows added after it rise in. */
  loaded: boolean;
  /** Opened to add one: the username field takes focus. */
  focusAdd?: boolean;
}>();

// The pool's whole management, opened from its stat tile.
const open = defineModel<boolean>("open", { default: false });

const { t } = useI18n();
const { addSteamAccount, deleteSteamAccount } = useGpuNodeActions();

const username = ref("");
const password = ref("");
const canAdd = computed(() => !!username.value.trim() && !!password.value);

// Only focus the form when the sheet was opened to add an account, so a
// look at the pool doesn't raise the phone keyboard.
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  const target = props.focusAdd
    ? document.getElementById("gpu-steam-username")
    : (event.target as HTMLElement | null);
  target?.focus({ preventScroll: true });
}

async function add() {
  if (!canAdd.value) return;
  const done = await addSteamAccount(username.value.trim(), password.value);
  if (done) {
    username.value = "";
    password.value = "";
  }
}

// Holding accounts first: they are the ones doing something.
const rows = computed(() =>
  [...props.accounts]
    .map((account) => {
      const claim = account.claims?.[0] ?? null;
      const node = claim?.node_id
        ? props.nodes.find((n) => n.id === claim.node_id)
        : null;
      return {
        id: account.id,
        username: account.username,
        claim,
        nodeLabel: node ? nodeName(node) : (claim?.node_id ?? null),
      };
    })
    .sort((a, b) => Number(!!b.claim) - Number(!!a.claim)),
);

function purposeLabel(purpose: string) {
  const key = `pages.gpu_nodes.steam_pool.purpose.${purpose}`;
  const label = t(key);
  return label === key ? purpose : label;
}

const healthText = computed(() => {
  const h = props.health;
  const prefix = h.total
    ? `${t("pages.gpu_nodes.steam_pool.free_of", { free: h.free, total: h.total })} · `
    : "";
  switch (h.key) {
    case "no_nodes":
      return prefix + t("pages.gpu_nodes.steam_pool.health_no_nodes");
    case "empty":
      return t("pages.gpu_nodes.steam_pool.health_empty");
    case "short":
      return (
        prefix +
        t("pages.gpu_nodes.steam_pool.health_short", { count: h.short })
      );
    default:
      return prefix + t("pages.gpu_nodes.steam_pool.health_enough");
  }
});

const deleteTarget = ref<{ id: string; username: string } | null>(null);

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  await deleteSteamAccount(target.id);
  deleteTarget.value = null;
}

const warn = computed(
  () => props.health.key === "empty" || props.health.key === "short",
);

const labelClasses = [tacticalSectionLabelClasses, "mb-0"];

// New rows rise in once the first list has arrived; the first list itself
// just appears.
const ready = ref(false);
watch(
  () => props.loaded,
  (loaded) => loaded && nextTick(() => (ready.value = true)),
  { immediate: true },
);
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 overflow-y-auto overscroll-contain sm:max-w-[560px]"
      @open-auto-focus="onOpenAutoFocus"
    >
      <SheetHeader class="pr-8 text-left">
        <SheetTitle>{{ $t("pages.gpu_nodes.steam_pool.name") }}</SheetTitle>
        <SheetDescription>
          {{ $t("pages.gpu_nodes.steam_pool.description") }}
        </SheetDescription>
      </SheetHeader>

      <div class="mt-5 grid gap-6 pb-6">
        <section class="grid gap-3">
          <div :class="labelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.gpu_nodes.steam_pool.add_title") }}
          </div>
          <form
            id="gpu-steam-add"
            class="grid gap-2"
            autocomplete="off"
            @submit.prevent="add"
          >
            <div
              class="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <Input
                id="gpu-steam-username"
                v-model="username"
                class="h-8 font-mono max-md:text-base"
                :placeholder="$t('pages.gpu_nodes.steam_pool.username')"
                :aria-label="$t('pages.gpu_nodes.steam_pool.username')"
                autocomplete="off"
                spellcheck="false"
                data-1p-ignore="true"
                data-lpignore="true"
              />
              <Input
                v-model="password"
                type="password"
                class="h-8 max-md:text-base"
                :placeholder="$t('pages.gpu_nodes.steam_pool.password')"
                :aria-label="$t('pages.gpu_nodes.steam_pool.password')"
                autocomplete="new-password"
                data-1p-ignore="true"
                data-lpignore="true"
              />
              <Button
                type="submit"
                size="sm"
                :class="createButtonClasses"
                :disabled="!canAdd"
              >
                <Plus class="h-3.5 w-3.5" />
                {{ $t("pages.gpu_nodes.steam_pool.add_account") }}
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.gpu_nodes.steam_pool.add_description") }}
            </p>
          </form>
        </section>

        <section class="grid gap-3">
          <div
            class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
          >
            <div :class="labelClasses">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.gpu_nodes.steam_pool.accounts_label") }}
            </div>
            <span
              class="text-xs tabular-nums"
              :class="warn ? 'text-warning' : 'text-muted-foreground'"
            >
              {{ healthText }}
            </span>
          </div>

          <SectionEmpty
            v-if="accounts.length === 0"
            class="!min-h-[120px]"
            :title="$t('pages.gpu_nodes.steam_pool.empty_title')"
            :description="$t('pages.gpu_nodes.steam_pool.empty_body')"
          />
          <div
            v-else
            class="overflow-x-auto rounded-md border border-border bg-card/40"
          >
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border">
                  <th
                    class="h-9 px-3 text-left text-xs font-medium text-muted-foreground"
                  >
                    {{ $t("pages.gpu_nodes.steam_pool.col_account") }}
                  </th>
                  <th
                    class="h-9 px-3 text-left text-xs font-medium text-muted-foreground"
                  >
                    {{ $t("pages.gpu_nodes.steam_pool.col_holding") }}
                  </th>
                  <th
                    class="h-9 px-3 text-right text-xs font-medium text-muted-foreground"
                  >
                    {{ $t("pages.gpu_nodes.steam_pool.col_since") }}
                  </th>
                  <th class="h-9 w-12 px-3">
                    <span class="sr-only">{{
                      $t("common.actions_label")
                    }}</span>
                  </th>
                </tr>
              </thead>
              <TransitionGroup
                tag="tbody"
                :enter-active-class="
                  ready
                    ? 'transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]'
                    : ''
                "
                :enter-from-class="ready ? 'opacity-0 translate-y-1' : ''"
                leave-active-class="transition-opacity [transition-duration:110ms] ease-in"
                leave-to-class="opacity-0"
              >
                <tr
                  v-for="row in rows"
                  :key="row.id"
                  class="border-b border-border/60 last:border-0"
                >
                  <td class="px-3 py-2 font-mono text-[12.5px]">
                    {{ row.username }}
                  </td>
                  <td class="px-3 py-2">
                    <span
                      v-if="row.claim"
                      class="inline-flex flex-wrap items-center gap-x-1.5"
                    >
                      <span class="text-[hsl(var(--tac-amber))]">{{
                        purposeLabel(row.claim.purpose)
                      }}</span>
                      <span
                        v-if="row.nodeLabel"
                        class="text-xs text-muted-foreground"
                        >· {{ row.nodeLabel }}</span
                      >
                    </span>
                    <span v-else class="text-muted-foreground">{{
                      $t("pages.gpu_nodes.steam_pool.free")
                    }}</span>
                  </td>
                  <td
                    class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground"
                  >
                    <TimeAgo
                      v-if="row.claim?.created_at"
                      :date="row.claim.created_at"
                      hide-icon
                    />
                    <template v-else>—</template>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground hover:text-destructive"
                      :aria-label="
                        $t('pages.gpu_nodes.steam_pool.delete_title', {
                          username: row.username,
                        })
                      "
                      @click="
                        deleteTarget = { id: row.id, username: row.username }
                      "
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              </TransitionGroup>
            </table>
          </div>
        </section>
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="!!deleteTarget"
    @update:open="(open) => !open && (deleteTarget = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            $t("pages.gpu_nodes.steam_pool.delete_title", {
              username: deleteTarget?.username ?? "",
            })
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.gpu_nodes.steam_pool.delete_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="gap-2">
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <!-- Plain button: reka's AlertDialogAction closes (and clears the
             target) before the delete is sent. -->
        <Button variant="destructive" @click="confirmDelete">
          {{ $t("pages.gpu_nodes.steam_pool.delete_action") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
