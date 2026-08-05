/**
 * Mechanical & Aerospace Internship Engine -> Google Sheets
 *
 * Paste this file into a spreadsheet-bound Apps Script project:
 * Google Sheets -> Extensions -> Apps Script.
 *
 * The script only reads a public jobs.json feed. It never applies to jobs,
 * sends alerts, or stores GitHub credentials.
 */

const INTERNSHIP_SYNC = Object.freeze({
  menuName: 'Internship Tracker',
  feedSheet: 'Mechanical Job Feed',
  trackerSheet: 'Mechanical Job Tracker',
  sourceUrlKey: 'JOBS_JSON_URL',
  lastSyncKey: 'LAST_SYNC_AT',
  sourceGeneratedKey: 'SOURCE_GENERATED_AT',
  lastCountKey: 'LAST_JOB_COUNT',
  scheduledHandler: 'syncJobsScheduled',
  collapseFloor: 10,
  collapseFraction: 0.35,
});

const FEED_HEADERS = Object.freeze([
  'ID',
  'Company',
  'Role',
  'Cycle',
  'Cycle Evidence',
  'Program',
  'Category',
  'Location',
  'Remote',
  'Sponsorship',
  'H-1B Approvals',
  'Salary',
  'Skills',
  'Posted',
  'First Seen',
  'Source',
  'Apply URL',
]);

const TRACKER_HEADERS = Object.freeze([
  'ID',
  'Company',
  'Role',
  'Cycle',
  'Cycle Evidence',
  'Program',
  'Category',
  'Location',
  'Remote',
  'Sponsorship',
  'H-1B Approvals',
  'Salary',
  'Skills',
  'Posted',
  'Apply URL',
  'Feed Status',
  'Status',
  'Priority',
  'Date Saved',
  'Date Applied',
  'Follow-up Date',
  'Notes',
  'Last Synced',
]);

const STATUS_OPTIONS = Object.freeze([
  'Saved',
  'Researching',
  'Ready to Apply',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
  'Withdrawn',
  'Skip',
]);

const PRIORITY_OPTIONS = Object.freeze(['High', 'Medium', 'Low']);


/** Add the spreadsheet menu whenever an editor opens the file. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(INTERNSHIP_SYNC.menuName)
    .addItem('Sync feed + tracker now', 'syncJobsFromMenu')
    .addItem('Add selected feed rows to tracker', 'addSelectedRowsToTracker')
    .addSeparator()
    .addItem('Set or change source URL', 'setJobsSourceUrl')
    .addItem('Show sync status', 'showSyncStatus')
    .addSeparator()
    .addItem('Install 6-hour auto-refresh', 'installSixHourRefresh')
    .addItem('Remove auto-refresh', 'removeAutoRefresh')
    .addSeparator()
    .addItem('Accept a smaller feed once…', 'forceSyncFromMenu')
    .addToUi();
}


/** Prompt for a public GitHub/raw/Pages jobs.json URL and validate it. */
function setJobsSourceUrl() {
  const ui = SpreadsheetApp.getUi();
  const properties = documentProperties_();
  const current = properties.getProperty(INTERNSHIP_SYNC.sourceUrlKey) || '(not set)';
  const result = ui.prompt(
    'Set jobs feed URL',
    'Paste your public GitHub repository URL, GitHub Pages URL, or the exact ' +
      'docs/api/jobs.json raw URL.\n\nCurrent: ' + current +
      '\n\nDo not paste a private token or signed URL.',
    ui.ButtonSet.OK_CANCEL,
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;

  try {
    const url = normalizeFeedUrl_(result.getResponseText());
    const payload = fetchPayload_(url);
    properties.setProperty(INTERNSHIP_SYNC.sourceUrlKey, url);
    properties.deleteProperty(INTERNSHIP_SYNC.lastCountKey);
    properties.deleteProperty(INTERNSHIP_SYNC.lastSyncKey);
    properties.deleteProperty(INTERNSHIP_SYNC.sourceGeneratedKey);
    ui.alert(
      'Source saved',
      'Validated ' + payload.jobs.length + ' jobs. Choose “Sync feed + tracker now” next.\n\n' + url,
      ui.ButtonSet.OK,
    );
  } catch (error) {
    ui.alert('Source not saved', errorMessage_(error), ui.ButtonSet.OK);
  }
}


/** Manual entry point: safe refresh with a visible result. */
function syncJobsFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = syncJobs_(false);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Loaded ' + result.count + ' jobs; tracker rows were preserved.',
      INTERNSHIP_SYNC.menuName,
      8,
    );
  } catch (error) {
    ui.alert(
      'Sync failed',
      errorMessage_(error) + '\n\nTracker rows and personal fields are never deleted by a sync.',
      ui.ButtonSet.OK,
    );
  }
}


