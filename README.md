# Airbnb account management for Codex

A separate account-management skill using **Codex's built-in browser/computer-use
tools in your real Chrome profile**. It does not start or install another browser
MCP, export cookies, or require a debugging port.

## Install

Copy `skills/airbnb-account-management` into your Codex skills directory
(usually `~/.codex/skills`). Enable Codex's Chrome/computer-use connection.
Invoke `$airbnb-account-management` or ask to manage an Airbnb account.

The skill supports signed-in navigation, wishlists, trips, host messaging,
booking/cancellation review and requested account updates through Airbnb's UI.
These are guided browser workflows, **not a stable private Airbnb API**.
Codex's action-time confirmation rules apply. Password changes and verification
remain with the user.

For public search and listing extraction use
[the separate read-only MCP and skill](https://github.com/TravisWinsor84/mcp-server-airbnb).

## Verification

On 10 September 2026, the Codex Chrome extension successfully opened the existing
signed-in Airbnb account and read its account-settings and wishlists pages.
No credentials were copied. No account write was performed as a test. Booking,
cancellation and message-delivery flows are therefore not claimed as live-tested.

The skill is validated structurally and with scenario-based independent review.
`npm test` checks packaging and local references; it does not test live Airbnb
writes. This package has no runtime dependencies.

## Fork provenance

This repository was forked from markswendsen-code/mcp-airbnb (Strider Labs).
The original approach's account workflow categories informed the skill.
Its headless browser, cookie-file implementation and optimistic success claims
are not shipped in the default tree. The Git history retains upstream authorship.
An intermediate local browser prototype was retired when the user explicitly
chose Codex's built-in tools. See [UPSTREAM.md](UPSTREAM.md).
