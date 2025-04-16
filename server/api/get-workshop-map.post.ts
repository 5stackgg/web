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
      return null;
    }

    return map;
  } catch (error) {
    console.error("error verifying workshop map:", error);
  }
});
