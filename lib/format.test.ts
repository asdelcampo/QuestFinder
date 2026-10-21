import { describe, expect, it } from "vitest";
import { formatLevel, formatPeso, formatWhen, isoToManilaInput, manilaInputToISO } from "@/lib/format";

describe("Manila time", () => {
  it("converts form input (Manila wall time) to UTC", () => {
    expect(manilaInputToISO("2026-10-23T19:00")).toBe("2026-10-23T11:00:00.000Z");
  });

  it("crosses midnight correctly", () => {
    expect(manilaInputToISO("2026-10-24T06:30")).toBe("2026-10-23T22:30:00.000Z");
  });

  it("converts UTC back to Manila form input", () => {
    expect(isoToManilaInput("2026-10-23T22:30:00.000Z")).toBe("2026-10-24T06:30");
  });

  it("round-trips", () => {
    expect(isoToManilaInput(manilaInputToISO("2026-12-31T23:59"))).toBe("2026-12-31T23:59");
  });

  it("shows times in Manila whatever the machine's zone", () => {
    expect(formatWhen("2026-10-23T11:00:00.000Z")).toMatch(/7:00/);
  });
});

describe("formatPeso", () => {
  it("shows 0 as Free", () => {
    expect(formatPeso(0)).toBe("Free");
  });

  it("shows pesos with a thousands separator", () => {
    expect(formatPeso(1500)).toBe("₱1,500");
  });
});

describe("formatLevel", () => {
  it("shows a V-grade range", () => {
    expect(formatLevel(1, 3)).toBe("V1–V3");
  });

  it("shows no range as All levels", () => {
    expect(formatLevel(null, null)).toBe("All levels");
  });
});
