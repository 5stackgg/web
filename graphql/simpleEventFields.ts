import { Selector } from "~/generated/zeus";

export const simpleEventFields = Selector("events")({
  id: true,
  name: true,
  description: true,
  starts_at: true,
  ends_at: true,
  visibility: true,
  media_access: true,
  hide_creator_organizer: true,
  banner_media_id: true,
  banner: {
    id: true,
    filename: true,
    mime_type: true,
  },
  is_organizer: true,
  can_upload_media: true,
  organizer_steam_id: true,
  organizer: {
    steam_id: true,
    name: true,
    avatar_url: true,
  },
  organizers: [
    {},
    {
      steam_id: true,
      organizer: { steam_id: true, name: true, avatar_url: true },
    },
  ],
  tournaments_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
  teams_aggregate: [{}, { aggregate: { count: true } }],
  players_aggregate: [{}, { aggregate: { count: true } }],
  media_aggregate: [{}, { aggregate: { count: true } }],
});
