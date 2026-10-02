import mongoose from 'mongoose';

const offeredTestSchema = new mongoose.Schema({
  testId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  source: { type: String, enum: ['provider', 'firecrawl', 'catalogue'], default: 'catalogue' }
}, { _id: false });

const centreSchema = new mongoose.Schema({
  providerId: { type: String, index: true, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, default: '' },
  phone: { type: String, default: '' },
  website: { type: String, default: '' },
  location: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number], default: undefined } },
  openingTime: { type: String, default: '07:00' },
  closingTime: { type: String, default: '20:00' },
  hoursSource: { type: String, enum: ['provider', 'firecrawl', 'default'], default: 'default' },
  hoursFetchedAt: { type: Date, default: null },
  tests: { type: [offeredTestSchema], default: [] },
  providerPayload: { type: mongoose.Schema.Types.Mixed, select: false }
}, { timestamps: true });

centreSchema.index({ location: '2dsphere' });
centreSchema.index({ name: 'text', address: 'text', city: 'text' });

export const Centre = mongoose.model('Centre', centreSchema);