/** Scheduled entry point: no dialogs; failures surface in Apps Script logs/email. */
function syncJobsScheduled() {
  return syncJobs_(false);
}


/** Deliberately bypass the sudden-count-collapse guard after a confirmation. */
function forceSyncFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    'Accept a smaller feed?',
    'Only use this after checking the source repository. This can mark tracked ' +
      'roles “Not in latest feed,” but it will not delete tracker rows or notes.',
    ui.ButtonSet.YES_NO,
  );
  if (answer !== ui.Button.YES) return;
  try {
    const result = syncJobs_(true);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Force-loaded ' + result.count + ' jobs.',
      INTERNSHIP_SYNC.menuName,
      8,
    );
  } catch (error) {
    ui.alert(
      'Sync failed',
      errorMessage_(error) + '\n\nTracker rows and personal fields are never deleted by a sync.',
      ui.ButtonSet.OK,
    );
  }
}


/** Core sync. Everything is fetched and validated before the feed is touched. */
function syncJobs_(allowCollapse) {
  const lock = LockService.getDocumentLock();
  if (!lock) {
    throw new Error('This must be a script bound to a Google Sheet, not a standalone script.');
  }
  if (!lock.tryLock(30000)) {
    throw new Error('Another refresh is already running. Try again in a minute.');
  }

  try {
    const properties = documentProperties_();
    const url = properties.getProperty(INTERNSHIP_SYNC.sourceUrlKey);
    if (!url) {
      throw new Error(
        'No source URL is configured. Use Internship Tracker -> Set or change source URL.',
      );
    }

    const payload = fetchPayload_(url);
    const jobs = payload.jobs.slice().sort(compareJobsNewestFirst_);
    enforceCountGuard_(jobs.length, properties, Boolean(allowCollapse));

    const feedRows = jobs.map(feedRow_);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    assertManagedSheetSchemas_(spreadsheet);
    writeFeed_(spreadsheet, feedRows);
    syncExistingTrackerRows_(spreadsheet, jobs);

    const syncedAt = new Date().toISOString();
    properties.setProperties({
      [INTERNSHIP_SYNC.lastSyncKey]: syncedAt,
      [INTERNSHIP_SYNC.sourceGeneratedKey]: String(payload.generated_at || ''),
      [INTERNSHIP_SYNC.lastCountKey]: String(jobs.length),
    });
    SpreadsheetApp.flush();
    return { count: jobs.length, generatedAt: payload.generated_at || '', syncedAt: syncedAt };
  } finally {
    lock.releaseLock();
  }
}


