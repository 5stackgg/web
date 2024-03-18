export default function formatStatValue(stat: string) {
  if (!stat) {
    return 0;
  }

  return Number(parseFloat(stat).toFixed(2));
}
