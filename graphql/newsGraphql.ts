export const newsArticleListFields = {
  id: true,
  slug: true,
  title: true,
  teaser: true,
  cover_image_url: true,
  status: true,
  published_at: true,
} as const;

export const newsArticleFields = {
  ...newsArticleListFields,
  content_markdown: true,
  author_steam_id: true,
  created_at: true,
  updated_at: true,
  author: {
    steam_id: true,
    name: true,
    avatar_url: true,
    custom_avatar_url: true,
    country: true,
    role: true,
  },
} as const;

export const newsPostAdminFields = {
  id: true,
  slug: true,
  title: true,
  teaser: true,
  cover_image_url: true,
  content_markdown: true,
  status: true,
  author_steam_id: true,
  published_at: true,
  created_at: true,
  updated_at: true,
} as const;