/** Add the selected feed rows without overwriting personal tracker fields. */
function addSelectedRowsToTracker() {
  const ui = SpreadsheetApp.getUi();
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const feed = spreadsheet.getActiveSheet();
    if (!feed || feed.getName() !== INTERNSHIP_SYNC.feedSheet) {
      throw new Error('Select one or more rows on the “' + INTERNSHIP_SYNC.feedSheet + '” sheet.');
    }
    assertHeaders_(feed, FEED_HEADERS, 'feed');

    const selection = feed.getActiveRange();
    if (!selection) throw new Error('No feed rows are selected.');
    const firstRow = Math.max(2, selection.getRow());
    const lastRow = Math.min(feed.getLastRow(), selection.getLastRow());
    if (lastRow < firstRow) throw new Error('Select at least one job row, not only the header.');

    const selected = feed
      .getRange(firstRow, 1, lastRow - firstRow + 1, FEED_HEADERS.length)
      .getValues()
      .filter(function (row) { return String(row[0] || '').trim() !== ''; });
    if (!selected.length) throw new Error('The selected rows contain no jobs.');

    const tracker = ensureTrackerSheet_(spreadsheet);
    const existingById = trackerRowsById_(tracker);
    const now = new Date();
    const newRows = [];
    let updated = 0;

    selected.forEach(function (feedRow) {
      const id = String(feedRow[0]);
      const sourceColumns = trackerSourceColumns_(feedRow, 'Listed');
      const existingRow = existingById[id];
      if (existingRow) {
        tracker.getRange(existingRow, 1, 1, sourceColumns.length).setValues([sourceColumns]);
        tracker.getRange(existingRow, TRACKER_HEADERS.length).setValue(now);
        updated += 1;
      } else {
        newRows.push(sourceColumns.concat(['Saved', '', now, '', '', '', now]));
        existingById[id] = tracker.getLastRow() + newRows.length;
      }
    });

    if (newRows.length) {
      ensureSheetSize_(tracker, tracker.getLastRow() + newRows.length, TRACKER_HEADERS.length);
      tracker
        .getRange(tracker.getLastRow() + 1, 1, newRows.length, TRACKER_HEADERS.length)
        .setValues(newRows);
    }
    formatTrackerSheet_(tracker);
    ui.alert(
      'Tracker updated',
      newRows.length + ' added; ' + updated + ' already tracked and refreshed. ' +
        'Status, priority, dates, and notes were preserved.',
      ui.ButtonSet.OK,
    );
  } catch (error) {
    ui.alert('Could not update tracker', errorMessage_(error), ui.ButtonSet.OK);
  }
}


/** Create one six-hour clock trigger, replacing only this script's old one. */
function installSixHourRefresh() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (!documentProperties_().getProperty(INTERNSHIP_SYNC.sourceUrlKey)) {
      throw new Error('Set and test the source URL before installing automatic refresh.');
    }
    removeRefreshTriggers_();
    ScriptApp.newTrigger(INTERNSHIP_SYNC.scheduledHandler)
      .timeBased()
      .everyHours(6)
      .create();
    ui.alert(
      'Automatic refresh installed',
      'Google will run the sync approximately every six hours under your account. ' +
        'Your tracker notes remain untouched.',
      ui.ButtonSet.OK,
    );
  } catch (error) {
    ui.alert('Could not install refresh', errorMessage_(error), ui.ButtonSet.OK);
  }
}


/** Remove only clock triggers belonging to this importer. */
function removeAutoRefresh() {
  const removed = removeRefreshTriggers_();
  SpreadsheetApp.getUi().alert(
    'Automatic refresh removed',
    removed + ' trigger' + (removed === 1 ? '' : 's') + ' removed.',
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}


/** Show the configured source and latest successful refresh metadata. */
function showSyncStatus() {
  const properties = documentProperties_();
  const triggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === INTERNSHIP_SYNC.scheduledHandler;
  }).length;
  const message = [
    'Source: ' + (properties.getProperty(INTERNSHIP_SYNC.sourceUrlKey) || 'not set'),
    'Last successful sync: ' + (properties.getProperty(INTERNSHIP_SYNC.lastSyncKey) || 'never'),
    'Source generated at: ' +
      (properties.getProperty(INTERNSHIP_SYNC.sourceGeneratedKey) || 'unknown'),
    'Last job count: ' + (properties.getProperty(INTERNSHIP_SYNC.lastCountKey) || 'unknown'),
    'Automatic refresh triggers: ' + triggerCount,
  ].join('\n');
  SpreadsheetApp.getUi().alert('Internship tracker status', message, SpreadsheetApp.getUi().ButtonSet.OK);
}


