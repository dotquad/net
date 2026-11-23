import { describe, expect, it } from "vitest";
import { detect, gradeTone } from "../src";

describe("detect", () => {
  it("recognises each kind the search box routes", () => {
    const cases: Array<[string, string]> = [
      ["", "Anything"],
      ["8.8.8.8", "IPv4"],
      ["  1.1.1.1 ", "IPv4"],
      ["256.1.1.1", "Keep typing"],
      ["2606:4700:4700::1111", "IPv6"],
      ["::ffff:8.8.8.8", "IPv6"],
      ["1::2::3", "Keep typing"],
      ["10.0.0.0/22", "CIDR"],
      ["10.0.0.0/33", "Keep typing"],
      ["2001:db8::/32", "CIDR"],
      ["AS13335", "ASN"],
      ["as15169", "ASN"],
      ["example.com", "Domain"],
      ["sub.example.co.uk", "Domain"],
      ["8.8", "Keep typing"],
    ];
    for (const [input, label] of cases) expect(detect(input).label, input).toBe(label);
  });
});

describe("gradeTone", () => {
  it("is teal for A, grey for B and C, amber for D and F", () => {
    expect(["A+", "A", "B", "C", "D", "F"].map((g) => gradeTone(g as never))).toEqual([
      "ok",
      "ok",
      "neutral",
      "neutral",
      "flag",
      "flag",
    ]);
  });
});
