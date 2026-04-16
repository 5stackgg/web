<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

defineProps<{ compact?: boolean }>();
</script>

<template>
  <NuxtLink
    :to="{ name: 'matches-create' }"
    :class="['custom-match', compact ? 'custom-match--compact' : 'custom-match--full']"
  >
    <span class="custom-match__corner custom-match__corner--tl" aria-hidden="true"></span>
    <span class="custom-match__corner custom-match__corner--br" aria-hidden="true"></span>
    <span class="custom-match__scan" aria-hidden="true"></span>

    <div class="custom-match__content">
      <div class="custom-match__label">
        <span class="custom-match__tick" aria-hidden="true"></span>
        CUSTOM.MATCH
      </div>
      <p class="custom-match__description">
        {{ $t("custom_match.description") }}
      </p>
    </div>

    <div v-if="!compact" class="custom-match__cta" aria-hidden="true">
      <span class="custom-match__cta-text">{{ $t("common.create") }}</span>
      <ArrowRight class="size-4" />
    </div>
  </NuxtLink>
</template>

<script lang="ts">
export default {
  computed: {
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>

<style scoped>
.custom-match {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  border: 1px solid hsl(var(--border));
  background: linear-gradient(
    135deg,
    hsl(var(--card) / 0.7) 0%,
    hsl(var(--card) / 0.35) 60%,
    hsl(var(--tac-amber) / 0.05) 100%
  );
  color: hsl(var(--foreground));
  overflow: hidden;
  isolation: isolate;
  transition: border-color 180ms ease, background 220ms ease,
    transform 180ms ease, box-shadow 220ms ease;
  cursor: pointer;
}
.custom-match:hover {
  border-color: hsl(var(--tac-amber) / 0.55);
  background: linear-gradient(
    135deg,
    hsl(var(--card) / 0.8) 0%,
    hsl(var(--card) / 0.45) 55%,
    hsl(var(--tac-amber) / 0.12) 100%
  );
  box-shadow: 0 0 24px hsl(var(--tac-amber) / 0.12);
}
.custom-match:focus-visible {
  outline: none;
  border-color: hsl(var(--tac-amber));
  box-shadow: 0 0 0 2px hsl(var(--tac-amber) / 0.35);
}

.custom-match--full {
  padding: 1.5rem 1.75rem;
  gap: 1.25rem;
  align-items: center;
  clip-path: polygon(
    0 0,
    calc(100% - 18px) 0,
    100% 18px,
    100% 100%,
    18px 100%,
    0 calc(100% - 18px)
  );
}
.custom-match--compact {
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem 1.25rem;
  min-height: 120px;
}

.custom-match__corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 0 solid hsl(var(--tac-amber));
  pointer-events: none;
  z-index: 2;
  transition: border-color 180ms ease;
}
.custom-match__corner--tl {
  top: 8px;
  left: 8px;
  border-top-width: 2px;
  border-left-width: 2px;
}
.custom-match__corner--br {
  bottom: 8px;
  right: 8px;
  border-bottom-width: 2px;
  border-right-width: 2px;
}

.custom-match__scan {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 3px,
    hsl(var(--tac-amber) / 0.03) 3px,
    hsl(var(--tac-amber) / 0.03) 4px
  );
  opacity: 0;
  transition: opacity 220ms ease;
}
.custom-match:hover .custom-match__scan {
  opacity: 1;
}

.custom-match__content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.custom-match__label {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-family: "Oxanium", monospace;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: hsl(var(--foreground));
  transition: color 180ms ease;
}
.custom-match--full .custom-match__label {
  font-size: 1rem;
  letter-spacing: 0.22em;
}
.custom-match--compact .custom-match__label {
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
}
.custom-match:hover .custom-match__label {
  color: hsl(var(--tac-amber));
}
.custom-match__tick {
  display: inline-block;
  width: 10px;
  height: 2px;
  background: hsl(var(--tac-amber));
}

.custom-match__description {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}
.custom-match--compact .custom-match__description {
  font-size: 0.78rem;
}

.custom-match__cta {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0.65rem 1rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.6);
  font-family: "Oxanium", monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  transition: color 180ms ease, border-color 180ms ease,
    background 180ms ease, transform 180ms ease;
}
.custom-match__cta-text {
  line-height: 1;
}
.custom-match:hover .custom-match__cta {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
  background: hsl(var(--tac-amber) / 0.1);
}
.custom-match:hover .custom-match__cta svg {
  transform: translateX(2px);
}
.custom-match__cta svg {
  transition: transform 180ms ease;
}

@media (max-width: 640px) {
  .custom-match--full {
    flex-direction: column;
    align-items: flex-start;
    padding: 1.25rem;
  }
  .custom-match--full .custom-match__cta {
    width: 100%;
    justify-content: center;
  }
}
</style>
