export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    let workshopMapId = body.workshop_map_id?.trim();

    const response = await fetch(
      "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          itemcount: "1",
          "publishedfileids[0]": workshopMapId,
        }),
      },
    );
    const data = await response.json();

    const map = data.response.publishedfiledetails.at(0);
    if (!map.title) {
      return await unlistedWorkshopMap(workshopMapId);
    }

    return map;
  } catch (error) {
    console.error("error verifying workshop map:", error);
  }
});

// Steam's API answers an unlisted item with result 9, the same as a missing or
// private one, but its workshop page is open to anyone with the link.
async function unlistedWorkshopMap(workshopMapId: string) {
  if (!/^\d+$/.test(workshopMapId)) {
    return null;
  }

  const response = await fetch(
    `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopMapId}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  const html = await response.text();
  const title = html.match(/class="workshopItemTitle">([^<]+)</)?.[1];

  if (
    !title ||
    !new RegExp(`ShowAddToCollection\\(\\s*'${workshopMapId}',\\s*'730'`).test(
      html,
    )
  ) {
    return null;
  }

  return {
    publishedfileid: workshopMapId,
    title: title.replace(/&(#\d+|amp|lt|gt|quot);/g, (_, entity: string) =>
      entity.startsWith("#")
        ? String.fromCharCode(Number(entity.slice(1)))
        : { amp: "&", lt: "<", gt: ">", quot: '"' }[entity]!,
    ),
    preview_url: html.match(/<meta property="og:image" content="([^"?]+)/)?.[1],
  };
}
