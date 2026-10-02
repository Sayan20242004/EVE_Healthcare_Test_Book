import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const [{ app }, { config }, { calculateAmount, validateAppointment, isValidTime }, { normalizeCentre, searchBusinesses, clearProviderCache }, { nextBookingStatus }, { upsertProviderCentre }] = await Promise.all([
  import('../server.js'), import('../config/env.js'), import('../services/bookingService.js'), import('../services/rapidApiService.js'), import('../services/paymentState.js'), import('../services/centrePersistence.js')
]);
const patientToken = () => jwt.sign({ sub: '507f1f77bcf86cd799439011' }, config.jwtSecret, { expiresIn: '5m' });

test('protected routes reject missing and invalid JWTs', async () => {
  assert.equal((await request(app).get('/api/bookings/my')).status, 401);
  assert.equal((await request(app).get('/api/bookings/my').set('Authorization', 'Bearer broken')).status, 401);
});

test('authenticated endpoint validates search input before calling RapidAPI', async () => {
  const token = patientToken();
  assert.equal((await request(app).get('/api/centres/search').set('Authorization', `Bearer ${token}`)).status, 400);
  assert.equal((await request(app).get('/api/centres/search?q=x').set('Authorization', `Bearer ${token}`)).status, 400);
  assert.equal((await request(app).get('/api/centres/search?lat=28.6').set('Authorization', `Bearer ${token}`)).status, 400);
  assert.equal((await request(app).get('/api/centres/search?lat=91&lng=77').set('Authorization', `Bearer ${token}`)).status, 400);
  assert.equal((await request(app).get('/api/centres/search?lat=&lng=').set('Authorization', `Bearer ${token}`)).status, 400);
});

test('RapidAPI search uses manual text unchanged and forwards transient coordinates without caching them', async () => {
  const originalFetch = globalThis.fetch;
  const savedConfig = { rapidApiKey: config.rapidApiKey, rapidApiHost: config.rapidApiHost, rapidApiBaseUrl: config.rapidApiBaseUrl };
  const requests = [];
  config.rapidApiKey = 'test-key'; config.rapidApiHost = 'example.test'; config.rapidApiBaseUrl = 'https://example.test';
  clearProviderCache();
  globalThis.fetch = async (url) => {
    requests.push(new URL(url));
    return { ok: true, json: async () => [{ business_id: 'test-centre', name: 'Test centre' }] };
  };
  try {
    await searchBusinesses('Delhi');
    await searchBusinesses('Delhi');
    assert.equal(requests.length, 1, 'manual searches retain the existing short cache');
    assert.equal(requests[0].searchParams.get('query'), 'diagnostic centres in Delhi');
    assert.equal(requests[0].searchParams.has('lat'), false);

    await searchBusinesses('diagnostic centres', { latitude: 28.6139, longitude: 77.209 });
    await searchBusinesses('diagnostic centres', { latitude: 28.6139, longitude: 77.209 });
    assert.equal(requests.length, 3, 'current-location searches are not cached');
    assert.equal(requests[1].searchParams.get('query'), 'diagnostic centres');
    assert.equal(requests[1].searchParams.get('lat'), '28.6139');
    assert.equal(requests[1].searchParams.get('lng'), '77.209');
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(config, savedConfig);
    clearProviderCache();
  }
});

test('booking rejects malformed centre IDs before database access', async () => {
  const response = await request(app).post('/api/bookings').set('Authorization', `Bearer ${patientToken()}`).send({ centreId: 'bad-id', testId: 'cbc', appointmentDate: '2027-01-01', appointmentTime: '10:00', persons: 1 });
  assert.equal(response.status, 400); assert.equal(response.body.error.code, 'INVALID_CENTRE_ID');
});

test('missing centreId reproduces and preserves the booking validation error', async () => {
  const response = await request(app).post('/api/bookings').set('Authorization', `Bearer ${patientToken()}`).send({ testId: 'cbc', appointmentDate: '2027-01-18', appointmentTime: '10:30', persons: 1 });
  assert.equal(response.status, 400); assert.match(response.body.error.message, /centreId: Required/);
});

