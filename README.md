# Job Hunt

Self-hosted LinkedIn job monitor. Save keyword filters and the app scans
LinkedIn's public jobs feed on a schedule, showing new matches in a dashboard.
No LinkedIn login, no API keys, everything runs locally.

## Quick start

```sh
git clone https://github.com/scormix07/job-hunt.git
cd job-hunt
npm install
npm start          # http://localhost:3344
```

## Presets

The Presets tab in the sidebar gives one-click filters: job titles and
keywords searched in your preferred location. To set yours, copy the template
and edit it:

```sh
cp presets.example.json data/presets.json
```

`data/presets.json` is gitignored so your personal setup stays local. Without
it, generic defaults are shown. The Custom tab is a free-form filter (any
keywords, location and work type).

## Apply kit

The Apply kit button in the toolbar shows your headline, summary and cover
letter with copy buttons. Set it up the same way:

```sh
cp profile.example.json data/profile.json
```

`data/profile.json` is gitignored too.

## How it works

- Filters (keywords plus optional location, time range, work type) are stored
  in `data/db.json` along with every job seen so far.
- Each scan queries LinkedIn's public guest jobs endpoint (no login, no
  cookies), pages through up to 3 pages per filter with polite delays, and
  dedupes by job id. Jobs never seen before land in the New tab.
- Job states: new, seen, saved, hidden.

Environment variables:

| Variable            | Default | Meaning                         |
| ------------------- | ------- | ------------------------------- |
| `PORT`              | `3344`  | HTTP port                       |
| `SCAN_INTERVAL_MIN` | `30`    | Minutes between automatic scans |

## Notes

- The guest endpoint is unofficial; if LinkedIn rate-limits (HTTP 429) the scan
  stops early and retries on the next cycle. Keep the scan interval at 15 min
  or more.
- Personal use only, don't point this at high request volumes.

## License

[MIT](LICENSE)
