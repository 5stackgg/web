import { Selector } from "~/generated/zeus";

export const simpleEventFields = Selector("events")({
  id: true,
  name: true,
  description: true,
  status: true,
  starts_at: true,
  ends_at: true,
  is_organizer: true,
  organizer: {
    steam_id: true,
    name: true,
    avatar_url: true,
  },
  tournaments_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
});
