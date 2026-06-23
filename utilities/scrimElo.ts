export const ELO_MAX = 25000;
export const ELO_STEP = 500;

export function eloMin(range: number[]): number | null {
  return range[0] <= 0 ? null : range[0];
}

export function eloMax(range: number[]): number | null {
  return range[1] >= ELO_MAX ? null : range[1];
}
