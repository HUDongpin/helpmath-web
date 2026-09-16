import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import type {ResourceEntry} from '../content/types';
import {normalizeSearchValue, resourceSearchText} from '../lib/resource-search';

const sample: ResourceEntry = {
  id: 'wwc-study-record',
  category: 'research',
  title: 'What Works Clearinghouse review',
  format: 'HTML',
  dateLabel: 'October 2012',
  status: 'available',
  statusLabel: 'Official source verified',
  description: 'WWC found the Tran study met standards without reservations.',
  action: {label: 'Open the WWC study record', href: 'https://ies.ed.gov/ncee/wwc/Study/72999'},
};

describe('resource search text', () => {
  it('strips combining marks and case so accented queries still match', () => {
    assert.equal(normalizeSearchValue('Modernización'), 'modernizacion');
    assert.match(resourceSearchText(sample), /what works clearinghouse review/u);
    assert.match(resourceSearchText(sample), /open the wwc study record/u);
    assert.ok(resourceSearchText(sample).includes(normalizeSearchValue('WWC')));
  });
});
