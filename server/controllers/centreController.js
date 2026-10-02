import mongoose from 'mongoose';
import { z } from 'zod';
import { Centre } from '../models/Centre.js';
import { searchBusinesses } from '../services/rapidApiService.js';
import { fetchCentreDetails } from '../services/firecrawlService.js';
import { upsertProviderCentre } from '../services/centrePersistence.js';
import { AppError } from '../utils/AppError.js';

const idSchema = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid centre ID');
const latitudeSchema = z.string().regex(/^-?(?:\d+\.?\d*|\.\d+)$/).transform(Number).pipe(z.number().finite().min(-90).max(90));
const longitudeSchema = z.string().regex(/^-?(?:\d+\.?\d*|\.\d+)$/).transform(Number).pipe(z.number().finite().min(-180).max(180));
const searchSchema = z.object({
  q: z.string().trim().min(2).max(120).optional(),
  lat: latitudeSchema.optional(),
  lng: longitudeSchema.optional()
}).strict();

export async function searchCentres(req, res) {
  const input = searchSchema.parse(req.query);
  const hasCoordinates = input.lat !== undefined || input.lng !== undefined;
  if (hasCoordinates && (input.lat === undefined || input.lng === undefined || input.q !== undefined)) {
    throw new AppError(400, 'Provide both latitude and longitude without a text query.', 'INVALID_SEARCH');
  }
  if (!hasCoordinates && !input.q) throw new AppError(400, 'Enter a city, area, or centre name to search.', 'INVALID_SEARCH');
  const query = input.q || 'diagnostic centres';
  const coordinates = hasCoordinates ? { latitude: input.lat, longitude: input.lng } : undefined;
  const rawCentres = await searchBusinesses(query, coordinates);
  const centres = await Promise.all(rawCentres.map((raw) => upsertProviderCentre(raw)));
  res.json({ centres });
}

export async function getCentre(req, res) {
  const id = idSchema.parse(req.params.id);
  const centre = await Centre.findById(id);
  if (!centre) throw new AppError(404, 'Centre not found', 'CENTRE_NOT_FOUND');
  const stale = !centre.hoursFetchedAt || Date.now() - centre.hoursFetchedAt.getTime() > 24 * 60 * 60 * 1000;
  const missingTests = !centre.tests.length;
  if (centre.website && stale && (missingTests || centre.hoursSource !== 'provider')) {
    const details = await fetchCentreDetails(centre.website);
    if (details) {
      if (details.openingTime) centre.openingTime = details.openingTime;
      if (details.closingTime) centre.closingTime = details.closingTime;
      if (details.openingTime || details.closingTime) centre.hoursSource = 'firecrawl';
      if (details.tests.length) centre.tests = details.tests;
      centre.hoursFetchedAt = new Date(); await centre.save();
    }
  }
  res.json({ centre });
}