function fetchPayload_(url) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Accept: 'application/json' },
    followRedirects: true,
    muteHttpExceptions: true,
    validateHttpsCertificates: true,
  });
  const code = response.getResponseCode();
  if (code !== 200) throw new Error('Feed returned HTTP ' + code + '.');

  const text = response.getContentText();
  if (!text || text.length > 5 * 1024 * 1024) {
    throw new Error('Feed was empty or unexpectedly large.');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    throw new Error('Feed did not return valid JSON. Check that the URL ends in jobs.json.');
  }
  if (!payload || !Array.isArray(payload.jobs)) {
    throw new Error('Feed JSON is missing the jobs array.');
  }
  if (payload.count !== undefined && Number(payload.count) !== payload.jobs.length) {
    throw new Error(
      'Feed count mismatch: metadata says ' + payload.count +
        ', but the payload contains ' + payload.jobs.length + '.',
    );
  }
  if (payload.jobs.length === 0) {
    throw new Error('Feed contains zero jobs, so the last good sheet was kept.');
  }

  const ids = Object.create(null);
  payload.jobs.forEach(function (job, index) {
    if (!job || typeof job !== 'object') throw new Error('Job ' + (index + 1) + ' is invalid.');
    const id = String(job.id || '').trim();
    const company = String(job.company || '').trim();
    const title = String(job.title || '').trim();
    const applyUrl = String(job.url || '').trim();
    if (!id || !company || !title) {
      throw new Error('Job ' + (index + 1) + ' is missing an ID, company, or title.');
    }
    if (/^[=+\-@]/.test(id)) throw new Error('Job ' + (index + 1) + ' has an unsafe ID.');
    if (!/^https:\/\//i.test(applyUrl)) {
      throw new Error('Job ' + (index + 1) + ' has a non-HTTPS apply URL.');
    }
    if (ids[id]) throw new Error('Feed contains duplicate job ID: ' + id);
    ids[id] = true;
  });
  return payload;
}


