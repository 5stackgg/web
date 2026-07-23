// Prize places are auto-numbered from list position ("#1", "#2", …) so dragging
// a row renumbers it for free. Organizers can still type a custom label
// ("Top 8", "4th-8th"); anything that doesn't read as a plain rank is kept.
const AUTO_PLACE = /^#?\s*\d+\s*(?:st|nd|rd|th)?\s*(?:place)?$/i;

export const DEFAULT_CURRENCY = "$";

export function autoPlace(index: number): string {
  return `#${index + 1}`;
}

// Editors hold auto rows as an empty label, so a stored "#2" round-trips back to
// "auto" instead of pinning the row to its old position.
export function isAutoPlace(place?: string | null): boolean {
  const value = (place ?? "").trim();
  return value === "" || AUTO_PLACE.test(value);
}

export function placeLabel(place?: string | null): string {
  return isAutoPlace(place) ? "" : (place ?? "").trim();
}

// The value actually persisted: the custom label, or this row's auto number.
export function effectivePlace(
  label: string | null | undefined,
  index: number,
) {
  return (label ?? "").trim() || autoPlace(index);
}

// Bare amounts default to dollars — "1000" persists as "$1000". Values that
// already carry a symbol or read as text ("€500", "Custom Knife") are untouched.
const BARE_AMOUNT = /^\d[\d,]*(?:\.\d+)?$/;

export function normalizePrize(prize: string): string {
  const value = prize.trim();
  return BARE_AMOUNT.test(value) ? `${DEFAULT_CURRENCY}${value}` : value;
}
