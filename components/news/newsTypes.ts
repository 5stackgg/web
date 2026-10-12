export interface NewsCardArticle {
  id: string;
  slug: string | null;
  title: string;
  teaser: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at?: string | null;
  content_markdown?: string | null;
}

export interface NewsAuthor {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  country: string | null;
  role: string | null;
}

export interface NewsFullArticle extends NewsCardArticle {
  created_at: string | null;
  author_steam_id: string | null;
  author: NewsAuthor | null;
}

export interface NewsDraft {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  view_count: string;
}
