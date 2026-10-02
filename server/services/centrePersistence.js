import { Centre } from '../models/Centre.js';

export async function upsertProviderCentre(rawCentre, CentreModel = Centre) {
  if (!rawCentre.providerId) return rawCentre;
  const filter = { providerId: String(rawCentre.providerId) };
  const query = () => CentreModel.findOneAndUpdate(filter, { $set: rawCentre }, { upsert: true, new: true, setDefaultsOnInsert: true });
  try {
    return await query().select('-providerPayload').lean();
  } catch (error) {
    // A simultaneous first search may win the unique providerId insert race.
    if (error?.code !== 11000) throw error;
    return await CentreModel.findOne(filter).select('-providerPayload').lean();
  }
}
