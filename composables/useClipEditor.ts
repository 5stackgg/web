import { ref, computed } from "vue";
import { useNuxtApp } from "#app";
import { generateMutation } from "~/graphql/graphqlGen";
import type { ClipSpec } from "~/graphql/clipRenderJob";

// Working state for an in-flight clip edit. v1 is single-segment trim
// only — segments stays an array (and the helpers stay generic) so the
// timeline editor in phase 2 can reuse the same composable without a
// data-shape migration. See plan file for the phased rollout.
//
// `submit()` builds the full ClipSpec from current state and fires the
// `createClipRender` mutation; the returned job_id is what
// ClipRenderProgress subscribes to.
export function useClipEditor(matchMapId: string, opts?: { startTick?: number; durationTicks?: number }) {
  const { $apollo } = useNuxtApp();

  const segments = ref<
    Array<{ id: string; start_tick: number; end_tick: number }>
  >([]);
  const title = ref("");
  const destination = ref<"library" | "download">("library");
  const resolution = ref<"720p" | "1080p">("1080p");

  // Seed the first segment from the caller's current playback tick if
  // provided. ~30s default duration at 64-tick gives the user something
  // they can adjust both edges of immediately rather than starting at
  // a zero-length range.
  if (opts?.startTick != null) {
    addSegment(opts.startTick, opts.startTick + (opts.durationTicks ?? 64 * 30));
  }

  function addSegment(start: number, end: number) {
    segments.value.push({
      id: crypto.randomUUID(),
      start_tick: Math.max(0, Math.min(start, end)),
      end_tick: Math.max(start, end),
    });
  }
  function removeSegment(id: string) {
    segments.value = segments.value.filter((s) => s.id !== id);
  }
  function updateSegment(
    id: string,
    patch: Partial<{ start_tick: number; end_tick: number }>,
  ) {
    const s = segments.value.find((x) => x.id === id);
    if (!s) return;
    if (typeof patch.start_tick === "number") s.start_tick = patch.start_tick;
    if (typeof patch.end_tick === "number") s.end_tick = patch.end_tick;
    if (s.start_tick > s.end_tick) {
      const t = s.start_tick;
      s.start_tick = s.end_tick;
      s.end_tick = t;
    }
  }

  // Total duration ticks across all segments — used by the inspector
  // to show the resulting clip length without caring about tick rate.
  const totalTicks = computed(() =>
    segments.value.reduce(
      (acc, s) => acc + Math.max(0, s.end_tick - s.start_tick),
      0,
    ),
  );

  const isValid = computed(
    () => segments.value.length > 0 && totalTicks.value > 0,
  );

  function buildSpec(): ClipSpec {
    return {
      match_map_id: matchMapId,
      segments: segments.value.map((s) => ({
        start_tick: s.start_tick,
        end_tick: s.end_tick,
      })),
      output: {
        format: "mp4",
        resolution: resolution.value,
        fps: 60,
      },
      destination: destination.value,
      title: title.value || undefined,
    };
  }

  async function submit(): Promise<{ job_id: string }> {
    if (!isValid.value) throw new Error("clip is empty");
    const spec = buildSpec();
    const { data } = await $apollo.defaultClient.mutate({
      // Cast: createClipRender lives in the api once the clip-render
      // schema migration runs; until then zeus types don't know about
      // it. Same pattern the demo-playback composable uses for
      // watchDemo (composables/useDemoPlayback.ts).
      mutation: generateMutation({
        createClipRender: [
          { spec },
          { success: true, job_id: true },
        ],
      } as any),
    });
    const out = (data as any)?.createClipRender;
    if (!out?.success || !out?.job_id) {
      throw new Error("createClipRender returned no job");
    }
    return { job_id: out.job_id as string };
  }

  return {
    segments,
    title,
    destination,
    resolution,
    totalTicks,
    isValid,
    addSegment,
    removeSegment,
    updateSegment,
    buildSpec,
    submit,
  };
}
