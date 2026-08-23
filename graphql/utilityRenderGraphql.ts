import { $ } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { utilityAuthorFields } from "~/graphql/utilityGraphql";

// Not in zeus until the next codegen — consumers cast operation maps as any,
// the same arrangement clipRenderJob.ts runs on.
export const utilityRenderFields = {
  id: true,
  utility_lineup_id: true,
  map_name: true,
  status: true,
  progress: true,
  error_message: true,
  skip_reason: true,
  duration_ms: true,
  k8s_job_name: true,
  game_server_node_id: true,
  paused: true,
  sort_index: true,
  status_history: true,
  last_status_at: true,
  created_at: true,
  requested_by: utilityAuthorFields,
  lineup: {
    id: true,
    name: true,
    map_name: true,
    utility_type: true,
    side: true,
    confidence: true,
    preview_url: true,
    preview_thumbnail_url: true,
    preview_rendered_at: true,
  },
} as const;

export const RENDER_IN_FLIGHT_STATUSES = [
  "queued",
  "rendering",
  "uploading",
] as const;

export const RENDER_TERMINAL_STATUSES = [
  "done",
  "error",
  "skipped",
  "cancelled",
] as const;

export const utilityRendersInFlightSubscription = generateSubscription({
  utility_lineup_renders: [
    {
      where: { status: { _in: $("statuses", "[String!]") } },
      order_by: [
        { map_name: $("mapOrder", "order_by") },
        { sort_index: $("sortOrder", "order_by") },
        { created_at: $("createdOrder", "order_by") },
      ],
    },
    utilityRenderFields,
  ],
} as any);

export const utilityRendersFinishedSubscription = generateSubscription({
  utility_lineup_renders: [
    {
      where: { status: { _in: $("statuses", "[String!]") } },
      order_by: [{ last_status_at: $("order", "order_by") }],
      limit: $("limit", "Int"),
    },
    utilityRenderFields,
  ],
} as any);

// The reviewer's re-run. Distinct from the approval path because the lineup
// usually already has a preview -- that is the reason to run it again.
export const renderUtilityLineupPreviewMutation = generateMutation({
  renderUtilityLineupPreview: [
    { utility_lineup_id: $("utility_lineup_id", "uuid!") },
    {
      success: true,
      render_id: true,
      status: true,
      reason: true,
    },
  ],
} as any);

export const cancelUtilityLineupRenderMutation = generateMutation({
  cancelUtilityLineupRender: [
    { render_id: $("render_id", "uuid!") },
    { success: true },
  ],
} as any);

export const deleteUtilityLineupRenderMutation = generateMutation({
  deleteUtilityLineupRender: [
    { render_id: $("render_id", "uuid!") },
    { success: true },
  ],
} as any);

export const clearFinishedUtilityLineupRendersMutation = generateMutation({
  clearFinishedUtilityLineupRenders: [{}, { cleared: true }],
} as any);
