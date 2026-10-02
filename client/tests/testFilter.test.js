import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCentresByTest } from '../src/testFilter.js';

const centres = [
  { _id: 'one', name: 'City Lab', tests: [{ name: 'Lipid Profile' }, { name: 'CBC' }] },
  { _id: 'two', name: 'Care Diagnostics', tests: [{ name: 'Thyroid Panel' }] },
  { _id: 'three', name: 'Health Point', tests: [] }
];

test('test filter is case-insensitive and supports partial test-name matches', () => {
  assert.deepEqual(filterCentresByTest(centres, 'lipid').map((centre) => centre._id), ['one']);
  assert.deepEqual(filterCentresByTest(centres, 'PROFILE').map((centre) => centre._id), ['one']);
});

test('blank test filter returns all location results and unmatched tests return none', () => {
  assert.equal(filterCentresByTest(centres, '   '), centres);
  assert.deepEqual(filterCentresByTest(centres, 'vitamin d'), []);
});

test('centres without tests do not match a test search', () => {
  assert.deepEqual(filterCentresByTest([{ name: 'Unlisted centre' }], 'cbc'), []);
});
