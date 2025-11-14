export default function formatBytes(Bytes: number) {
  if (Bytes === 0 || isNaN(Bytes)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.floor(Math.log(Bytes) / Math.log(1000));
  const value = Bytes / Math.pow(1000, index);

  return `${value.toFixed(2)} ${units[index]}`;
}
