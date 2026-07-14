const state = {
  filters: [],
  jobs: [],
  activeFilter: null, // filter id or null = all
  activeTab: 'new',   // '', 'new', 'saved', 'hidden'
  counts: { totalNew: 0, byFilter: {} },
  presets: { location: '', jobTitles: [], keywords: [] },
  profile: null,
  showKit: false,
};

const $ = (sel) => document.querySelector(sel);

const api = async (path, opts) => {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok && res.status !== 409) throw new Error(`${path}: ${res.status}`);
  return res.status === 204 ? null : res.json();
};

async function refresh() {
  const params = new URLSearchParams();
  if (state.activeFilter) params.set('filter', state.activeFilter);
  if (state.activeTab) params.set('status', state.activeTab);
  [state.filters, state.jobs, state.counts] = await Promise.all([
    api('filters'),
    api(`jobs?${params}`),
    api('counts'),
  ]);
  render();
}

// ---- rendering ----

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function timeAgo(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function render() {
  // tab badge
  $('#new-count').textContent = state.counts.totalNew || '';

  // preset chips (green when a matching filter already exists)
  const existing = new Set(state.filters.map((f) => f.keywords.toLowerCase()));
  const chipHtml = (kw) => {
    const added = existing.has(kw.toLowerCase());
    return `<button class="chip ${added ? 'added' : ''}" data-preset="${esc(kw)}" ${added ? 'disabled' : ''} title="${added ? 'Already monitoring' : 'Add filter'}">${added ? '✓ ' : '+ '}${esc(kw)}</button>`;
  };
  $('#preset-titles').innerHTML = state.presets.jobTitles.map(chipHtml).join('');
  $('#preset-keywords').innerHTML = state.presets.keywords.map(chipHtml).join('');

  // filter list
  $('#filter-list').innerHTML = [
    filterItemHtml({ id: null, name: 'All filters' }, !state.activeFilter),
    ...state.filters.map((f) => filterItemHtml(f, state.activeFilter === f.id)),
  ].join('');

  // job list
  const list = $('#job-list');
  if (state.jobs.length === 0) {
    list.innerHTML = `<div class="empty">No ${state.activeTab || ''} jobs here. Add a filter or hit “Scan now”.</div>`;
  } else {
    list.innerHTML = state.jobs.map(jobHtml).join('');
  }

  const active = state.filters.find((f) => f.id === state.activeFilter);
  const scanned = active?.lastScanAt || state.filters.map((f) => f.lastScanAt).filter(Boolean).sort().pop();
  $('#status-line').textContent =
    `${state.jobs.length} job${state.jobs.length === 1 ? '' : 's'}` +
    (scanned ? ` · last scan ${new Date(scanned).toLocaleTimeString()}` : '') +
    (active?.lastError ? ` · ${active.lastError}` : '');
}

function filterItemHtml(f, active) {
  const count = f.id ? state.counts.byFilter[f.id] || '' : '';
  const meta = f.id
    ? `${esc(f.location || 'anywhere')} · ${f.timeRange}${f.workType ? ' · ' + f.workType : ''}${f.lastError ? ' <span class="err">!</span>' : ''}`
    : '';
  return `
    <div class="filter-item ${active ? 'active' : ''} ${f.enabled === false ? 'disabled' : ''}" data-id="${f.id ?? ''}">
      <span class="name">${esc(f.name)}${meta ? `<span class="meta">${meta}</span>` : ''}</span>
      <span class="badge">${count}</span>
      ${f.id ? `<button class="del" data-del="${f.id}" title="Delete filter">✕</button>` : ''}
    </div>`;
}

function jobHtml(j) {
  return `
    <div class="job ${j.status}" data-id="${j.id}">
      <div class="body">
        <a class="title" href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>
        <div class="sub">${esc(j.company)} · ${esc(j.location)} · posted ${timeAgo(j.postedAt)}</div>
      </div>
      <div class="actions">
        ${j.status !== 'saved' ? `<button data-act="saved" title="Save">★</button>` : `<button data-act="seen" title="Unsave">★</button>`}
        ${j.status === 'new' ? `<button data-act="seen" title="Mark seen">✓</button>` : ''}
        ${j.status !== 'hidden' ? `<button data-act="hidden" title="Hide">✕</button>` : `<button data-act="seen" title="Unhide">Unhide</button>`}
      </div>
    </div>`;
}

// ---- events ----

$('#add-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.add-tab');
  if (!tab) return;
  document.querySelectorAll('.add-tab').forEach((t) => t.classList.toggle('active', t === tab));
  $('#panel-presets').hidden = tab.dataset.panel !== 'presets';
  $('#filter-form').hidden = tab.dataset.panel !== 'custom';
});

$('#panel-presets').addEventListener('click', async (e) => {
  const chip = e.target.closest('.chip:not(.added)');
  if (!chip) return;
  chip.disabled = true;
  await api('filters', {
    method: 'POST',
    body: JSON.stringify({
      keywords: chip.dataset.preset,
      location: state.presets.location,
      timeRange: 'week',
    }),
  });
  await refresh();
  setTimeout(refresh, 6000); // pick up the initial scan's results
});

$('#filter-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  await api('filters', { method: 'POST', body: JSON.stringify(data) });
  e.target.reset();
  await refresh();
  setTimeout(refresh, 6000); // pick up the initial scan's results
});

$('#filter-list').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    if (!confirm('Delete this filter? Its unsaved jobs go too.')) return;
    await api(`filters/${del.dataset.del}`, { method: 'DELETE' });
    if (state.activeFilter === del.dataset.del) state.activeFilter = null;
    return refresh();
  }
  const item = e.target.closest('.filter-item');
  if (item) {
    state.activeFilter = item.dataset.id || null;
    refresh();
  }
});

$('#tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  state.activeTab = tab.dataset.status;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
  refresh();
});

$('#job-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.job').dataset.id;
  await api(`jobs/${id}/status`, { method: 'POST', body: JSON.stringify({ status: btn.dataset.act }) });
  refresh();
});

$('#apply-kit-btn').addEventListener('click', async () => {
  if (!state.profile) {
    state.profile = await api('profile');
    for (const key of ['headline', 'summary', 'coverLetter']) {
      $(`#kit-${key}`).textContent = state.profile[key];
    }
  }
  state.showKit = !state.showKit;
  $('#apply-kit').hidden = !state.showKit;
  $('#job-list').hidden = state.showKit;
  $('#apply-kit-btn').classList.toggle('active', state.showKit);
});

$('#apply-kit').addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  await navigator.clipboard.writeText(state.profile[btn.dataset.copy]);
  btn.textContent = 'Copied ✓';
  setTimeout(() => (btn.textContent = 'Copy'), 1500);
});

$('#mark-seen-btn').addEventListener('click', async () => {
  await api('jobs/mark-seen', { method: 'POST', body: JSON.stringify({ filterId: state.activeFilter }) });
  refresh();
});

$('#scan-btn').addEventListener('click', async () => {
  const btn = $('#scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanning…';
  try {
    await api('scan', { method: 'POST' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan now';
    refresh();
  }
});

api('presets').then((p) => {
  state.presets = p;
  $('#preset-location').textContent = p.location;
  $('#filter-form [name=location]').value = p.location;
  refresh();
});
setInterval(refresh, 60_000);
