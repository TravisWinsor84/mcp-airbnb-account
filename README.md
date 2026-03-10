# @striderlabs/mcp-airbnb

MCP server for Airbnb — lets AI agents search listings, check availability, manage reservations, and book stays via browser automation.

Built by [Strider Labs](https://striderlabs.ai).

## Features

- **14 tools** covering the full Airbnb workflow
- Playwright-based browser automation (headless Chromium)
- Stealth patches to avoid bot detection
- Cookie persistence for session management
- Random delays between actions to mimic human behavior
- Graceful CAPTCHA handling
- JSON responses with `success`/`error` fields on all tools

## Tools

| Tool | Description |
|------|-------------|
| `airbnb_status` | Check login status and session info |
| `airbnb_login` | Initiate login flow (returns URL + instructions) |
| `airbnb_logout` | Clear session and cookies |
| `airbnb_search` | Search listings by location, dates, guests |
| `airbnb_get_listing` | Get full listing details by ID or URL |
| `airbnb_check_availability` | Check if a listing is available for dates |
| `airbnb_get_price` | Get full price breakdown (nightly, cleaning, service, taxes, total) |
| `airbnb_save_listing` | Save a listing to wishlist |
| `airbnb_get_saved` | View saved wishlists |
| `airbnb_book` | Book a listing (requires `confirm=true` + user confirmation) |
| `airbnb_get_reservations` | View upcoming or past reservations |
| `airbnb_cancel_reservation` | Cancel a reservation (requires `confirm=true`) |
| `airbnb_message_host` | Send a message to a host |
| `airbnb_get_reviews` | Get guest reviews for a listing |

## Installation

```bash
npm install -g @striderlabs/mcp-airbnb
npx playwright install chromium
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "airbnb": {
      "command": "striderlabs-mcp-airbnb"
    }
  }
}
```

Or with `npx`:

```json
{
  "mcpServers": {
    "airbnb": {
      "command": "npx",
      "args": ["-y", "@striderlabs/mcp-airbnb"]
    }
  }
}
```

## Authentication

Airbnb requires manual login (no API key). The server saves session cookies so you only need to log in once.

1. Ask your AI agent: *"Check my Airbnb login status"*
2. If not logged in, use `airbnb_login` to get the login URL
3. Open the URL in your browser and log in
4. Run `airbnb_status` to confirm the session is active

Cookies are stored at `~/.strider/airbnb/cookies.json`.

## Safety

- **Booking** (`airbnb_book`) and **cancellation** (`airbnb_cancel_reservation`) require explicit `confirm=true` — they return a preview otherwise
- The agent will never book or cancel without your confirmation
- All destructive actions include clear warnings

## Development

```bash
npm install
npx playwright install chromium
npm run build
npm start
```

## License

MIT — Strider Labs
