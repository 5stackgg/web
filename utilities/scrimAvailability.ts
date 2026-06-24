export const SLOTS = 96;
export const SLOTS_PER_HOUR = 4;
export const PLAYTIME_SLOTS = 4;
const SLOT_MS = 15 * 60 * 1000;

export interface AvailabilityWindow {
  starts_at: string;
  ends_at: string;
  recurring_weekly?: boolean;
}

export function buildAvailableSet(
  windows: Array<AvailabilityWindow> | null | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const window of windows ?? []) {
    const start = new Date(window.starts_at);
    const end = new Date(window.ends_at);
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const day = dayStart.getDay();
    const startSlot = Math.round(
      (start.getTime() - dayStart.getTime()) / SLOT_MS,
    );
    const endSlot = Math.round((end.getTime() - dayStart.getTime()) / SLOT_MS);
    for (let slot = startSlot; slot < endSlot; slot++) {
      const d = (day + Math.floor(slot / SLOTS)) % 7;
      set.add(`${d}-${slot % SLOTS}`);
    }
  }
  return set;
}

export function buildPlaytimeSet(available: Set<string>): Set<string> {
  const set = new Set<string>();
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < SLOTS; slot++) {
      if (!available.has(`${day}-${slot}`)) {
        continue;
      }
      const nextDay = slot + 1 >= SLOTS ? (day + 1) % 7 : day;
      const nextSlot = (slot + 1) % SLOTS;
      if (available.has(`${nextDay}-${nextSlot}`)) {
        continue;
      }
      for (let i = 1; i <= PLAYTIME_SLOTS; i++) {
        const abs = slot + i;
        const d = abs >= SLOTS ? (day + 1) % 7 : day;
        const s = abs % SLOTS;
        if (!available.has(`${d}-${s}`)) {
          set.add(`${d}-${s}`);
        }
      }
    }
  }
  return set;
}

export function buildFreeSet(available: Set<string>): Set<string> {
  const free = new Set(available);
  for (const key of buildPlaytimeSet(available)) {
    free.add(key);
  }
  return free;
}

export function durationSlots(bestOf: number): number {
  return Math.max(1, bestOf) * SLOTS_PER_HOUR;
}

export function slotFits(
  freeSet: Set<string>,
  day: number,
  slot: number,
  slots: number,
): boolean {
  for (let k = 0; k < slots; k++) {
    const abs = slot + k;
    const d = (day + Math.floor(abs / SLOTS)) % 7;
    const s = abs % SLOTS;
    if (!freeSet.has(`${d}-${s}`)) {
      return false;
    }
  }
  return true;
}

export function firstFittingStart(
  available: Set<string>,
  freeSet: Set<string>,
  slots: number,
): { day: number; slot: number } | null {
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < SLOTS; slot++) {
      if (slotFits(freeSet, day, slot, slots)) {
        return { day, slot };
      }
    }
  }
  return null;
}
