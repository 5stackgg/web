export default function formatBits(bits: number) {
  if (bits === 0 || isNaN(bits)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.floor(Math.log(bits) / Math.log(1000));
  const value = bits / Math.pow(1000, index);

  return `${value.toFixed(2)} ${units[index]}`;
}
