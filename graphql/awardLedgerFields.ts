import { Selector } from "~/generated/zeus";
import { awardScopedDefinitionFields } from "~/graphql/awardFields";

// The awards ledger: each award with its owner's phase (so a row can say
// "Live now" or "Finished") and when it was last granted.
export const awardLedgerFields = Selector("awards")({
  ...awardScopedDefinitionFields,
  tournament: {
    id: true,
    name: true,
    status: true,
    start: true,
  },
  event: {
    id: true,
    name: true,
    starts_at: true,
    ends_at: true,
  },
  season: {
    id: true,
    number: true,
    starts_at: true,
    ends_at: true,
  },
  league_season: {
    id: true,
    name: true,
    season_number: true,
    status: true,
    starts_at: true,
  },
  recipients_aggregate: [
    {},
    { aggregate: { count: true, max: { created_at: true } } },
  ],
});
