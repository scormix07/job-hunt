import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { filters: [], jobs: {} };

let db = load();

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---- filters ----

export function listFilters() {
  return db.filters;
}

export function getFilter(id) {
  return db.filters.find((f) => f.id === id);
}

export function addFilter({ name, keywords, location, timeRange, workType }) {
  const filter = {
    id: crypto.randomUUID(),
    name: name?.trim() || keywords.trim(),
    keywords: keywords.trim(),
    location: location?.trim() || '',
    timeRange: timeRange || 'week',
    workType: workType || '',
    enabled: true,
    createdAt: new Date().toISOString(),
    lastScanAt: null,
    lastError: null,
  };
  db.filters.push(filter);
  save();
  return filter;
}

export function updateFilter(id, patch) {
  const filter = getFilter(id);
  if (!filter) return null;
  Object.assign(filter, patch);
  save();
  return filter;
}

export function deleteFilter(id) {
  db.filters = db.filters.filter((f) => f.id !== id);
  for (const [jobId, job] of Object.entries(db.jobs)) {
    job.filterIds = job.filterIds.filter((f) => f !== id);
    if (job.filterIds.length === 0 && job.status !== 'saved') delete db.jobs[jobId];
  }
  save();
}

// ---- jobs ----

export function listJobs({ filterId, status } = {}) {
  let jobs = Object.values(db.jobs);
  if (filterId) jobs = jobs.filter((j) => j.filterIds.includes(filterId));
  if (status) jobs = jobs.filter((j) => j.status === status);
  return jobs.sort(
    (a, b) => (b.postedAt || b.firstSeenAt).localeCompare(a.postedAt || a.firstSeenAt)
  );
}

/** Merge scan results in; returns the number of jobs not seen before. */
export function upsertJobs(filterId, scanned) {
  let newCount = 0;
  const now = new Date().toISOString();
  for (const job of scanned) {
    const existing = db.jobs[job.id];
    if (existing) {
      if (!existing.filterIds.includes(filterId)) existing.filterIds.push(filterId);
      // keep freshest metadata but never resurrect hidden/seen state
      Object.assign(existing, { title: job.title, company: job.company, url: job.url });
    } else {
      db.jobs[job.id] = {
        ...job,
        filterIds: [filterId],
        status: 'new',
        firstSeenAt: now,
      };
      newCount++;
    }
  }
  save();
  return newCount;
}

export function setJobStatus(id, status) {
  const job = db.jobs[id];
  if (!job) return null;
  job.status = status;
  save();
  return job;
}

export function markAllSeen(filterId) {
  for (const job of Object.values(db.jobs)) {
    if (job.status !== 'new') continue;
    if (filterId && !job.filterIds.includes(filterId)) continue;
    job.status = 'seen';
  }
  save();
}

export function counts() {
  const byFilter = {};
  let totalNew = 0;
  for (const job of Object.values(db.jobs)) {
    if (job.status !== 'new') continue;
    totalNew++;
    for (const fid of job.filterIds) byFilter[fid] = (byFilter[fid] || 0) + 1;
  }
  return { totalNew, byFilter };
}
