<script setup lang="ts">
import { computed } from "vue";
import { GithubLogoIcon } from "@radix-icons/vue";
import { useBranding } from "~/composables/useBranding";

const { brandName, logoUrl } = useBranding();

const displayName = computed(() => brandName.value || "5Stack");

const gridRef = computed(() => {
  const src = (displayName.value || "5S").toUpperCase();
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
  const lat = 10 + (h % 80);
  const lon = 10 + ((h >> 8) % 170);
  return `${lat.toString().padStart(2, "0")}.${((h >> 4) % 100).toString().padStart(2, "0")}N × ${lon
    .toString()
    .padStart(3, "0")}.${((h >> 12) % 100).toString().padStart(2, "0")}E`;
});

const metricClasses =
  "inline-flex items-center gap-[0.45rem] border border-border bg-card/45 px-[0.7rem] py-[0.4rem] font-sans text-[0.66rem] font-medium uppercase leading-none tracking-[0.22em] text-muted-foreground [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]";

const metricKeyClasses = "text-[hsl(var(--muted-foreground)/0.7)]";
const metricSepClasses = "text-[hsl(var(--tac-amber)/0.6)]";
const metricValueClasses =
  "text-[hsl(var(--foreground)/0.92)] [font-variant-numeric:tabular-nums]";
</script>

<template>
  <header
    class="sticky top-0 z-40 isolate border-b border-border bg-[linear-gradient(180deg,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.72)_100%)] [backdrop-filter:blur(10px)_saturate(120%)] [-webkit-backdrop-filter:blur(10px)_saturate(120%)]"
    role="banner"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--tac-amber)/0)_8%,hsl(var(--tac-amber)/0.45)_50%,hsl(var(--tac-amber)/0)_92%,transparent_100%)]"
    ></div>

    <div
      class="relative mx-auto flex max-w-[1600px] items-center justify-between gap-5 px-4 py-[0.7rem] sm:px-6 sm:py-[0.85rem]"
    >
      <NuxtLink
        to="/"
        :aria-label="displayName"
        class="inline-flex min-w-0 items-center gap-[0.9rem] text-inherit no-underline"
      >
        <span
          aria-hidden="true"
          class="relative inline-flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-card/65 [clip-path:polygon(0_0,calc(100%-8px)_0,100%_8px,100%_100%,8px_100%,0_calc(100%-8px))]"
        >
          <span
            class="absolute left-[3px] top-[3px] h-2 w-2 border-l-[1.5px] border-t-[1.5px] border-[hsl(var(--tac-amber))]"
          ></span>
          <span
            class="absolute bottom-[3px] right-[3px] h-2 w-2 border-b-[1.5px] border-r-[1.5px] border-[hsl(var(--tac-amber))]"
          ></span>
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="displayName"
            class="h-[26px] w-[26px] object-contain [filter:drop-shadow(0_0_4px_hsl(var(--tac-amber)/0.15))]"
          />
          <NuxtImg
            v-else
            src="/favicon/512.png"
            :alt="displayName"
            class="h-[26px] w-[26px] object-contain [filter:drop-shadow(0_0_4px_hsl(var(--tac-amber)/0.15))]"
          />
        </span>

        <span class="flex min-w-0 flex-col gap-[0.15rem]">
          <span
            class="inline-flex items-center gap-[0.45rem] font-sans text-[0.62rem] font-medium uppercase leading-none tracking-[0.28em] text-muted-foreground"
          >
            <span
              class="translate-y-[-0.5px] text-[0.55rem] text-[hsl(var(--tac-amber))]"
              >◢</span
            >
            TACTICAL.OPS
            <span
              class="hidden text-[hsl(var(--muted-foreground)/0.55)] sm:inline"
              >// SECURE CHANNEL</span
            >
          </span>
          <span
            class="relative inline-flex font-sans text-[1.15rem] font-bold uppercase leading-none tracking-[0.035em] sm:text-[1.35rem] [font-stretch:82%]"
          >
            <span
              aria-hidden="true"
              class="pointer-events-none absolute left-[3px] top-[3px] select-none text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.38)]"
            >
              {{ displayName }}
            </span>
            <span
              class="relative bg-[linear-gradient(180deg,hsl(var(--foreground))_0%,hsl(var(--foreground)/0.72)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
            >
              {{ displayName }}
            </span>
          </span>
        </span>
      </NuxtLink>

      <div class="inline-flex shrink-0 items-center gap-[0.9rem]">
        <div :class="[metricClasses, 'max-[900px]:hidden']" aria-hidden="true">
          <span :class="metricKeyClasses">GRID</span>
          <span :class="metricSepClasses">/</span>
          <span :class="metricValueClasses">{{ gridRef }}</span>
        </div>

        <div
          :class="[
            metricClasses,
            'px-[0.55rem] py-[0.35rem] text-[0.6rem] tracking-[0.18em] sm:px-[0.7rem] sm:py-[0.4rem] sm:text-[0.66rem] sm:tracking-[0.22em] min-[901px]:hidden',
          ]"
        >
          <span
            class="h-[7px] w-[7px] rotate-45 bg-[hsl(142_71%_55%)] shadow-[0_0_0_1px_hsl(142_71%_55%/0.35),0_0_6px_hsl(142_71%_55%/0.5)]"
          ></span>
          <span :class="[metricKeyClasses, 'hidden sm:inline']">STATUS</span>
          <span :class="[metricSepClasses, 'hidden sm:inline']">/</span>
          <span :class="[metricValueClasses, 'text-[hsl(142_71%_55%)]']"
            >ONLINE</span
          >
        </div>

        <a
          href="https://github.com/5stackgg/5stack-panel"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          class="inline-flex items-center gap-2 border border-border bg-transparent px-3 py-[0.45rem] font-sans text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--foreground)/0.78)] no-underline transition-[color,background-color,border-color] duration-150 [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)] hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-[hsl(var(--tac-amber)/0.1)] hover:text-foreground focus-visible:border-[hsl(var(--tac-amber)/0.55)] focus-visible:bg-[hsl(var(--tac-amber)/0.1)] focus-visible:text-foreground focus-visible:outline-none"
        >
          <GithubLogoIcon class="h-[14px] w-[14px]" />
          <span class="hidden sm:inline">SOURCE</span>
        </a>
      </div>
    </div>

    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 bottom-[2px]"
    >
      <div
        class="mx-auto flex max-w-[1600px] items-end justify-between px-4 sm:px-6"
      >
        <span
          v-for="i in 48"
          :key="i"
          class="h-[3px] w-px bg-[hsl(var(--foreground)/0.18)]"
          :class="{ 'h-1.5 bg-[hsl(var(--tac-amber)/0.5)]': i % 6 === 0 }"
        ></span>
      </div>
    </div>
  </header>
</template>
