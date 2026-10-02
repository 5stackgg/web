import type { ChatGifResult } from "~/utilities/chatAttachments";

export type ChatGifPage = { results: ChatGifResult[]; next: number | null };

export type ChatGifSearch = (
  query: string,
  offset: number,
) => Promise<ChatGifPage | "rate_limited" | "unavailable" | "disabled">;

// Through the api, which holds the GIPHY key.
export const searchChatGifs: ChatGifSearch = async (query, offset) => {
  try {
    return await $fetch<ChatGifPage>(
      `https://${useRuntimeConfig().public.apiDomain}/chat/gifs`,
      { query: { q: query, offset }, credentials: "include" },
    );
  } catch (error) {
    const status = (error as { status?: number })?.status;

    if (status === 429) {
      return "rate_limited";
    }

    if (status === 404) {
      return "disabled";
    }

    return "unavailable";
  }
};
