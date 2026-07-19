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

// Anonymous proxy abuse could get the deployment IP banned by
// photon.komoot.io, so cap the query size and rate-limit per client IP.
const MAX_QUERY_LENGTH = 256;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart >= RATE_WINDOW_MS) {
      rateBuckets.delete(key);
    }
  }

  const bucket = rateBuckets.get(ip);
  if (!bucket) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q?.toString().trim();

  if (!query || query.length < 3) {
    return [];
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: "Query too long",
    });
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if (isRateLimited(ip)) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests",
    });
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