function normalizeFeedUrl_(input) {
  let url = String(input || '').trim();
  if (!url) throw new Error('Enter a source URL.');
  if (!/^https:\/\//i.test(url)) throw new Error('The source must use HTTPS.');
  if (/[?&](?:token|access_token|api[_-]?key|auth)=/i.test(url)) {
    throw new Error('Use a public feed URL without tokens or API keys.');
  }

  let match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i);
  if (match) {
    return 'https://raw.githubusercontent.com/' + match[1] + '/' + match[2] +
      '/main/docs/api/jobs.json';
  }
  match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i,
  );
  if (match) {
    return 'https://raw.githubusercontent.com/' + match[1] + '/' + match[2] +
      '/' + match[3] + '/' + match[4];
  }
  match = url.match(/^https:\/\/[^/]+\.github\.io\/[^/?#]+\/?$/i);
  if (match) return url.replace(/\/$/, '') + '/api/jobs.json';

  if (!/\.json(?:$|[?#])/i.test(url)) {
    throw new Error('Use a repository URL or a direct jobs.json URL.');
  }
  return url;
}


function enforceCountGuard_(count, properties, allowCollapse) {
  const previous = Number(properties.getProperty(INTERNSHIP_SYNC.lastCountKey) || 0);
  if (
    !allowCollapse &&
    previous >= INTERNSHIP_SYNC.collapseFloor &&
    count < Math.ceil(previous * INTERNSHIP_SYNC.collapseFraction)
  ) {
    throw new Error(
      'The feed fell from ' + previous + ' to ' + count + ' jobs. The old data was kept. ' +
        'Check the repository first; if the drop is legitimate, choose ' +
        '“Accept a smaller feed once…” from the menu.',
    );
  }
}


function writeFeed_(spreadsheet, rows) {
  const sheet = getOrCreateSheet_(spreadsheet, INTERNSHIP_SYNC.feedSheet);
  const oldLastRow = sheet.getLastRow();
  ensureSheetSize_(sheet, rows.length + 1, FEED_HEADERS.length);
  const filter = sheet.getFilter();
  if (filter) filter.remove();

  sheet.getRange(1, 1, rows.length + 1, FEED_HEADERS.length)
    .setValues([FEED_HEADERS.slice()].concat(rows));
  if (oldLastRow > rows.length + 1) {
    sheet
      .getRange(rows.length + 2, 1, oldLastRow - rows.length - 1, FEED_HEADERS.length)
      .clearContent();
  }
  formatFeedSheet_(sheet, rows.length);
}


function feedRow_(job) {
  const cycles = Array.isArray(job.seasons) && job.seasons.length
    ? job.seasons.join('; ')
    : String(job.season || '');
  return [
    safeText_(job.id),
    safeText_(job.company),
    safeText_(job.title),
    safeText_(cycles),
    job.season_inferred ? 'Not stated' : 'Employer stated',
    safeText_(job.program),
    safeText_(job.category),
    safeText_(job.location),
    job.remote ? 'Yes' : '',
    safeText_(job.sponsorship),
    finiteNumberOrBlank_(job.h1b_approvals),
    safeText_(job.salary),
    safeText_(Array.isArray(job.skills) ? job.skills.join(', ') : ''),
    dateOnly_(job.posted_at),
    dateOnly_(job.first_seen_at),
    safeText_(job.source),
    safeHttpsUrl_(job.url),
  ];
}


function syncExistingTrackerRows_(spreadsheet, jobs) {
  const tracker = spreadsheet.getSheetByName(INTERNSHIP_SYNC.trackerSheet);
  if (!tracker || tracker.getLastRow() < 2) return;
  assertHeaders_(tracker, TRACKER_HEADERS, 'tracker');

  const byId = Object.create(null);
  jobs.forEach(function (job) { byId[String(job.id)] = feedRow_(job); });
  const rowCount = tracker.getLastRow() - 1;
  const existing = tracker.getRange(2, 1, rowCount, TRACKER_HEADERS.length).getValues();
  const sourceRows = [];
  const syncTimes = [];
  const now = new Date();

  existing.forEach(function (row) {
    const id = String(row[0] || '');
    const currentFeedRow = byId[id];
    if (currentFeedRow) {
      sourceRows.push(trackerSourceColumns_(currentFeedRow, 'Listed'));
    } else {
      const unchanged = row.slice(0, 16);
      unchanged[15] = id ? 'Not in latest feed' : '';
      sourceRows.push(unchanged);
    }
    syncTimes.push([id ? now : row[TRACKER_HEADERS.length - 1]]);
  });

  tracker.getRange(2, 1, rowCount, 16).setValues(sourceRows);
  tracker.getRange(2, TRACKER_HEADERS.length, rowCount, 1).setValues(syncTimes);
  formatTrackerSheet_(tracker);
}


function trackerSourceColumns_(feedRow, feedStatus) {
  return feedRow.slice(0, 14).concat([feedRow[16], feedStatus]);
}


function ensureTrackerSheet_(spreadsheet) {
  const sheet = getOrCreateSheet_(spreadsheet, INTERNSHIP_SYNC.trackerSheet);
  ensureSheetSize_(sheet, Math.max(sheet.getMaxRows(), 2), TRACKER_HEADERS.length);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TRACKER_HEADERS.length).setValues([TRACKER_HEADERS.slice()]);
  } else {
    assertHeaders_(sheet, TRACKER_HEADERS, 'tracker');
  }
  formatTrackerSheet_(sheet);
  return sheet;
}


function trackerRowsById_(sheet) {
  const result = Object.create(null);
  if (sheet.getLastRow() < 2) return result;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  ids.forEach(function (row, index) {
    const id = String(row[0] || '').trim();
    if (id && !result[id]) result[id] = index + 2;
  });
  return result;
}


function formatFeedSheet_(sheet, rowCount) {
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.getRange(1, 1, 1, FEED_HEADERS.length)
    .setBackground('#0b57d0')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  if (rowCount > 0) {
    sheet.getRange(1, 1, rowCount + 1, FEED_HEADERS.length).createFilter();
    sheet.getRange(2, 1, rowCount, FEED_HEADERS.length).setVerticalAlignment('top');
    sheet.getRange(2, 3, rowCount, 6).setWrap(true);
  }
  sheet.hideColumns(1);
  setUsefulWidths_(sheet, false);
}


function formatTrackerSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.getRange(1, 1, 1, TRACKER_HEADERS.length)
    .setBackground('#174ea6')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.hideColumns(1);
  setUsefulWidths_(sheet, true);

  const validationRows = Math.max(sheet.getMaxRows() - 1, 1);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPTIONS.slice(), true)
    .setAllowInvalid(false)
    .build();
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PRIORITY_OPTIONS.slice(), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 17, validationRows, 1).setDataValidation(statusRule);
  sheet.getRange(2, 18, validationRows, 1).setDataValidation(priorityRule);
  sheet.getRange(2, 19, validationRows, 3).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 23, validationRows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(2, 17, validationRows, 6).setBackground('#fff8e1');
}


