# Google Sheets Sync

This bound Google Apps Script pulls the repository's published
`docs/api/jobs.json` into Google Sheets on demand. It manages two tabs:

- **Mechanical Job Feed** is refreshed from the public JSON feed.
- **Mechanical Job Tracker** keeps selected roles plus your personal status,
  priority, dates, and notes. Refreshes never delete tracker rows or overwrite
  those personal fields.

It is an importer, not a crawler. The repository must run `python run.py update`
and publish the resulting JSON before Google Sheets can see new jobs.

## Set up

1. Create or open a Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Replace the editor contents with [`Code.gs`](Code.gs), then save.
4. Return to the spreadsheet and reload the page.
5. Choose **Internship Tracker → Set or change source URL**.
6. Paste one of these public URLs:

   ```text
   https://github.com/YOUR_USERNAME/YOUR_FORK
   https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_FORK/main/docs/api/jobs.json
   https://YOUR_USERNAME.github.io/YOUR_FORK/api/jobs.json
   ```

7. Choose **Internship Tracker → Sync feed + tracker now** and approve the
   requested spreadsheet/external-request permissions.

The mechanical fork is still local until it is pushed to a public repository;
Google cannot fetch a file from your computer. Do not paste GitHub tokens or
private signed URLs into the script.

## Use it

- Refresh whenever you want from **Internship Tracker → Sync feed + tracker now**.
- Select one or more rows on **Mechanical Job Feed**, then choose
  **Add selected feed rows to tracker**.
- Optionally install a six-hour refresh. Google chooses the exact minute within
  the interval, and the trigger runs under the account that installed it.
- To make a visible refresh button, insert a drawing in Sheets and assign it the
  script name `syncJobsFromMenu` (without parentheses).

## Safety behavior

- The new payload is fetched and fully validated before the old feed is touched.
- HTTP/JSON/schema errors keep the last good sheet intact.
- Existing managed-sheet headers are checked before any rows are refreshed, so
  renamed or moved columns fail safely instead of shifting data.
- A sudden drop below 35% of the previous count is blocked. After checking the
  source repository, you can use **Accept a smaller feed once…**.
- Duplicate job IDs, missing fields, non-HTTPS apply links, and formula-like IDs
  are rejected. Other external text is neutralized before it reaches cells.
- Concurrent manual/scheduled refreshes are locked.
- A role missing from a later feed remains in your tracker and is labeled
  `Not in latest feed`; that is not treated as proof the employer closed it.
- No function fills or submits an application.

## Important publishing detail

The current local package contains the live snapshot, but its generated links
still identify the upstream repository until you create your own GitHub fork.
Once GitHub Actions runs in your fork, `GITHUB_REPOSITORY` makes future output
point at your repository automatically.
