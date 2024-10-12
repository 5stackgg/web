export default function cleanMapName(name: string) {
  return name.replace("de_", "").replaceAll("_", " ");
}
