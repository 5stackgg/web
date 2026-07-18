// Proxies Komoot's Photon geocoder (OSM data, free, no key, built for
// as-you-type search). Server-side keeps the browser off a third-party host and
// lets us send an identifying User-Agent.
interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

// Photon has no single display string, so build one from the address parts,
// dropping empties and case-insensitive duplicates (e.g. name === street).
function buildLabel(properties: PhotonFeature["properties"]): string {
  const street = [properties.housenumber, properties.street]
    .filter(Boolean)
    .join(" ");

  const parts = [
    properties.name,
    street,
    properties.city ?? properties.district,
    properties.state,
    properties.postcode,
    properties.country,
  ].filter((part): part is string => !!part);

  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(", ");
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q?.toString().trim();

  if (!query || query.length < 3) {
    return [];
  }

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lang", "en");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "5stack.gg tournament location lookup",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { features?: PhotonFeature[] };

    return (data.features ?? [])
      .map((feature) => {
        // GeoJSON order is [longitude, latitude].
        const [longitude, latitude] = feature.geometry.coordinates;
        return {
          label: buildLabel(feature.properties),
          latitude,
          longitude,
        };
      })
      .filter((result) => result.label.length > 0);
  } catch (error) {
    console.error("geocode lookup failed:", error);
    return [];
  }
});
