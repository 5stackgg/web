<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const lines = computed(() => [
  t("feature_spotlights.auto_highlights.cover_top"),
  t("feature_spotlights.auto_highlights.cover_bottom"),
]);

// The headline shares the cover with the clip player, and a translation can
// run well past "Highlights". Sized off the widest line so it never reaches
// the player: a full-width CJK glyph is about 1em, anything else about 0.62em.
const headlineSize = computed(() => {
  const widest = Math.max(
    ...lines.value.map((line) =>
      [...line].reduce(
        (width, glyph) => width + (glyph > "⹿" ? 1 : 0.62),
        0,
      ),
    ),
  );
  return `${Math.min(7.6, 48 / widest).toFixed(2)}cqw`;
});
</script>

<template>
  <div
    class="cover aspect-video w-full"
    aria-hidden="true"
    :style="{ '--headline-size': headlineSize }"
  >
    <svg
      class="topo"
      viewBox="0 0 1280 720"
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M-40,120 C 240,60 520,200 760,150 C 1000,100 1180,210 1360,150"
      />
      <path
        d="M-40,230 C 240,170 520,320 760,260 C 1000,200 1180,330 1360,270"
      />
      <path
        d="M-40,360 C 260,300 520,470 800,400 C 1040,340 1200,470 1360,410"
      />
      <path
        d="M-40,500 C 260,440 540,620 820,540 C 1060,470 1220,610 1360,560"
      />
      <path
        d="M-40,640 C 280,580 560,760 860,680 C 1080,620 1240,740 1360,700"
      />
    </svg>
    <div class="grain" />
    <div class="frame" />
    <i class="corner corner--tl" />
    <i class="corner corner--tr" />
    <i class="corner corner--bl" />
    <i class="corner corner--br" />

    <div class="copy">
      <div class="headline">
        {{ lines[0] }}<br /><b>{{ lines[1] }}</b>
      </div>
      <div class="rule" />
    </div>

    <div class="motif">
      <div class="clip">
        <div class="screen">
          <div class="pull">
            <span class="bar bar--a" />
            <span class="bar bar--b" />
            <span class="score">13:9</span>
          </div>
          <div class="play" />
          <div class="tag">
            <span style="--i: 0">2K</span>
            <span style="--i: 1">3K</span>
            <span style="--i: 2">4K</span>
            <span style="--i: 3">ACE</span>
          </div>
          <div class="progress" />
        </div>
      </div>
      <div class="queue">
        <span class="thumb" style="--i: 0" />
        <span class="thumb" style="--i: 1" />
        <span class="thumb" style="--i: 2" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The news banner chrome, drawn live so it follows the operator's accent.
   Every size inside is in cqw, so the art scales with whatever holds it. */
.cover {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  container-type: inline-size;
  color: hsl(var(--foreground));
  background:
    radial-gradient(
      120% 90% at 12% 115%,
      hsl(var(--tac-amber) / 0.2),
      hsl(var(--tac-amber) / 0) 55%
    ),
    radial-gradient(
      90% 80% at 95% -10%,
      hsl(var(--tac-amber) / 0.1),
      hsl(var(--tac-amber) / 0) 50%
    ),
    linear-gradient(
      135deg,
      color-mix(in hsl, hsl(var(--background)), white 4%) 0%,
      hsl(var(--background)) 60%
    );
}
.topo {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  fill: none;
  stroke: hsl(var(--tac-amber) / 0.1);
  stroke-width: 1.4;
  opacity: 0.6;
}
.grain {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image: radial-gradient(
    hsl(var(--foreground) / 0.7) 0.5px,
    transparent 0.5px
  );
  background-size: 4px 4px;
}
.frame {
  position: absolute;
  inset: 2.6cqw;
  border: 1px solid hsl(var(--tac-amber) / 0.18);
}
.corner {
  position: absolute;
  width: max(6px, 1.4cqw);
  height: max(6px, 1.4cqw);
  border: max(1.5px, 0.16cqw) solid hsl(var(--tac-amber));
}
.corner--tl {
  top: 2cqw;
  left: 2cqw;
  border-right: 0;
  border-bottom: 0;
}
.corner--tr {
  top: 2cqw;
  right: 2cqw;
  border-left: 0;
  border-bottom: 0;
}
.corner--bl {
  bottom: 2cqw;
  left: 2cqw;
  border-right: 0;
  border-top: 0;
}
.corner--br {
  right: 2cqw;
  bottom: 2cqw;
  border-left: 0;
  border-top: 0;
}

