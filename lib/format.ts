// All times are entered and shown in Manila time (UTC+8, no daylight saving).
const TIME_ZONE = "Asia/Manila";

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// <input type="datetime-local"> gives Manila wall time with no zone, e.g. "2026-10-23T19:00"
export function manilaInputToISO(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}

// The reverse, for pre-filling an input from a stored timestamp
export function isoToManilaInput(iso: string) {
  const manila = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 16);
}

export function formatPeso(amount: number) {
  return amount === 0 ? "Free" : `₱${amount.toLocaleString("en-PH")}`;
}

export function formatLevel(min: number | null, max: number | null) {
  return min === null || max === null ? "All levels" : `V${min}–V${max}`;
}

export function googleMapsUrl(name: string, placeId?: string | null) {
  const query = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  return placeId ? `${query}&query_place_id=${encodeURIComponent(placeId)}` : query;
}
