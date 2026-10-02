import { config } from '../config/env.js';

// Called only after a user selects a centre whose cached catalogue is incomplete.
export async function fetchCentreDetails(website) {
  if (!website || !config.firecrawlApiKey) return null;
  let response;
  try {
    const payload = {
      url: website,
      onlyMainContent: true,
      formats: ['json'],
      jsonOptions: {
        prompt: 'Extract the centre published openingTime and closingTime as 24-hour HH:mm values. List diagnostic tests and their numeric price in INR only when the website explicitly states both. Do not guess missing hours, tests, or prices.',
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            openingTime: { type: ['string', 'null'], description: 'Opening time in 24-hour HH:mm format, if listed.' },
            closingTime: { type: ['string', 'null'], description: 'Closing time in 24-hour HH:mm format, if listed.' },
            tests: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, price: { type: ['number', 'null'] } }, required: ['name', 'price'] } }
          }, required: ['openingTime', 'closingTime', 'tests']
        }
      }
    };
    response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.firecrawlApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'firecrawl', reason: error.name === 'TimeoutError' ? 'timeout' : 'network_error' }));
    return null;
  }
  if (!response.ok) {
    console.warn(JSON.stringify({ level: 'warn', service: 'firecrawl', status: response.status }));
    return null;
  }
  const body = await response.json();
  let result = body.data?.json || body.json || {};
  if (typeof result === 'string') { try { result = JSON.parse(result); } catch { result = {}; } }
  const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  return {
    openingTime: isTime(result.openingTime) ? result.openingTime : null,
    closingTime: isTime(result.closingTime) ? result.closingTime : null,
    tests: Array.isArray(result.tests) ? result.tests.filter((test) => typeof test.name === 'string' && test.name.trim() && Number.isFinite(test.price) && test.price >= 0).map((test) => ({ testId: test.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: test.name.trim(), price: Number(test.price), source: 'firecrawl' })) : []
  };
}
