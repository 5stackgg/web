export default function formatBytes(Bytes: number) {
  if (!Bytes) {
    return "0 B";
  }

  const _bytes = typeof Bytes === "string" ? parseInt(Bytes) : Bytes;

  if (Bytes === 0 || isNaN(_bytes)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.floor(Math.log(_bytes) / Math.log(1000));
  const value = _bytes / Math.pow(1000, index);

  return `${value.toFixed(2)} ${units[index]}`;
}
