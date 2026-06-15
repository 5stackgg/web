export default function cleanMapName(name: string) {
  return name
    .replace(/^(de_|cs_)/, "")
    .replaceAll("_", " ")
    .replace(
      /\w\S*/g,
      (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    );
}
