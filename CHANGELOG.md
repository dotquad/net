# Changelog

## [Unreleased]

## [0.1.0] - 2026-11-23

### Added

- `createClient()`: a typed client for the Dotquad API endpoints Dotquad's browser, VS Code and Raycast extensions use (`me`, `ip`, `batch`, `usage`, and the DNS, WHOIS, report card, TLS, email, link and takeover checks), with `DotquadError` telling a used-up quota, a per-second limit, a paid-only endpoint and a bad key apart.
- `detect()`: what a search box holds (IPv4, IPv6, CIDR, ASN or domain).
- Subnet math for IPv4 and IPv6 (`parseInput`, `calculate`, `split`, `rangeKind` and more), with the names of reserved ranges.
- `gradeTone()`: the color family for an A+ to F grade.
- `TRADEMARKS.md`: the MIT License covers the code, not the Dotquad name, logo or other brand assets.
