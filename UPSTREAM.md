# Provenance and architecture decision

Source: https://github.com/markswendsen-code/mcp-airbnb at e807a09.
Upstream declares MIT in package metadata and README. Its Git history is retained.

The user selected Codex's built-in browser/computer-use tools exclusively on
10 September 2026. A standalone MCP cannot call the desktop thread's CUA API;
pretending it can would create a non-working integration. Consequently this fork
ships a Codex skill, not the original browser server or a secret CDP bridge.

Useful workflow ideas retained: login status, trips, wishlists, listing-to-checkout,
host conversations, cancellation and account navigation. Improvements: reuse the
real Chrome session, fresh visible-state selection, exact object/recipient checks,
price/refund review, evidence-based completion and no blind mutation retries.

No copied cookie store, stealth patches, no-sandbox flags, undocumented GraphQL
keys, experimental MCP SDK, guessed selectors or fabricated confirmations.
No third-party runtime dependencies remain to update. GitHub Actions checks the
skill package, and scenario review covers price changes and uncertain outcomes.

The standalone browser prototype is retained only in Git history for provenance,
not installed or started. No private session data belongs in this repository.
