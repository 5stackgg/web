export const newsArticleListFields = {
  id: true,
  source: true,
  issue_number: true,
  slug: true,
  url: true,
  title: true,
  teaser: true,
  cover_image_url: true,
  author: true,
  published_at: true,
} as const;

export const newsArticleFields = {
  ...newsArticleListFields,
  content_html: true,
  scraped_at: true,
} as const;
