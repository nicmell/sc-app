import init, { ugenRegistryJson } from './pkg/scsynthdef_compiler.js';

const RATE_LABEL = { 0: 'ir', 1: 'kr', 2: 'ar' };

async function main() {
  try {
    await init();
  } catch (e) {
    const loading = document.getElementById('loading');
    loading.textContent =
      'Could not load the WebAssembly bundle. Run `yarn build:wasm` in this folder first.';
    loading.classList.add('error');
    console.error(e);
    return;
  }

  const data = JSON.parse(ugenRegistryJson());
  render(data);
}

function render(data) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  const counts = document.getElementById('counts');

  sidebar.innerHTML = '';
  content.innerHTML = '';

  let total = 0;
  for (const [category, entries] of data) total += entries.length;
  counts.textContent = `${total} UGens across ${data.length} categories.`;

  for (const [category, entries] of data) {
    const navLink = document.createElement('a');
    navLink.href = `#cat-${category}`;
    navLink.textContent = `${category} (${entries.length})`;
    sidebar.appendChild(navLink);

    const section = document.createElement('section');
    section.id = `cat-${category}`;
    section.className = 'category';
    section.dataset.category = category;

    const heading = document.createElement('h2');
    heading.textContent = category;
    section.appendChild(heading);

    for (const entry of entries) {
      section.appendChild(renderUgen(entry));
    }

    content.appendChild(section);
  }

  wireFilter(content);
}

function renderUgen(entry) {
  const card = document.createElement('article');
  card.className = 'ugen';
  card.dataset.name = entry.name.toLowerCase();

  const title = document.createElement('h3');
  title.textContent = entry.name;
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';

  for (const rate of entry.rates ?? []) {
    const badge = document.createElement('span');
    badge.className = `rate rate-${RATE_LABEL[rate]}`;
    badge.textContent = RATE_LABEL[rate];
    meta.appendChild(badge);
  }

  if (entry.numOutputs != null) {
    const outs = document.createElement('span');
    outs.className = 'outputs';
    const word = entry.numOutputs === 1 ? 'output' : 'outputs';
    outs.textContent = `${entry.numOutputs} ${word}`;
    meta.appendChild(outs);
  }

  if (entry.extends) {
    const ext = document.createElement('span');
    ext.className = 'extends';
    ext.textContent = `extends ${entry.extends}`;
    meta.appendChild(ext);
  }

  card.appendChild(meta);

  if (entry.summary) {
    const summary = document.createElement('p');
    summary.className = 'summary';
    summary.textContent = entry.summary;
    card.appendChild(summary);
  }

  if (entry.doc && entry.doc !== entry.summary) {
    const doc = document.createElement('p');
    doc.className = 'doc';
    doc.textContent = entry.doc;
    card.appendChild(doc);
  }

  if (entry.signalRange) {
    const sr = document.createElement('p');
    sr.className = 'signal-range';
    sr.innerHTML = `<strong>Signal range:</strong> ${escapeHtml(entry.signalRange)}`;
    card.appendChild(sr);
  }

  if (entry.defaults?.length > 0) {
    card.appendChild(renderArgsTable(entry));
  }

  return card;
}

function renderArgsTable(entry) {
  const argDocs = new Map((entry.argDocs ?? []).map(([k, v]) => [k, v]));

  const table = document.createElement('table');
  table.className = 'args';
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>arg</th><th>default</th><th>doc</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  for (const [argName, defVal] of entry.defaults) {
    const row = document.createElement('tr');
    const n = document.createElement('td');
    n.className = 'arg-name';
    n.textContent = argName;
    const d = document.createElement('td');
    d.className = 'arg-default';
    d.textContent = defVal == null ? '—' : String(defVal);
    const doc = document.createElement('td');
    doc.className = 'arg-doc';
    doc.textContent = argDocs.get(argName) ?? '';
    row.append(n, d, doc);
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  return table;
}

function wireFilter(content) {
  const input = document.getElementById('filter');
  input.addEventListener('input', () => {
    const needle = input.value.trim().toLowerCase();
    for (const section of content.querySelectorAll('section.category')) {
      let visibleInSection = 0;
      for (const card of section.querySelectorAll('article.ugen')) {
        const hit = needle === '' || card.dataset.name.includes(needle);
        card.hidden = !hit;
        if (hit) visibleInSection++;
      }
      section.hidden = visibleInSection === 0;
    }
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

main();
