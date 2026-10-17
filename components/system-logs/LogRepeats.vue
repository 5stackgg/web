<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, CircleX, TriangleAlert, X } from "lucide-vue-next";
import { Fold } from "~/components/ui/transitions";
import { clockTime, type LogGroup } from "./logLines";

// Repeating warnings and errors behind one line. It never opens by itself.
const props = defineProps<{
  groups: LogGroup[];
  active: string | null;
}>();
const emit = defineEmits<{ (e: "show", sig: string | null): void }>();

const open = ref(false);
const hasErrors = computed(() => props.groups.some((g) => g.level === "ERROR"));

const chip = computed(() => {
  if (!props.active) return null;
  const [level, ctx, ...rest] = props.active.split("|");
  const msg = rest.join("|");
  return {
    errors: level === "ERROR",
    text: `${ctx ? `[${ctx}] ` : ""}${msg.slice(0, 56)}`,
  };
});
</script>

<template>
  <div class="grid">
    <div class="flex min-h-7 flex-wrap items-center gap-2.5">
      <button
        v-if="groups.length"
        type="button"
        class="inline-flex h-7 items-center gap-1.5 rounded-md pl-1 pr-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-expanded="open"
        @click="open = !open"
      >
        <ChevronRight
          class="lg-rep-chev h-3 w-3"
          :class="open && 'rotate-90'"
        />
        <i18n-t
          keypath="pages.system_logs.repeating"
          :plural="groups.length"
          tag="span"
        >
          <template #count
            ><b
              class="font-bold tabular-nums"
              :class="hasErrors ? 'text-destructive' : 'text-amber-400'"
              >{{ groups.length }}</b
            ></template
          >
        </i18n-t>
      </button>
      <span v-else class="pl-1 text-[13px] text-muted-foreground/60">{{
        $t("pages.system_logs.no_repeating")
      }}</span>
      <span
        v-if="chip"
        class="ml-auto inline-flex h-6 max-w-full items-center gap-1.5 rounded-[5px] bg-[hsl(var(--tac-amber)/0.12)] pl-2 pr-1 text-xs text-[hsl(var(--tac-amber))]"
      >
        <span class="max-w-[340px] truncate">{{
          chip.errors
            ? $t("pages.system_logs.errors_like", { text: chip.text })
            : $t("pages.system_logs.warnings_like", { text: chip.text })
        }}</span>
        <button
          type="button"
          class="grid h-[18px] w-[18px] place-items-center rounded transition-colors hover:bg-[hsl(var(--tac-amber)/0.25)]"
          :aria-label="$t('pages.system_logs.show_every_line')"
          @click="emit('show', null)"
        >
          <X class="h-3 w-3" />
        </button>
      </span>
    </div>
    <Fold :open="open && groups.length > 0">
      <div
        class="lg-groups mt-1.5 max-h-[300px] overflow-y-auto rounded-[10px] border border-border bg-[hsl(240_6%_5.5%)]"
      >
        <TransitionGroup
          enter-active-class="lg-g-enter"
          enter-from-class="lg-g-from"
          leave-active-class="lg-g-leave"
          leave-to-class="opacity-0"
        >
          <div
            v-for="g in groups"
            :key="g.sig"
            class="lg-g"
            :class="active === g.sig && 'is-on'"
          >
            <span
              class="inline-flex h-5 items-center gap-1 rounded-[5px] border px-1.5 text-[11px] font-semibold"
              :class="
                g.level === 'ERROR'
                  ? 'border-destructive/30 bg-destructive/15 text-destructive'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-400'
              "
            >
              <CircleX v-if="g.level === 'ERROR'" class="h-3 w-3" />
              <TriangleAlert v-else class="h-3 w-3" />
              {{
                g.level === "ERROR"
                  ? $t("pages.system_logs.level_error")
                  : $t("pages.system_logs.level_warning")
              }}
            </span>
            <span
              class="min-w-0 truncate font-mono text-[11.5px] text-foreground/85"
              :title="g.last.msg.slice(0, 400)"
              ><span v-if="g.ctx" class="font-semibold text-muted-foreground"
                >[{{ g.ctx }}] </span
              >{{ g.last.msg }}</span
            >
            <span class="tabular-nums text-muted-foreground"
              ><b class="text-foreground">{{ g.count.toLocaleString() }}</b
              >×</span
            >
            <span class="lg-g-svc inline-flex gap-1">
              <span
                v-for="s in g.services"
                :key="s"
                class="inline-flex h-[18px] items-center rounded bg-[hsl(240_4%_12%)] px-1.5 text-[10.5px] text-muted-foreground"
                >{{ s }}</span
              >
            </span>
            <span class="lg-g-t tabular-nums text-muted-foreground/70">{{
              clockTime(g.last.t, false)
            }}</span>
            <button
              type="button"
              class="inline-flex h-7 items-center whitespace-nowrap rounded-md border border-border bg-muted/30 px-2 text-xs transition-colors hover:bg-muted"
              @click="emit('show', active === g.sig ? null : g.sig)"
            >
              {{
                active === g.sig
                  ? $t("pages.system_logs.showing")
                  : $t("pages.system_logs.show_in_stream")
              }}
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Fold>
  </div>
</template>

<style scoped>
.lg-groups {
  scrollbar-width: thin;
}
.lg-g {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  font-size: 12.5px;
  transition: background-color 150ms ease;
}
.lg-g:last-child {
  border-bottom: 0;
}
.lg-g.is-on {
  background: hsl(var(--tac-amber) / 0.12);
}
.lg-rep-chev {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.lg-g-enter {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.lg-g-from {
  opacity: 0;
  transform: translateY(4px);
}
.lg-g-leave {
  transition: opacity 110ms ease-in;
}
@media (max-width: 1100px) {
  .lg-g {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }
  .lg-g-svc,
  .lg-g-t {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg-rep-chev,
  .lg-g-enter,
  .lg-g-leave {
    transition: none;
  }
}
</style>
