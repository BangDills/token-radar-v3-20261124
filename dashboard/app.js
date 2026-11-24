/* Token Radar board: sortable table, filters, live tab, drawer, hash routes. No network. */
(function () {
'use strict';
var D = window.RADAR;
if (!D) return;
var P = window.RadarPanels;
var app = document.getElementById('board');
var st = { q: '', cat: 'all', chain: 'all', odds: 'all', tab: 'pre', sort: 'rank', dir: 1, sel: null };
function rows() { return D.rows || []; }
function oddsBand(o) { return o >= 0.5 ? 'hi' : o >= 0.3 ? 'mid' : 'lo'; }
function filtered() {
  var q = st.q.trim().toLowerCase();
  return rows().filter(function (r) {
    if (st.cat !== 'all' && (r.category || 'Other') !== st.cat) return false;
    if (st.chain !== 'all' && !(r.chains || []).includes(st.chain)) return false;
    if (st.odds !== 'all' && oddsBand(r.launch_odds) !== st.odds) return false;
    if (!q) return true;
    return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
  });
}
function sorted(list) {
  var k = st.sort, d = st.dir;
  return list.slice().sort(function (a, b) {
    var av, bv;
    if (k === 'rank') { av = a.rank; bv = b.rank; }
    else if (k === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    else if (k === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
    else if (k === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
    else if (k === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
    else if (k === 'odds') { av = a.launch_odds; bv = b.launch_odds; }
    else { av = a.implied_value_usd; bv = b.implied_value_usd; }
    if (av < bv) return -d;
    if (av > bv) return d;
    return a.slug < b.slug ? -1 : 1;
  });
}
function sh(key, label) {
  return P.el('th', { scope: 'col' },
    P.el('button', { type: 'button', onclick: function () {
      if (st.sort === key) st.dir = -st.dir;
      else { st.sort = key; st.dir = key === 'name' ? 1 : -1; }
      render();
    } }, label, st.sort === key ? P.el('span', { text: st.dir < 0 ? ' v' : ' ^' }) : null));
}
function opt(v, t, cur) {
  return P.el('option', cur ? { value: v, text: t, selected: 'selected' } : { value: v, text: t });
}
function controls() {
  var cats = Array.from(new Set(rows().map(function (r) { return r.category || 'Other'; }))).sort();
  var chains = Array.from(new Set(rows().reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
  var q = P.el('input', { type: 'search', id: 'q', placeholder: 'Search protocol or chain', value: st.q, 'aria-label': 'Search the board' });
  q.addEventListener('input', function () { st.q = q.value; writeHash(); render(); });
  var c = P.el('select', { id: 'cat', 'aria-label': 'Filter by category' },
    opt('all', 'All categories', st.cat === 'all'),
    cats.map(function (x) { return opt(x, x, st.cat === x); }));
  c.addEventListener('change', function () { st.cat = c.value; writeHash(); render(); });
  var h = P.el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
    opt('all', 'All chains', st.chain === 'all'),
    chains.map(function (x) { return opt(x, x, st.chain === x); }));
  h.addEventListener('change', function () { st.chain = h.value; writeHash(); render(); });
  var o = P.el('select', { id: 'odds', 'aria-label': 'Filter by launch odds' },
    opt('all', 'Any odds', st.odds === 'all'),
    opt('hi', 'High 50%+', st.odds === 'hi'),
    opt('mid', 'Mid 30-50%', st.odds === 'mid'),
    opt('lo', 'Low under 30%', st.odds === 'lo'));
  o.addEventListener('change', function () { st.odds = o.value; writeHash(); render(); });
  var pre = P.el('button', { type: 'button', 'aria-pressed': st.tab === 'pre' ? 'true' : 'false', text: 'Pre-token (' + rows().length + ')', onclick: function () { st.tab = 'pre'; render(); } });
  var liv = P.el('button', { type: 'button', 'aria-pressed': st.tab === 'live' ? 'true' : 'false', text: 'Live comps (' + (D.live || []).length + ')', onclick: function () { st.tab = 'live'; render(); } });
  return P.el('div', { class: 'controls' },
    P.el('div', { class: 'field' }, P.el('label', { for: 'q', text: 'Search' }), q),
    P.el('div', { class: 'field' }, P.el('label', { for: 'cat', text: 'Category' }), c),
    P.el('div', { class: 'field' }, P.el('label', { for: 'chain', text: 'Chain' }), h),
    P.el('div', { class: 'field' }, P.el('label', { for: 'odds', text: 'Launch odds' }), o),
    P.el('div', { class: 'field' }, P.el('span', { text: 'Token status' }), P.el('div', { class: 'tabs' }, pre, liv)),
    P.el('span', { class: 'count', text: st.tab === 'pre' ? filtered().length + ' rows shown' : (D.live || []).length + ' live-token comps' }));
}
function boardTable() {
  var list = sorted(filtered());
  if (!list.length) {
    return P.el('div', { class: 'panel' }, P.el('div', { class: 'empty' },
      P.el('h2', { text: 'No protocol matches that filter' }),
      P.el('p', { text: 'Clear the search or pick another category to see the board again.' }),
      P.el('button', { class: 'btn pri', type: 'button', text: 'Clear filters', onclick: function () { st.q = ''; st.cat = 'all'; st.chain = 'all'; st.odds = 'all'; writeHash(); render(); } })));
  }
  var max = 0;
  list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
  if (!max) max = 1;
  var tb = P.el('tbody');
  list.forEach(function (r) {
    var g = r.change_7d === null ? 'n/a' : P.pct(r.change_7d);
    var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
    var w = Math.max(3, Math.round((r.implied_value_usd / max) * 100));
    tb.appendChild(P.el('tr', {
      'data-sel': st.sel === r.slug ? 'true' : 'false', tabindex: '0',
      onclick: function () { openRow(r.slug); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(r.slug); } }
    },
      P.el('td', { class: 'rk', text: String(r.rank) }),
      P.el('td', null, P.el('div', { class: 'nm' }, P.el('b', { text: r.name }),
        P.el('span', { text: (r.category || 'Other') + ' on ' + ((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') }))),
      P.el('td', { class: 'num', text: P.usd(r.tvl_usd) }),
      P.el('td', { class: 'num ' + gc, text: g }),
      P.el('td', { class: 'num', text: P.age(r.age_days) }),
      P.el('td', null, P.el('span', { class: 'band', 'aria-hidden': 'true' }, P.el('i', { style: 'width:' + w + '%' })), P.el('span', { class: 'num', text: P.usd(r.implied_value_usd) })),
      P.el('td', null, P.el('span', { class: 'odds ' + P.ocls(r.launch_odds), text: P.odds(r.launch_odds) })),
      P.el('td', null, P.el('span', { class: 'st', text: 'no token' }))));
  });
  return P.el('div', { class: 'panel' }, P.el('div', { class: 'twrap' },
    P.el('table', null,
      P.el('caption', { class: 'st', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
      P.el('thead', null, P.el('tr', null,
        sh('rank', 'Rank'), sh('name', 'Protocol'), sh('tvl', 'TVL'), sh('growth', '7d'),
        sh('age', 'Age'), sh('implied', 'Implied value'), sh('odds', 'Odds'), P.el('th', { scope: 'col', text: 'Token' }))),
      tb)));
}
function liveTable() {
  var tb = P.el('tbody');
  (D.live || []).forEach(function (r) {
    tb.appendChild(P.el('tr', null,
      P.el('td', { class: 'rk', text: 'live' }),
      P.el('td', null, P.el('div', { class: 'nm' }, P.el('b', { text: r.name }),
        P.el('span', { text: (r.category || 'Other') + ' on ' + ((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') }))),
      P.el('td', { class: 'num', text: P.usd(r.tvl_usd) }),
      P.el('td', { class: 'num', text: P.pct(r.change_7d) }),
      P.el('td', { class: 'num', text: P.usd(r.mcap_usd) }),
      P.el('td', null, P.el('span', { class: 'st', text: 'already trades' }))));
  });
  return P.el('div', { class: 'panel' }, P.el('div', { class: 'twrap' },
    P.el('table', null,
      P.el('caption', { class: 'st', text: 'The fit set: live-token protocols whose market caps price the pre-token board.' }),
      P.el('thead', null, P.el('tr', null,
        P.el('th', { scope: 'col', text: 'Status' }), P.el('th', { scope: 'col', text: 'Protocol' }),
        P.el('th', { scope: 'col', text: 'TVL' }), P.el('th', { scope: 'col', text: '7d' }),
        P.el('th', { scope: 'col', text: 'Market cap' }), P.el('th', { scope: 'col', text: 'Token' }))),
      tb)));
}
var drw = null;
function openRow(slug) {
  var row = rows().filter(function (r) { return r.slug === slug; })[0];
  if (!row) return;
  st.sel = slug;
  writeHash();
  closeDrawer();
  drw = P.drawer(row, D);
  var x = drw.querySelector('.x');
  if (x) x.addEventListener('click', function () { st.sel = null; writeHash(); render(); });
  app.appendChild(drw);
  render(true);
}
function closeDrawer() { if (drw && drw.parentNode) drw.parentNode.removeChild(drw); drw = null; }
function readHash() {
  var h = window.location.hash.replace(/^#/, '');
  if (!h) return;
  if (h.indexOf('/protocol/') === 0) { st.sel = decodeURIComponent(h.slice(10).split('?')[0]); return; }
  var qm = h.indexOf('?');
  var ps = new URLSearchParams(qm >= 0 ? h.slice(qm + 1) : h);
  if (ps.get('q')) st.q = ps.get('q');
  if (ps.get('category')) st.cat = ps.get('category');
  if (ps.get('chain')) st.chain = ps.get('chain');
  if (ps.get('odds')) st.odds = ps.get('odds');
  if (ps.get('tab')) st.tab = ps.get('tab');
  if (ps.get('p')) st.sel = ps.get('p');
}
function writeHash() {
  var next;
  if (st.sel) { next = '#/protocol/' + encodeURIComponent(st.sel); }
  else {
    var ps = new URLSearchParams();
    if (st.q) ps.set('q', st.q);
    if (st.cat !== 'all') ps.set('category', st.cat);
    if (st.chain !== 'all') ps.set('chain', st.chain);
    if (st.odds !== 'all') ps.set('odds', st.odds);
    if (st.tab !== 'pre') ps.set('tab', st.tab);
    var s = ps.toString();
    next = s ? '#/?' + s : window.location.pathname + window.location.search;
  }
  window.history.replaceState(null, '', next);
}
function render(keep) {
  closeDrawerOnly();
  app.textContent = '';
  var shell = P.el('div', { class: 'shell' });
  shell.appendChild(P.el('header', { class: 'top' },
    P.el('div', { class: 'brand' }, P.el('span', { class: 'pulse' }), P.el('span', { text: 'TOKEN RADAR' })),
    P.el('span', { class: 'tag', text: (D.model_version || 'radar') + ' fitted comps' }),
    P.el('div', { class: 'meta' },
      P.el('span', { text: 'Snapshot ' + D.as_of }),
      P.el('span', { text: 'DefiLlama index' }))));
  shell.appendChild(P.strip(D));
  shell.appendChild(P.el('div', { class: 'hero' },
    P.el('div', null,
      P.el('h1', { text: D.watchlist_size + ' watchlist protocols, ranked by fitted implied value' }),
      P.el('p', { text: 'The watchlist is the floor; the early radar adds ' + D.early_size + ' pre-token protocols below it. Every multiple is fit from ' + ((D.fit || {}).comps_n || 0) + ' live-token comps. An implied value is a model, not a price.' }))));
  shell.appendChild(P.kpis(D));
  shell.appendChild(P.modelCards(D));
  shell.appendChild(controls());
  shell.appendChild(st.tab === 'pre' ? boardTable() : liveTable());
  shell.appendChild(P.el('p', { class: 'note', text: 'Board covers every watchlist slug; rows beyond it are the early radar. Live-token protocols are set aside with market caps shown.' }));
  app.appendChild(shell);
  app.setAttribute('aria-busy', 'false');
  if (st.sel && !keep) {
    var row = rows().filter(function (r) { return r.slug === st.sel; })[0];
    if (row) {
      drw = P.drawer(row, D);
      var x = drw.querySelector('.x');
      if (x) x.addEventListener('click', function () { st.sel = null; writeHash(); render(); });
      app.appendChild(drw);
    } else st.sel = null;
  } else if (st.sel && keep && drw) app.appendChild(drw);
}
function closeDrawerOnly() { if (drw && drw.parentNode) drw.parentNode.removeChild(drw); }
window.addEventListener('hashchange', function () {
  var keepSel = st.sel;
  st.q = ''; st.cat = 'all'; st.chain = 'all'; st.odds = 'all'; st.tab = 'pre'; st.sel = null;
  readHash();
  if (!st.sel && keepSel && !window.location.hash) st.sel = null;
  render();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && drw) { st.sel = null; writeHash(); render(); }
});
readHash();
render();
})();
