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

export function kdrStrokeColor(kd: number): string {
  if (kd < 0.9) {
    return "hsl(0, 84%, 60%)"; // red-500
  } else if (kd >= 0.9 && kd < 1) {
    return "hsl(25, 95%, 53%)"; // orange-500
  } else if (kd >= 1 && kd < 1.1) {
    return "hsl(142, 69%, 58%)"; // green-400
  } else {
    return "hsl(142, 71%, 45%)"; // green-600
  }
}
