import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Personal presets live in data/presets.json (gitignored) — copy
// presets.example.json there and edit it to match your own CV/targets.
// Without that file, these generic defaults are used.

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'presets.json'
);

const DEFAULTS = {
  location: 'Remote',
  jobTitles: [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'DevOps Engineer',
    'Data Analyst',
  ],
  keywords: [
    'JavaScript',
    'TypeScript',
    'React',
    'Node.js',
    'Python',
    'AWS',
    'Docker',
  ],
};

export function getPresets() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return DEFAULTS;
  }
}
