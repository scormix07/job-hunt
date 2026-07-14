import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './lib/store.js';
import { searchJobs } from './lib/linkedin.js';
import { getPresets } from './lib/presets.js';
import { getProfile } from './lib/profile.js';

const PORT = process.env.PORT || 3344;
const SCAN_INTERVAL_MIN = Number(process.env.SCAN_INTERVAL_MIN || 30);

const app = express();
app.use(express.json());
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')));

// ---- scanning ----

let scanning = false;

async function scanFilter(filter) {
  const { jobs, error } = await searchJobs(filter);
  const newCount = store.upsertJobs(filter.id, jobs);
  store.updateFilter(filter.id, {
    lastScanAt: new Date().toISOString(),
    lastError: error,
  });
  console.log(
    `[scan] ${filter.name}: ${jobs.length} results, ${newCount} new${error ? ` (${error})` : ''}`
  );
  return { filterId: filter.id, results: jobs.length, new: newCount, error };
}

async function scanAll() {
  if (scanning) return null;
  scanning = true;
  try {
    const results = [];
    for (const filter of store.listFilters().filter((f) => f.enabled)) {
      results.push(await scanFilter(filter));
    }
    return results;
  } finally {
    scanning = false;
  }
}

// ---- API ----

app.get('/api/presets', (req, res) => res.json(getPresets()));

app.get('/api/profile', (req, res) => res.json(getProfile()));

app.get('/api/filters', (req, res) => res.json(store.listFilters()));

app.post('/api/filters', async (req, res) => {
  const { keywords } = req.body;
  if (!keywords?.trim()) return res.status(400).json({ error: 'keywords required' });
  const filter = store.addFilter(req.body);
  res.status(201).json(filter);
  scanFilter(filter).catch((err) => console.error('[scan]', err)); // first scan right away
});

app.patch('/api/filters/:id', (req, res) => {
  const filter = store.updateFilter(req.params.id, req.body);
  if (!filter) return res.status(404).json({ error: 'not found' });
  res.json(filter);
});

app.delete('/api/filters/:id', (req, res) => {
  store.deleteFilter(req.params.id);
  res.status(204).end();
});

app.get('/api/jobs', (req, res) => {
  res.json(store.listJobs({ filterId: req.query.filter, status: req.query.status }));
});

app.post('/api/jobs/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['new', 'seen', 'saved', 'hidden'].includes(status)) {
    return res.status(400).json({ error: 'bad status' });
  }
  const job = store.setJobStatus(req.params.id, status);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

app.post('/api/jobs/mark-seen', (req, res) => {
  store.markAllSeen(req.body?.filterId);
  res.json({ ok: true });
});

app.get('/api/counts', (req, res) => res.json({ ...store.counts(), scanning }));

app.post('/api/scan', async (req, res) => {
  const results = await scanAll();
  if (!results) return res.status(409).json({ error: 'scan already running' });
  res.json(results);
});

// ---- start ----

app.listen(PORT, () => {
  console.log(`job-hunt running at http://localhost:${PORT}`);
  console.log(`[scan] auto-scan every ${SCAN_INTERVAL_MIN} min`);
  scanAll().catch((err) => console.error('[scan]', err));
  setInterval(() => scanAll().catch((err) => console.error('[scan]', err)), SCAN_INTERVAL_MIN * 60_000);
});
