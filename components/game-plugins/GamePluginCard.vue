<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  ShieldCheck,
  Puzzle,
  LayoutDashboard,
  Package,
  Check,
  Wrench,
} from "lucide-vue-next";
import { pluginAuthorUrl } from "~/utilities/pluginAuthor";

const props = defineProps<{
  plugin: Record<string, any>;
  installed?: boolean;
  state?: string | null;
  installedNodes?: number;
  totalNodes?: number;
}>();

// Partial coverage is the state worth calling out: a mode using this plugin
// will work or not depending on which node the match lands on.
const partial = computed(
  () => props.state === "Partial" || props.state === "Pending",
);

const coverage = computed(() =>
  partial.value && props.totalNodes
    ? `${props.installedNodes ?? 0}/${props.totalNodes}`
    : null,
);

const kindIcon = computed(() => {
  if (props.plugin.kind === "panel") {
    return LayoutDashboard;
  }

  if (props.plugin.kind === "bundle") {
    return Package;
  }

  return Puzzle;
});

const runtimes = computed(() => [
  ...new Set(
    (props.plugin.versions ?? []).map(
      (version: { runtime: string }) => version.runtime,
    ),
  ),
]);

const authorUrl = computed(() => pluginAuthorUrl(props.plugin));

const runtimeLabel = (runtime: string) =>
  runtime === "swiftlys2" ? "SwiftlyS2" : "CounterStrikeSharp";
</script>

<template>
  <NuxtLink :to="`/plugins/${plugin.slug}`">
    <Card class="h-full transition-colors hover:bg-accent/40">
      <CardHeader class="space-y-2 pb-3">
        <div class="space-y-2">
          <div class="flex items-start gap-2">
            <component
              :is="kindIcon"
              class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            />
            <!-- Wraps rather than truncates: the badges used to squeeze the name
                 down to "5Stack Inv...", which is the one thing on the card that
                 has to be readable. -->
            <span class="font-semibold leading-snug">{{ plugin.name }}</span>
          </div>

          <div class="flex flex-wrap items-center gap-1">
            <Badge
              v-if="installed"
              :variant="partial ? 'outline' : 'secondary'"
              class="gap-1"
              :class="
                partial
                  ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
                  : ''
              "
            >
              <Check v-if="!partial" class="h-3 w-3" />
              {{ coverage ?? $t("pages.plugins.installed") }}
            </Badge>
            <Badge v-if="plugin.verified" variant="outline" class="gap-1">
              <ShieldCheck class="h-3 w-3" />
              {{ $t("pages.plugins.verified") }}
            </Badge>
            <!-- Nobody reviewed this one and no registry publishes it, which is
                 exactly what the operator needs to see before installing it on
                 every node. -->
            <Badge
              v-if="plugin.source === 'custom'"
              variant="outline"
              class="gap-1"
            >
              <Wrench class="h-3 w-3" />
              {{ $t("pages.plugins.custom.badge") }}
            </Badge>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          <!-- The card is wrapped in a NuxtLink to the detail page, so the
               author link stops the click rather than navigating both. -->
          <a
            v-if="authorUrl"
            :href="authorUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="underline-offset-2 hover:underline"
            @click.stop
          >
            {{ $t("pages.plugins.by", { author: plugin.author }) }}
          </a>
          <template v-else>
            {{ $t("pages.plugins.by", { author: plugin.author }) }}
          </template>
        </p>
      </CardHeader>

      <CardContent class="space-y-3">
        <p class="line-clamp-3 text-sm text-muted-foreground">
          {{ plugin.description }}
        </p>

        <div class="flex flex-wrap gap-1">
          <Badge
            v-for="runtime in runtimes"
            :key="runtime"
            variant="outline"
            class="text-[0.65rem]"
          >
            {{ runtimeLabel(runtime) }}
          </Badge>
          <Badge
            v-for="tag in plugin.tags ?? []"
            :key="tag"
            variant="outline"
            class="text-[0.65rem] text-muted-foreground"
          >
            {{ tag }}
          </Badge>
        </div>
      </CardContent>
    </Card>
  </NuxtLink>
</template>
