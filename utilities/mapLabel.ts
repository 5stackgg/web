import cleanMapName from "~/utilities/cleanMapName";

export default function mapLabel(
  map: { label?: string | null; name?: string | null } | null | undefined,
): string {
  return map?.label || cleanMapName(map?.name ?? "");
}
