export default function formatBits(bits: number) {
  const units = ["b", "Kb", "Mb", "Gb", "Tb", "Pb"];
  let index = 0;
  let value = bits;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}
