export function kdrColor(kd: number): string {
  if (kd < 0.9) {
    return "text-red-500";
  } else if (kd >= 0.9 && kd < 1) {
    return "text-orange-500";
  } else if (kd >= 1 && kd < 1.1) {
    return "text-green-400";
  } else if (kd >= 1.1) {
    return "text-green-600";
  }
}
