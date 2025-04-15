export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let workshopMapId = body.workshop_map_id?.trim();

  try {
    const res = await fetch(
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
    const data = await res.json();

    const map = data.response.publishedfiledetails.at(0);
    if (!map.title) {
      return null;
    }

    return map;
  } catch (error) {
    console.error("Error verifying workshop map:", error);
  }
});
