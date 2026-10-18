<script setup lang="ts">
import { Copy, Ellipsis, SquareTerminal } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { copyText } from "./dbCopy";
import { cancelSql, terminateSql } from "./dbHealth";

// The page never cancels or kills a backend itself: it hands over the
// statement to run, so the decision stays with whoever runs it.
const props = defineProps<{ pid: number; query?: string | null }>();
const { t } = useI18n();

const failed = () => t("pages.database.copy_failed");

function copyQuery() {
  void copyText(props.query || "", t("pages.database.query_copied"), failed());
}
function copyCancel() {
  void copyText(
    cancelSql(props.pid),
    t("pages.database.explorer.statement_copied"),
    failed(),
  );
}
function copyTerminate() {
  void copyText(
    terminateSql(props.pid),
    t("pages.database.explorer.statement_copied"),
    failed(),
    t("pages.database.explorer.terminate_warning"),
  );
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="$t('pages.database.explorer.pid_actions', { pid })"
        @click.stop
      >
        <Ellipsis class="h-3.5 w-3.5" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[280px]">
      <DropdownMenuItem v-if="query" @select="copyQuery">
        <Copy />
        {{ $t("pages.database.explorer.copy_query") }}
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="query" />
      <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
        {{ $t("pages.database.explorer.statements_to_run") }}
      </DropdownMenuLabel>
      <DropdownMenuItem class="font-mono text-xs" @select="copyCancel">
        <SquareTerminal />
        {{
          $t("pages.database.explorer.copy_statement", {
            sql: `pg_cancel_backend(${pid})`,
          })
        }}
      </DropdownMenuItem>
      <DropdownMenuItem
        class="font-mono text-xs text-destructive focus:text-destructive"
        @select="copyTerminate"
      >
        <SquareTerminal />
        {{
          $t("pages.database.explorer.copy_statement", {
            sql: `pg_terminate_backend(${pid})`,
          })
        }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
