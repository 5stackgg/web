import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

// The finished tournament's placements (api#588). Run with
// `context: { optional: true }`, so an api without the field only loses them.
export const tournamentPodiumQuery = typedGql("query")({
  tournaments_by_pk: [
    { id: $("tournamentId", "uuid!") },
    { id: true, podium: true } as any,
  ],
});
