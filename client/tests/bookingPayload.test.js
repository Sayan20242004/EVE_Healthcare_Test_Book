import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingPayload } from '../src/bookingPayload.js';
import { buildCentreSearchParams, getCurrentCoordinates } from '../src/locationSearch.js';

test('booking payload uses the mapped Mongo centre ID and selected centre test ID', () => {
  const centre = {
    _id: '507f191e810c19729de860ea',
    providerId: 'rapidapi-business-77',
    tests: [{ testId: 'cbc-provider-test-9', name: 'CBC', price: 400 }]
  };
  const payload = buildBookingPayload(centre, { testId: 'cbc-provider-test-9', appointmentDate: '2027-01-18', appointmentTime: '10:30', persons: '2' });
  assert.deepEqual(payload, { centreId: '507f191e810c19729de860ea', testId: 'cbc-provider-test-9', appointmentDate: '2027-01-18', appointmentTime: '10:30', persons: 2 });
  assert.notEqual(payload.centreId, centre.providerId);
});

test('booking payload refuses an unmapped provider listing or foreign test ID', () => {
  const centre = { providerId: 'rapidapi-business-77', tests: [{ testId: 'cbc' }] };
  assert.throws(() => buildBookingPayload(centre, { testId: 'cbc' }), /saved database record/);
  assert.throws(() => buildBookingPayload({ ...centre, _id: 'mongo-id' }, { testId: 'other-test' }), /offered by this centre/);
});

test('manual search keeps sending the entered location as q', () => {
  assert.deepEqual(buildCentreSearchParams('  Delhi  '), { q: 'Delhi' });
});

test('current-location search sends coordinates through the centre search API params', () => {
  assert.deepEqual(buildCentreSearchParams('', { latitude: 28.6139, longitude: 77.209 }), { lat: 28.6139, lng: 77.209 });
});

test('geolocation returns coordinates transiently and configures a bounded browser request', async () => {
  let options;
  const result = await getCurrentCoordinates({ getCurrentPosition(success, _failure, suppliedOptions) { options = suppliedOptions; success({ coords: { latitude: 28.6, longitude: 77.2 } }); } });
  assert.deepEqual(result, { latitude: 28.6, longitude: 77.2 });
  assert.equal(options.timeout, 10000);
  assert.equal(options.enableHighAccuracy, false);
});

test('geolocation errors explain permission, unavailable, and timeout failures', async () => {
  for (const [code, phrase] of [[1, 'permission was denied'], [2, 'unavailable'], [3, 'too long']]) {
    await assert.rejects(getCurrentCoordinates({ getCurrentPosition(_success, failure) { failure({ code }); } }), new RegExp(phrase, 'i'));
  }
  await assert.rejects(getCurrentCoordinates(undefined), /does not support location/i);
});
