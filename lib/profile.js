import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Your apply kit (headline / summary / cover letter) lives in
// data/profile.json (gitignored) — copy profile.example.json there
// and make it yours. Without it, these placeholders are shown.

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'profile.json'
);

const DEFAULTS = {
  headline: 'Your Job Title | Skill · Skill · Skill',
  summary:
    'A short first-person paragraph about who you are, what you do day to day, and what you want next. Copy profile.example.json to data/profile.json and edit it to fill this in.',
  coverLetter:
    'Dear hiring team,\n\nYour cover letter goes here — copy profile.example.json to data/profile.json and edit it.\n\nRegards,\nYour Name',
};

export function getProfile() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return DEFAULTS;
  }
}
