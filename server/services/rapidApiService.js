import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

function pick(value, alternatives, fallback = '') {
  for (const key of alternatives) if (value?.[key] != null && value[key] !== '') return value[key];
  return fallback;
}

export function normalizeCentre(raw) {
  const coordinates = raw?.coordinates || raw?.geometry?.coordinates || raw?.location?.coordinates || (raw?.longitude != null && raw?.latitude != null ? [raw.longitude, raw.latitude] : null);
  return {
    providerId: String(pick(raw, ['id', 'place_id', 'business_id', 'uuid'], '')),
    name: String(pick(raw, ['name', 'business_name', 'title'], 'Diagnostic centre')),
    address: String(pick(raw, ['address', 'full_address', 'formatted_address', 'vicinity'], 'Address unavailable')),
    city: String(pick(raw, ['city', 'locality'], '')),
    phone: String(pick(raw, ['phone', 'phone_number', 'telephone'], '')),
    website: String(pick(raw, ['website', 'url', 'domain'], '')),
    location: Array.isArray(coordinates) && coordinates.length >= 2 ? { type: 'Point', coordinates: coordinates.slice(0, 2).map(Number) } : undefined,
    openingTime: String(pick(raw, ['opening_time', 'opens_at'], '07:00')),
    closingTime: String(pick(raw, ['closing_time', 'closes_at'], '20:00')),
    hoursSource: raw?.closing_time || raw?.closes_at ? 'provider' : 'default',
    tests: Array.isArray(raw?.tests) ? raw.tests.map((t) => ({ testId: String(t.id || t.name), name: String(t.name || t.testName), price: Number(t.price || 0), source: 'provider' })) : [],
    providerPayload: raw
  };
}

export async function searchBusinesses(query, coordinates) {
  const searchTerm = /diagnostic|clinic|pathology|laboratory/i.test(query) ? query.trim() : `diagnostic centres in ${query.trim()}`;
  const key = searchTerm.toLowerCase();
  // Origin coordinates are personal data. Do not cache or retain current-location searches.
  if (!coordinates) {
    const existing = cache.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
  }
  if (!config.rapidApiKey || !config.rapidApiHost || !config.rapidApiBaseUrl) {
    throw new AppError(503, 'Clinic search is not configured', 'PROVIDER_NOT_CONFIGURED');
  }
  const url = new URL(config.rapidApiBaseUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/search`;
  url.searchParams.set('query', searchTerm);
  url.searchParams.set('region', 'in');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', '20');
  if (coordinates) {
    url.searchParams.set('lat', String(coordinates.latitude));
    url.searchParams.set('lng', String(coordinates.longitude));
  }
  let response;
  try {
    response = await fetch(url, { headers: { 'x-rapidapi-key': config.rapidApiKey, 'x-rapidapi-host': config.rapidApiHost }, signal: AbortSignal.timeout(12000) });
  } catch { throw new AppError(502, 'Clinic search provider could not be reached', 'PROVIDER_ERROR'); }
  if (!response.ok) throw new AppError(502, 'Clinic search provider is unavailable', 'PROVIDER_ERROR');
  const data = await response.json();
  const rows = Array.isArray(data) ? data : (data.results || data.data || data.businesses || []);
  const value = rows.map(normalizeCentre);
  if (!coordinates) cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export function clearProviderCache() { cache.clear(); }
