import * as cheerio from 'cheerio';

const GUEST_API =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// LinkedIn time-posted filter values, keyed by our filter setting
const TIME_RANGES = {
  '24h': 'r86400',
  week: 'r604800',
  month: 'r2592000',
};

// Work-type filter: on-site 1, remote 2, hybrid 3
const WORK_TYPES = { onsite: '1', remote: '2', hybrid: '3' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl(filter, start) {
  const params = new URLSearchParams();
  params.set('keywords', filter.keywords);
  if (filter.location) params.set('location', filter.location);
  const tpr = TIME_RANGES[filter.timeRange];
  if (tpr) params.set('f_TPR', tpr);
  const wt = WORK_TYPES[filter.workType];
  if (wt) params.set('f_WT', wt);
  params.set('start', String(start));
  return `${GUEST_API}?${params}`;
}

function parseJobs(html) {
  const $ = cheerio.load(html);
  const jobs = [];
  $('li').each((_, el) => {
    const card = $(el).find('.base-card');
    const scope = card.length ? card : $(el);
    const urn = scope.attr('data-entity-urn') || '';
    const id = urn.split(':').pop();
    if (!id) return;
    const link = scope.find('a.base-card__full-link').attr('href') || '';
    jobs.push({
      id,
      title: scope.find('.base-search-card__title').text().trim(),
      company: scope.find('.base-search-card__subtitle').text().trim(),
      location: scope.find('.job-search-card__location').text().trim(),
      postedAt: scope.find('time').attr('datetime') || null,
      url: link.split('?')[0] || `https://www.linkedin.com/jobs/view/${id}`,
    });
  });
  return jobs;
}

/**
 * Fetch jobs for one filter from LinkedIn's public guest endpoint.
 * Pages through results (10 per page) up to maxPages, with a polite delay.
 * Returns { jobs, error } — a non-null error means the scan was cut short
 * (rate limit or network problem), not that the filter is broken.
 */
export async function searchJobs(filter, { maxPages = 3, delayMs = 1500 } = {}) {
  const all = new Map();
  let error = null;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(delayMs);
    let res;
    try {
      res = await fetch(buildUrl(filter, page * 10), {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      });
    } catch (err) {
      error = `network error: ${err.message}`;
      break;
    }
    if (res.status === 429) {
      error = 'rate limited by LinkedIn (will retry next scan)';
      break;
    }
    if (!res.ok) {
      error = `LinkedIn responded ${res.status}`;
      break;
    }
    const jobs = parseJobs(await res.text());
    if (jobs.length === 0) break; // no more results
    for (const job of jobs) all.set(job.id, job);
  }

  return { jobs: [...all.values()], error };
}