.copy {
  position: absolute;
  left: 7.5cqw;
  top: 50%;
  transform: translateY(-50%);
}
.headline {
  font-size: var(--headline-size);
  font-weight: 700;
  line-height: 0.92;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0.5cqw 3cqw rgb(0 0 0 / 0.5);
}
.headline b {
  font-weight: inherit;
  color: hsl(var(--tac-amber));
  background: linear-gradient(
    180deg,
    var(--tac-amber-cta-from),
    hsl(var(--tac-amber))
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: none;
}
.rule {
  margin-top: 2cqw;
  width: 19cqw;
  height: max(2px, 0.24cqw);
  background: linear-gradient(
    90deg,
    hsl(var(--tac-amber)),
    hsl(var(--tac-amber) / 0)
  );
}

.motif {
  position: absolute;
  top: 50%;
  right: 7.5cqw;
  display: flex;
  width: 33cqw;
  flex-direction: column;
  gap: 1.3cqw;
  transform: translateY(-50%);
}
.queue {
  display: flex;
  gap: 1cqw;
}
.thumb {
  position: relative;
  flex: 1;
  aspect-ratio: 103 / 60;
  overflow: hidden;
  border: 1px solid hsl(var(--foreground) / 0.08);
  border-radius: max(2px, 0.6cqw);
  background: linear-gradient(
    160deg,
    hsl(var(--muted) / 0.7),
    hsl(var(--background))
  );
  animation: thumb-on 6s steps(1) infinite;
  animation-delay: calc(var(--i) * 2s - 6s);
}
.thumb::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -35% -50%;
  border-top: 0.6cqw solid transparent;
  border-bottom: 0.6cqw solid transparent;
  border-left: 0.9cqw solid hsl(var(--foreground) / 0.55);
}

/* The player is its own container: its insides scale off its width, not the
   cover's, so it can be lifted out and used on its own. */
.clip {
  width: 100%;
  container-type: inline-size;
}
.screen {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid hsl(var(--tac-amber) / 0.4);
  border-radius: max(3px, 2.7cqw);
  background:
    radial-gradient(
      120% 120% at 70% 20%,
      hsl(var(--tac-amber) / 0.22),
      hsl(var(--background) / 0.2) 55%
    ),
    linear-gradient(160deg, hsl(var(--muted) / 0.7), hsl(var(--background)));
  box-shadow:
    0 3cqw 15cqw rgb(0 0 0 / 0.5),
    0 0 12cqw hsl(var(--tac-amber) / 0.1);
}
.pull {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  height: 10.5cqw;
  align-items: center;
  gap: 2.4cqw;
  padding: 0 3.6cqw;
  background: linear-gradient(
    180deg,
    hsl(var(--background) / 0.85),
    hsl(var(--background) / 0)
  );
}
.bar {
  height: 1.8cqw;
  border-radius: 1cqw;
  background: hsl(var(--foreground) / 0.18);
}
.bar--a {
  width: 14cqw;
  background: hsl(var(--tac-amber) / 0.65);
}
.bar--b {
  width: 9cqw;
}
.score,
.tag {
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  font-weight: 700;
  color: var(--tac-amber-cta-from);
}
.score {
  margin-left: auto;
  font-size: 4cqw;
  line-height: 1;
  letter-spacing: 0.1em;
}
.play {
  position: absolute;
  top: 54%;
  left: 50%;
  display: grid;
  width: 19.5cqw;
  height: 19.5cqw;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(
    180deg,
    var(--tac-amber-cta-from),
    hsl(var(--tac-amber))
  );
  box-shadow: 0 0 11cqw hsl(var(--tac-amber) / 0.5);
  translate: -50% -50%;
}
.play::after {
  content: "";
  margin-left: 1.5cqw;
  border-top: 4cqw solid transparent;
  border-bottom: 4cqw solid transparent;
  border-left: 6cqw solid hsl(var(--tac-amber-foreground));
}
.tag {
  position: absolute;
  right: 3.6cqw;
  bottom: 7.5cqw;
  width: 16cqw;
  height: 7cqw;
  font-size: 5.6cqw;
  line-height: 7cqw;
  letter-spacing: 0.08em;
}
.tag span {
  position: absolute;
  inset: 0;
  text-align: right;
  opacity: 0;
  animation: tag-cycle 6s steps(1) infinite;
  animation-delay: calc(var(--i) * 1.5s - 6s);
}
.progress {
  position: absolute;
  right: 3.6cqw;
  bottom: 3.6cqw;
  left: 3.6cqw;
  height: 1.5cqw;
  overflow: hidden;
  border-radius: 1cqw;
  background: hsl(var(--foreground) / 0.16);
}
.progress::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    hsl(var(--tac-amber)),
    var(--tac-amber-cta-from)
  );
  transform-origin: left;
  animation: clip-progress 6s linear infinite;
}

/* One 6s loop: the bar fills once, the kill count steps 2K to ACE across it,
   and each queued clip takes a third of it lit. Negative delays start every
   element mid-loop in its own slot, so nothing waits blank for its turn. */
@keyframes clip-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes tag-cycle {
  0% {
    opacity: 1;
  }
  25%,
  100% {
    opacity: 0;
  }
}
@keyframes thumb-on {
  0% {
    border-color: hsl(var(--tac-amber) / 0.6);
    box-shadow: 0 0 1.8cqw hsl(var(--tac-amber) / 0.22);
  }
  33.34%,
  100% {
    border-color: hsl(var(--foreground) / 0.08);
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .thumb,
  .tag span,
  .progress::after {
    animation: none;
  }
  .progress::after {
    transform: scaleX(0.42);
  }
  .tag span:nth-child(3) {
    opacity: 1;
  }
  .thumb:first-child {
    border-color: hsl(var(--tac-amber) / 0.6);
    box-shadow: 0 0 1.8cqw hsl(var(--tac-amber) / 0.22);
  }
}
</style>
