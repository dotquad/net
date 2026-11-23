# Changelog

## [Unreleased]

### Added

- `createClient()`: a typed client for the Dotquad API (`ip`, `me`, `batch`, `asn`, `subnet`, `usage`, and the DNS, WHOIS, DNSSEC, TLS, email, report card, link, takeover, blacklist and traceroute checks), with `DotquadError` telling a used-up quota, a per-second limit, a paid-only endpoint and a bad key apart.
- `detect()`: what a search box holds (IPv4, IPv6, CIDR, ASN or domain).
- Subnet math for IPv4 and IPv6 (`parseInput`, `calculate`, `split`, `rangeKind` and more), with the names of reserved ranges.
- `gradeTone()`: the color family for an A+ to F grade.