test('invalid booking and payment IDs return client errors', async () => {
  const token = patientToken();
  assert.equal((await request(app).get('/api/bookings/nope').set('Authorization', `Bearer ${token}`)).status, 400);
  assert.equal((await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({ bookingId: 'nope', result: 'SUCCESS', idempotencyKey: 'test-key-123456' })).status, 400);
  assert.equal((await request(app).get('/api/payments/nope').set('Authorization', `Bearer ${token}`)).status, 400);
});

test('payment webhook requires an audience-scoped signed token', async () => {
  const body = { eventId: 'evt-1', bookingId: '507f1f77bcf86cd799439011', status: 'SUCCESS' };
  assert.equal((await request(app).post('/api/payments/webhook').send(body)).status, 401);
  const wrongAudience = jwt.sign({}, config.jwtSecret, { audience: 'wrong-audience' });
  assert.equal((await request(app).post('/api/payments/webhook').set('Authorization', `Bearer ${wrongAudience}`).send(body)).status, 401);
});

test('server amount calculation multiplies price by persons and rejects invalid values', () => {
  assert.equal(calculateAmount(499.5, 2), 999);
  assert.equal(calculateAmount(0, 3), 0);
  assert.throws(() => calculateAmount(-2, 1), { code: 'INVALID_AMOUNT' });
  assert.throws(() => calculateAmount(10, 1.5), { code: 'INVALID_AMOUNT' });
});

test('appointment validation checks date, time, persons, and centre closing time', () => {
  const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const centre = { openingTime: '07:00', closingTime: '20:00' };
  assert.equal(validateAppointment({ date: future, time: '19:59', persons: 2, centre }).toISOString().slice(0, 10), future);
  for (const invalid of [
    { date: 'not-a-date', time: '10:00', persons: 1, centre },
    { date: future, time: '20:00', persons: 1, centre },
    { date: future, time: '06:59', persons: 1, centre },
    { date: future, time: '25:61', persons: 1, centre },
    { date: future, time: '10:00', persons: 11, centre }
  ]) assert.throws(() => validateAppointment(invalid));
});

test('payment results transition only pending bookings', () => {
  assert.equal(nextBookingStatus('PENDING', 'SUCCESS'), 'CONFIRMED');
  assert.equal(nextBookingStatus('PENDING', 'FAILED'), 'FAILED');
  for (const status of ['CONFIRMED', 'FAILED', 'CANCELLED']) assert.throws(() => nextBookingStatus(status, 'SUCCESS'), { code: 'INVALID_BOOKING_STATE' });
});

test('RapidAPI business response maps provider fields into the centre shape', () => {
  const centre = normalizeCentre({ business_id: 'clinic-1', name: 'Care Lab', full_address: 'Chennai', latitude: 13.08, longitude: 80.27, phone_number: '+91 9876543210' });
  assert.equal(centre.providerId, 'clinic-1'); assert.equal(centre.address, 'Chennai');
  assert.deepEqual(centre.location.coordinates, [80.27, 13.08]); assert.equal(centre.phone, '+91 9876543210');
});

test('RapidAPI provider IDs upsert a Mongo centre and return its Mongo _id', async () => {
  const providerCentre = { providerId: 'rapidapi-business-77', name: 'Lab', address: 'Chennai', tests: [{ testId: 'cbc', name: 'CBC', price: 400 }] };
  const mongoCentre = { ...providerCentre, _id: '507f191e810c19729de860ea' };
  let captured;
  const query = { select(fields) { captured.selected = fields; return this; }, lean() { return Promise.resolve(mongoCentre); } };
  const fakeModel = { findOneAndUpdate(filter, update, options) { captured = { filter, update, options }; return query; } };
  const saved = await upsertProviderCentre(providerCentre, fakeModel);
  assert.equal(captured.filter.providerId, providerCentre.providerId);
  assert.equal(captured.options.upsert, true); assert.equal(captured.options.new, true);
  assert.equal(captured.selected, '-providerPayload'); assert.equal(saved._id, mongoCentre._id);
  assert.equal(saved.tests[0].testId, 'cbc');
});

test('time validator accepts only 24-hour HH:mm', () => {
  assert.equal(isValidTime('07:00'), true); assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false); assert.equal(isValidTime('7:00'), false);
});
