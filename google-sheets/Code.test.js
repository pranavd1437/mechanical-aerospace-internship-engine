'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'),
  context,
  { filename: 'Code.gs' },
);

assert.equal(
  context.normalizeFeedUrl_('https://github.com/example/mechanical-internships'),
  'https://raw.githubusercontent.com/example/mechanical-internships/main/docs/api/jobs.json',
);
assert.equal(
  context.normalizeFeedUrl_('https://github.com/example/mechanical-internships.git'),
  'https://raw.githubusercontent.com/example/mechanical-internships/main/docs/api/jobs.json',
);
assert.equal(
  context.normalizeFeedUrl_(
    'https://github.com/example/mechanical-internships/blob/main/docs/api/jobs.json',
  ),
  'https://raw.githubusercontent.com/example/mechanical-internships/main/docs/api/jobs.json',
);
assert.equal(
  context.normalizeFeedUrl_('https://example.github.io/mechanical-internships/'),
  'https://example.github.io/mechanical-internships/api/jobs.json',
);
assert.throws(() => context.normalizeFeedUrl_('http://example.com/jobs.json'), /HTTPS/);
assert.throws(
  () => context.normalizeFeedUrl_('https://example.com/jobs.json?token=secret'),
  /without tokens/,
);

const row = context.feedRow_({
  id: 'greenhouse:acme:1',
  company: '=HYPERLINK("https://bad.example","Acme")',
  title: 'Mechanical Engineering Intern',
  season: 'Summer 2027',
  season_inferred: false,
  program: 'Internship',
  category: 'Mechanical Design',
  location: 'Newark, NJ',
  remote: false,
  sponsorship: 'unknown',
  h1b_approvals: 12,
  salary: '$30/hr',
  skills: ['SolidWorks', 'GD&T'],
  posted_at: '2026-08-05T12:34:56Z',
  first_seen_at: '2026-08-05T13:00:00Z',
  source: 'greenhouse',
  url: 'https://example.com/job/1',
});
assert.equal(row.length, 17);
assert.equal(row[1][0], "'");
assert.equal(row[4], 'Employer stated');
assert.equal(row[10], 12);
assert.equal(row[13], '2026-08-05');
assert.equal(row[16], 'https://example.com/job/1');
assert.equal(context.safeText_('  +SUM(A1:A2)'), "'  +SUM(A1:A2)");

console.log('Google Sheets helper checks passed.');
