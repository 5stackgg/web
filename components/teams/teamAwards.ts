// A team's award grant as the teams list shows it.
export type TeamAwardEntry = {
  id: string;
  placement?: number | null;
  source?: string | null;
  tournament_id?: string | null;
  created_at?: string | null;
  award?: {
    id: string;
    name?: string | null;
    tier?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
  tournament?: {
    id?: string;
    name?: string | null;
    start?: string | null;
    stages?: Array<{ type?: string | null }> | null;
  } | null;
  tournament_award?: {
    custom_name?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
};
