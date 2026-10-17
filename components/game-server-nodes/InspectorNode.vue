<script setup lang="ts">
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import NodeControlList from "~/components/game-server-nodes/NodeControlList.vue";
import { setNodeFields } from "~/components/game-server-nodes/nodeActions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// Node: on/off and taking matches (`part="controls"`), or the demo upload
// limit that sits under Live's network figure (`part="network"`). Its id,
// addresses and files live in the panel header.
const props = withDefaults(
  defineProps<{ node: Record<string, any>; part?: "controls" | "network" }>(),
  { part: "controls" },
);

const { t } = useI18n();
const { client } = useApolloClient();

const UNLIMITED = "unlimited";
const LIMITS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

async function setLimit(value: string) {
  const limit = value === UNLIMITED ? null : parseInt(value);
  try {
    await setNodeFields(client, props.node.id, { demo_network_limiter: limit });
    toast({ title: t("demo_network_limiter.updated") });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.game_server_nodes.toast.save_failed"),
      description: error?.message,
    });
  }
}
</script>

<template>
  <section v-if="part === 'network'" class="px-4 pb-3">
    <div class="gsn-kv">
      <span class="gsn-k">
        <FiveStackToolTip as-child :delay-duration="120" align="start">
          <template #trigger>
            <span
              class="cursor-help underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px]"
              tabindex="0"
              >{{ t(`${INSPECTOR}.node.limiter`) }}</span
            >
          </template>
          <span class="block max-w-[16rem]">{{
            t(`${INSPECTOR}.node.limiter_tip`)
          }}</span>
        </FiveStackToolTip>
      </span>
      <div class="gsn-v">
        <Select
          :model-value="
            node.demo_network_limiter == null
              ? UNLIMITED
              : String(node.demo_network_limiter)
          "
          @update:model-value="(value) => setLimit(String(value))"
        >
          <SelectTrigger
            class="h-7 w-auto min-w-[8rem] text-[12.5px]"
            :aria-label="t('demo_network_limiter.title')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="UNLIMITED">
                {{ t("demo_network_limiter.unlimited") }}
              </SelectItem>
              <SelectItem
                v-for="limit of LIMITS"
                :key="limit"
                :value="String(limit)"
                >{{ limit }} Mbps</SelectItem
              >
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  </section>
  <section v-else class="grid gap-2.5 p-4">
    <h3 class="text-[13px] font-semibold">
      {{ t("pages.game_server_nodes.table.node") }}
    </h3>

    <NodeControlList :node="node as any" />
  </section>
</template>

<style scoped>
.gsn-kv {
  display: grid;
  grid-template-columns: minmax(92px, 32%) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  font-size: 13px;
}
.gsn-k {
  color: hsl(var(--muted-foreground));
}
.gsn-v {
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
