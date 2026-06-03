import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export const matchMovementMapQuery = typedGql("query")({
  match_maps_by_pk: [
    { id: $("matchMapId", "uuid!") },
    {
      id: true,
      map: { name: true },
      demos: [{ limit: 1 }, { playback_url: true }],
    },
  ],
});