function setUsefulWidths_(sheet, tracker) {
  sheet.setColumnWidth(2, 150);  // company
  sheet.setColumnWidth(3, 320);  // role
  sheet.setColumnWidth(4, 120);  // cycle
  sheet.setColumnWidth(7, 180);  // category
  sheet.setColumnWidth(8, 240);  // location
  sheet.setColumnWidth(10, 125); // sponsorship
  sheet.setColumnWidth(13, 220); // skills
  sheet.setColumnWidth(15, tracker ? 220 : 105); // URL in tracker, first seen in feed
  if (tracker) {
    sheet.setColumnWidth(16, 130);
    sheet.setColumnWidth(17, 130);
    sheet.setColumnWidth(18, 90);
    sheet.setColumnWidth(22, 300);
  } else {
    sheet.setColumnWidth(17, 220);
  }
}


function assertHeaders_(sheet, expected, label) {
  if (sheet.getLastColumn() < expected.length) {
    throw new Error('The ' + label + ' sheet schema is incomplete; no data was changed.');
  }
  const actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  for (let i = 0; i < expected.length; i += 1) {
    if (String(actual[i]) !== expected[i]) {
      throw new Error(
        'The ' + label + ' sheet header “' + expected[i] + '” was moved or renamed. ' +
          'Restore the header row before syncing.',
      );
    }
  }
}


function assertManagedSheetSchemas_(spreadsheet) {
  const feed = spreadsheet.getSheetByName(INTERNSHIP_SYNC.feedSheet);
  if (feed && feed.getLastRow() > 0) assertHeaders_(feed, FEED_HEADERS, 'feed');

  const tracker = spreadsheet.getSheetByName(INTERNSHIP_SYNC.trackerSheet);
  if (tracker && tracker.getLastRow() > 0) {
    assertHeaders_(tracker, TRACKER_HEADERS, 'tracker');
  }
}


function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}


function ensureSheetSize_(sheet, rows, columns) {
  if (sheet.getMaxRows() < rows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < columns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
  }
}


function removeRefreshTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === INTERNSHIP_SYNC.scheduledHandler) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}


function documentProperties_() {
  const properties = PropertiesService.getDocumentProperties();
  if (!properties) {
    throw new Error('This must be a script bound to a Google Sheet, not a standalone script.');
  }
  return properties;
}


function compareJobsNewestFirst_(a, b) {
  const byDate = String(b.posted_at || '').localeCompare(String(a.posted_at || ''));
  if (byDate) return byDate;
  const byCompany = String(a.company || '').localeCompare(String(b.company || ''));
  if (byCompany) return byCompany;
  return String(a.title || '').localeCompare(String(b.title || ''));
}


function safeText_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}


function safeHttpsUrl_(value) {
  const text = String(value || '').trim();
  return /^https:\/\//i.test(text) ? text : '';
}


function finiteNumberOrBlank_(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}


function dateOnly_(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}


function errorMessage_(error) {
  return error && error.message ? error.message : String(error);
}
