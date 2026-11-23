import { describe, expect, it } from "vitest";
import {
  binaryIPv4,
  binaryParts,
  calculate,
  expandIPv6,
  formatIPv4,
  formatIPv6,
  maskToPrefix,
  parseInput,
  parseIPv6,
  rangeKind,
  split,
  wildcard,
} from "../src/subnet";

const calc = (text: string) => calculate(parseInput(text)!);

describe("parsing", () => {
  it("reads CIDR, masks and bare addresses", () => {
    expect(parseInput("10.0.0.0/8")).toEqual({ family: 4, address: 0x0a000000n, prefix: 8 });
    expect(parseInput("192.168.1.10 255.255.255.0")?.prefix).toBe(24);
    expect(parseInput("192.168.1.10/255.255.255.192")?.prefix).toBe(26);
    expect(parseInput("192.168.1.10")?.prefix).toBe(24);
    expect(parseInput("2001:db8::")?.prefix).toBe(64);
    expect(parseInput("2001:db8::/48")?.prefix).toBe(48);
  });

  it("rejects what isn't an address or a valid size", () => {
    for (const bad of [
      "",
      "10.0.0.256/8",
      "10.0.0.0/33",
      "010.0.0.0/8",
      "1.2.3.4 255.0.255.0",
      "2001:db8::/129",
      "1:2:3",
      "hello",
    ]) {
      expect(parseInput(bad), bad).toBeNull();
    }
  });

  it("parses IPv6 in all its forms", () => {
    expect(parseIPv6("::")).toBe(0n);
    expect(parseIPv6("::1")).toBe(1n);
    expect(parseIPv6("2001:DB8::8:800:200C:417A")).toBe(0x20010db8000000000008080020_0c417an);
    expect(parseIPv6("::ffff:192.0.2.1")).toBe(0xffffc0000201n);
    expect(parseIPv6("1::2::3")).toBeNull();
    expect(parseIPv6("1:2:3:4:5:6:7:8:9")).toBeNull();
  });

  it("only accepts contiguous masks", () => {
    expect(maskToPrefix("255.255.255.255")).toBe(32);
    expect(maskToPrefix("0.0.0.0")).toBe(0);
    expect(maskToPrefix("255.255.240.0")).toBe(20);
    expect(maskToPrefix("255.0.255.0")).toBeNull();
  });
});

describe("IPv4 subnets", () => {
  it("works out a /24 from any address in it", () => {
    const s = calc("192.168.1.130/24");
    expect(formatIPv4(s.network)).toBe("192.168.1.0");
    expect(formatIPv4(s.last)).toBe("192.168.1.255");
    expect(formatIPv4(s.firstHost)).toBe("192.168.1.1");
    expect(formatIPv4(s.lastHost)).toBe("192.168.1.254");
    expect(formatIPv4(s.mask)).toBe("255.255.255.0");
    expect(formatIPv4(wildcard(s))).toBe("0.0.0.255");
    expect(s.total).toBe(256n);
    expect(s.hosts).toBe(254n);
    expect(rangeKind(s)).toBe("Private (RFC 1918)");
  });

  it("handles /31 (point-to-point, RFC 3021) and /32", () => {
    const p2p = calc("10.0.0.1/31");
    expect(p2p.hosts).toBe(2n);
    expect(formatIPv4(p2p.firstHost)).toBe("10.0.0.0");
    const single = calc("8.8.8.8/32");
    expect(single.hosts).toBe(1n);
    expect(formatIPv4(single.firstHost)).toBe("8.8.8.8");
    expect(rangeKind(single)).toBe("Public");
  });

  it("handles /0", () => {
    const all = calc("0.0.0.0/0");
    expect(all.total).toBe(2n ** 32n);
    expect(formatIPv4(all.last)).toBe("255.255.255.255");
  });

  it("shows the binary and classifies special ranges", () => {
    expect(binaryIPv4(calc("192.168.1.0/24").mask)).toBe("11111111.11111111.11111111.00000000");
    expect(rangeKind(calc("100.64.1.0/24"))).toBe("Carrier-grade NAT (RFC 6598)");
    expect(rangeKind(calc("203.0.113.0/24"))).toBe("Documentation (TEST-NET-3)");
    expect(rangeKind(calc("172.32.0.0/16"))).toBe("Public");
    // A block bigger than the special range isn't labeled as it.
    expect(rangeKind(calc("192.0.0.0/8"))).toBe("Public");
  });

  it("splits the binary at the prefix", () => {
    const n = calc("192.168.1.0/24").input;
    expect(binaryParts(n, 24)).toEqual(["11000000.10101000.00000001.", "00000000"]);
    expect(binaryParts(n, 20)).toEqual(["11000000.10101000.0000", "0001.00000000"]);
    expect(binaryParts(n, 0)[0]).toBe("");
    expect(binaryParts(n, 32)[1]).toBe("");
  });

  it("splits into smaller subnets", () => {
    const { count, subnets } = split(calc("10.0.0.0/22"), 24);
    expect(count).toBe(4n);
    expect(subnets.map(formatIPv4)).toEqual(["10.0.0.0", "10.0.1.0", "10.0.2.0", "10.0.3.0"]);
    expect(split(calc("10.0.0.0/8"), 32, 3)).toEqual({
      count: 2n ** 24n,
      subnets: [0x0a000000n, 0x0a000001n, 0x0a000002n],
    });
    expect(split(calc("10.0.0.0/24"), 24).count).toBe(0n);
  });
});

describe("IPv6 subnets", () => {
  it("works out the network and size exactly", () => {
    const s = calc("2001:db8:abcd:12::1/48");
    expect(formatIPv6(s.network)).toBe("2001:db8:abcd::");
    expect(formatIPv6(s.last)).toBe("2001:db8:abcd:ffff:ffff:ffff:ffff:ffff");
    expect(s.total).toBe(2n ** 80n);
    expect(s.hosts).toBe(2n ** 80n);
    expect(rangeKind(s)).toBe("Documentation");
    expect(rangeKind(calc("2606:4700::/32"))).toBe("Public");
    expect(rangeKind(calc("fd00::/64"))).toBe("Unique local (private)");
  });

  it("writes addresses in the standard short form and in full", () => {
    expect(formatIPv6(0n)).toBe("::");
    expect(formatIPv6(1n)).toBe("::1");
    expect(formatIPv6(parseIPv6("2001:db8:0:0:1:0:0:1")!)).toBe("2001:db8::1:0:0:1");
    expect(formatIPv6(parseIPv6("2001:db8:0:1:1:1:1:1")!)).toBe("2001:db8:0:1:1:1:1:1");
    expect(expandIPv6(1n)).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
  });
});
