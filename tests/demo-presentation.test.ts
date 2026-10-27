import { describe, expect, test } from 'vitest';
import type { Catalog, CatalogRecord, CatalogTemplate } from '@/lib/demo/catalog';
import { dueDate, filterReports, fiscalQuarter, getReportStatus, matchesReportView } from '@/lib/demo/presentation';

const template = (changes: Partial<CatalogTemplate> = {}): CatalogTemplate => ({
  funder_id: 'fdf', language: 'en', revision: 2, approved_revision: null,
  approved: false, exported: false, prepared: true, french_reviewed: true, blocking_checks: [], ...changes,
});
const report = (changes: Partial<CatalogRecord> = {}): CatalogRecord => ({
  record_id: 'fixture-q1', title: 'River programme Q1', period: 'Q1 FY2026-27', received_date: '2026-07-29',
  status: 'new', source_file: 'inbox/fixture-q1.txt', source_location: 'Original synthetic scenario',
  project: 'River programme', funder: 'FDF', preparer: null, completed: [], templates: [], ...changes,
});

describe('report status from current report evidence', () => {
  test('new reports are received; assigned or prepared reports are drafts', () => {
    expect(getReportStatus(report())).toBe('received');
    expect(getReportStatus(report({preparer: 'Preparer'}))).toBe('draft');
    expect(getReportStatus(report({completed: ['extract']}))).toBe('draft');
  });
  test('one current export never completes the report', () => {
    const r = report({ status: 'sent', templates: [template({approved: true, exported: true, approved_revision: 2})] });
    expect(getReportStatus(r)).toBe('draft');
    expect(matchesReportView(r, 'completed')).toBe(false);
  });
  test('both supported current exports complete the report', () => {
    const fdf = template({approved: true, exported: true, approved_revision: 2});
    const quebec = template({funder_id: 'quebec', language: 'fr', approved: true, exported: true, approved_revision: 2});
    expect(getReportStatus(report({templates:[fdf, quebec]}))).toBe('completed');
  });
  test('a stale approval or export does not count as current', () => {
    const stale = template({approved: true, exported: true, approved_revision: 1});
    expect(getReportStatus(report({templates:[stale]}))).toBe('needs_review');
    const current = template({funder_id:'quebec', language:'fr', approved:true, exported:true, approved_revision:2});
    expect(getReportStatus(report({templates:[stale,current]}))).not.toBe('completed');
  });
  test('French requires current bilingual review before needs review', () => {
    const r = report({templates:[template({funder_id:'quebec', language:'fr', french_reviewed:false})]});
    expect(getReportStatus(r)).toBe('draft');
    expect(matchesReportView(r,'action')).toBe(false);
    r.templates[0].french_reviewed = true;
    expect(getReportStatus(r)).toBe('needs_review');
  });
  test('blocking checks and empty draft content prevent needs review', () => {
    expect(getReportStatus(report({templates:[template({blocking_checks:['Complete register coverage']})]}))).toBe('draft');
    expect(getReportStatus(report({templates:[template({prepared:false})]}))).toBe('draft');
  });
  test('approval without export is an action; prepared unapproved content takes priority', () => {
    const approved = template({approved:true, approved_revision:2});
    expect(getReportStatus(report({templates:[approved]}))).toBe('approved');
    expect(matchesReportView(report({templates:[approved]}),'action')).toBe(true);
    expect(getReportStatus(report({templates:[approved,template({funder_id:'quebec',language:'fr'})]}))).toBe('needs_review');
  });
});

describe('source-backed inbox views', () => {
  test('unassigned means no recorded preparer, not a user assignment', () => {
    expect(matchesReportView(report(),'unassigned')).toBe(true);
    expect(matchesReportView(report({preparer:'  '}),'unassigned')).toBe(true);
    expect(matchesReportView(report({preparer:'Preparer'}),'unassigned')).toBe(false);
  });
  test('views and search work together without changing source records', () => {
    const rows: Catalog = [report(),report({record_id:'fixture-q4',title:'Previous report',project:null,funder:null,preparer:'Preparer',completed:['extract']})];
    expect(filterReports(rows,'all',' RIVER ').map(r=>r.record_id)).toEqual(['fixture-q1']);
    expect(filterReports(rows,'drafts').map(r=>r.record_id)).toEqual(['fixture-q4']);
    expect(filterReports(rows,'unassigned','FDF')).toHaveLength(1);
    expect(rows[0].status).toBe('new');
  });
});

describe('owner view and funder deadlines', () => {
  test('My reports matches the acting person as preparer, ignoring case and spaces', () => {
    expect(matchesReportView(report({preparer: 'Daniel'}), 'mine', ' daniel ')).toBe(true);
    expect(matchesReportView(report({preparer: 'Amara'}), 'mine', 'Daniel')).toBe(false);
    expect(matchesReportView(report(), 'mine', 'Daniel')).toBe(false);
    expect(matchesReportView(report({preparer: 'Daniel'}), 'mine', '')).toBe(false);
  });
  test('fiscal quarters follow the April–March year', () => {
    expect(fiscalQuarter('Q1 FY2026-27')).toEqual({quarter: 1, fyStart: 2026});
    expect(fiscalQuarter('May 2026 progress note')).toEqual({quarter: 1, fyStart: 2026});
    expect(fiscalQuarter('October 2026')).toEqual({quarter: 3, fyStart: 2026});
    expect(fiscalQuarter('February 2027')).toEqual({quarter: 4, fyStart: 2026});
    expect(fiscalQuarter('Annual')).toBeNull();
  });
  test('FDF deadlines come from the operating calendar; other funders have none', () => {
    expect(dueDate(report())?.date).toBe('2026-07-31');
    expect(dueDate(report({period: 'Q4 FY2025-26'}))?.date).toBe('2026-04-30');
    expect(dueDate(report({period: 'Q2 FY2026-27'}))?.date).toBe('2026-10-31');
    expect(dueDate(report({period: 'Q3 FY2026-27'}))?.date).toBe('2027-01-31');
    expect(dueDate(report({period: 'June 2026 visit round'}))?.date).toBe('2026-07-31');
    expect(dueDate(report({funder: 'Fondation du Québec'}))).toBeNull();
  });
});
