import type { UtilityLineupRender } from "~/types/utility";

type QueueRender = Pick<
  UtilityLineupRender,
  "id" | "utility_lineup_id" | "status"
> & {
  lineup?: { preview_url?: string | null } | null;
};

const IN_FLIGHT = new Set(["queued", "rendering", "uploading"]);

function previewPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

/**
 * The renders whose clip is a lineup's preview right now -- the rows whose
 * delete takes the preview down with them. The api files a preview under the
 * render that made it; one filed under the lineup alone predates that and
 * belongs to the lineup's only done render, or to none when there are two.
 */
export function liveUtilityRenderIds(renders: QueueRender[]): Set<string> {
  const live = new Set<string>();
  const doneByLineup = new Map<string, QueueRender[]>();

  for (const render of renders) {
    if (render.status !== "done") {
      continue;
    }
    const list = doneByLineup.get(render.utility_lineup_id) ?? [];
    list.push(render);
    doneByLineup.set(render.utility_lineup_id, list);
  }

  for (const [lineupId, done] of doneByLineup) {
    for (const render of done) {
      const url = render.lineup?.preview_url;
      if (!url) {
        continue;
      }
      const path = previewPath(url);
      if (path.endsWith(`/${lineupId}/${render.id}.mp4`)) {
        live.add(render.id);
      } else if (
        path.endsWith(`/clips/utility/${lineupId}.mp4`) &&
        done.length === 1
      ) {
        live.add(render.id);
      }
    }
  }

  return live;
}

// The api turns down a second render for a lineup while one is under way.
export function utilityLineupsRendering(renders: QueueRender[]): Set<string> {
  return new Set(
    renders
      .filter((render) => IN_FLIGHT.has(render.status))
      .map((render) => render.utility_lineup_id),
  );
}
