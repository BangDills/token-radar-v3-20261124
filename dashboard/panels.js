/* Radar panels: integrity strip, KPI cards, model cards, detail drawer. Pure DOM, no network. */
(function () {
'use strict';
function el(t, a) {
  var n = document.createElement(t);
  if (a) for (var k in a) {
    if (a[k] === null || a[k] === undefined) continue;
    if (k === 'text') n.textContent = a[k];
    else if (k === 'html') n.innerHTML = a[k];
    else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), a[k]);
    else n.setAttribute(k, a[k]);
  }
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    if (c === null || c === undefined) continue;
    if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
    else if (typeof c === 'string') n.appendChild(document.createTextNode(c));
    else n.appendChild(c);
  }
  return n;
}
function usd(n) {
  if (n === null || n === undefined || !isFinite(n)) return 'n/a';
  var a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}
function pct(n) {
  if (n === null || n === undefined || !isFinite(n)) return 'n/a';
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}
function age(d) {
  if (d === null || d === undefined) return 'unknown';
  if (d >= 365) return (d / 365).toFixed(1) + 'y';
  return Math.max(0, Math.round(d)) + 'd';
}
function m4(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : Number(n).toFixed(4); }
function m5(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : Number(n).toFixed(5); }
function odds(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n * 100).toFixed(1) + '%'; }
function ocls(n) { return n >= 0.5 ? 'o-hi' : n >= 0.3 ? 'o-mid' : 'o-lo'; }
function splitStep(s) {
  var at = String(s).indexOf(' Cost: ');
  if (at < 0) return { act: String(s), ct: '' };
  return { act: String(s).slice(0, at), ct: String(s).slice(at + 1) };
}
function rowsOf(D) { return (D && D.rows) || []; }
function sortedOk(D) {
  var r = rowsOf(D);
  for (var i = 1; i < r.length; i++) if (r[i].implied_value_usd > r[i - 1].implied_value_usd) return false;
  for (var j = 0; j < r.length; j++) if (r[j].rank !== j + 1) return false;
  return r.length > 0;
}
function plansOk(D) {
  var r = rowsOf(D);
  if (!r.length) return false;
  return r.every(function (x) {
    var s = x.farm_steps || [];
    if (s.length < 3 || s.length > 12) return false;
    return s.every(function (t) { return t.length >= 20 && t.length <= 600 && t.indexOf('Cost:') >= 0 && t.indexOf('Time:') >= 0; });
  });
}
function heldOk(D) {
  if (!D || !D.validation) return false;
  var l = D.validation.loo, w = D.validation.walk_forward;
  return l && w && l.fitted_male <= l.naive_male && w.fitted_male <= w.naive_male;
}
function strip(D) {
  var w = (D && D.watchlist_size) || 0;
  var s = el('div', { class: 'strip' },
    el('span', null, 'WATCHLIST ', el('b', null, w + '/' + w)),
    el('span', null, 'SORTED ', sortedOk(D) ? el('b', null, 'PASS') : el('b', { class: 'warn' }, 'FAIL')),
    el('span', null, 'PLANS ', plansOk(D) ? el('b', null, rowsOf(D).length + ' COSTED') : el('b', { class: 'warn' }, 'CHECK')),
    el('span', null, 'HELD-OUT ', heldOk(D) ? el('b', null, 'LOO+WF WIN') : el('b', { class: 'warn' }, 'SEE CARD')));
  return s;
}
function kpi(label, val, sub) {
  return el('div', { class: 'kpi' }, el('span', { text: label }), el('b', { text: val }), el('small', { text: sub }));
}
function kpis(D) {
  var r = rowsOf(D), f = (D && D.fit) || {}, v = (D && D.validation) || {};
  var top = r.length ? usd(r[0].implied_value_usd) : 'n/a';
  return el('div', { class: 'kpis' },
    kpi('Watchlist', ((D && D.watchlist_size) || 0) + ' / ' + ((D && D.watchlist_size) || 0), 'protocols covered'),
    kpi('Board rows', String((D && D.board_size) || r.length), 'pre-token ranked'),
    kpi('Early rows', String((D && D.early_size) || 0), 'below floor'),
    kpi('Live comps', String((D && D.live_size) || 0), 'top by mcap set aside'),
    kpi('Fit comps', String(f.comps_n || 0), 'live mcap+tvl fitted'),
    kpi('Top implied', top, 'rank 1 point estimate'));
}
function constBox(label, val) {
  return el('div', null, el('span', { text: label }), el('b', { text: val }));
}
function vrow(cells, win) {
  return el('tr', win ? { class: 'win' } : null, cells.map(function (c) { return el('td', { text: c }); }));
}
function modelCards(D) {
  var f = (D && D.fit) || {}, v = (D && D.validation) || {};
  var l = v.loo || {}, w = v.walk_forward || {}, c = v.conformal || {};
  var eq = el('div', { class: 'eq' },
    'implied = tvl_usd', el('span', { class: 'k', text: ' x ' }), 'cat_mult',
    el('span', { class: 'k', text: ' x ' }), 'growth_mult',
    el('span', { class: 'k', text: ' x ' }), 'size_mult',
    el('span', { class: 'k', text: ' x ' }), 'age_mult',
    el('span', { class: 'k', text: ' x ' }), 'breadth_mult');
  var card1 = el('div', { class: 'card' },
    el('h2', { text: 'Model equation & fitted constants' }),
    el('p', { text: 'Fit on ' + (f.comps_n || 0) + ' live-token comps: shrunk category median mcap/TVL plus growth, size, age and breadth moves. Nothing names a protocol.' }),
    eq,
    el('div', { class: 'consts' },
      constBox('Global median', m4(f.global_median_ratio)),
      constBox('Growth slope', m5(f.growth_slope)),
      constBox('Size slope', m5(f.tvl_slope)),
      constBox('Age slope', m5(f.age_slope)),
      constBox('Breadth slope', m5(f.chain_slope)),
      constBox('Category pools', String(Object.keys(f.categories || {}).length))));
  var t = el('table', { class: 'val' },
    el('tr', null, el('th', { text: 'Split' }), el('th', { text: 'Fitted' }), el('th', { text: 'Naive' })),
    vrow(['LOO n=' + (l.n || 0) + ' MALE', String(l.fitted_male), String(l.naive_male)], (l.fitted_male || 9) <= (l.naive_male || 0)),
    vrow(['WF n=' + (w.n || 0) + ' MALE', String(w.fitted_male), String(w.naive_male)], (w.fitted_male || 9) <= (w.naive_male || 0)),
    vrow(['LOO within 2x', String(l.fitted_within_2x), String(l.naive_within_2x)], (l.fitted_within_2x || 0) >= (l.naive_within_2x || 9)),
    vrow(['WF within 2x', String(w.fitted_within_2x), String(w.naive_within_2x)], (w.fitted_within_2x || 0) >= (w.naive_within_2x || 9)));
  var card2 = el('div', { class: 'card' },
    el('h2', { text: 'Held-out validation' }),
    el('p', { text: 'Leave-one-out plus walk-forward by listed date against the naive global-median baseline. Lower error wins; band is the 80% conformal interval (x' + (c.lo_factor || 1) + ' / x' + (c.hi_factor || 1) + ').' }),
    t);
  return el('div', { class: 'cards' }, card1, card2);
}
function kvRow(k, v, tot) {
  return el('div', tot ? { class: 'tot' } : null, el('span', { text: k }), el('b', { text: v }));
}
function drawer(row, D) {
  var n = (D && D.board_size) || rowsOf(D).length;
  var ch = (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain');
  var box = el('aside', { class: 'drw', role: 'dialog', 'aria-label': row.name + ' detail' },
    el('div', { class: 'dh' },
      el('div', null,
        el('span', { class: 'rk', text: 'Rank ' + row.rank + ' of ' + n }),
        el('h3', { text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + ch })),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Close details', text: 'Close' })),
    el('div', { class: 'sec' },
      el('h4', { text: 'Valuation equation' }),
      el('div', { class: 'eq' }, usd(row.tvl_usd),
        el('span', { class: 'k', text: ' x ' }), m4(row.category_multiplier),
        el('span', { class: 'k', text: ' x ' }), m4(row.growth_multiplier),
        el('span', { class: 'k', text: ' x ' }), m4(row.size_multiplier),
        el('span', { class: 'k', text: ' x ' }), m4(row.maturity_multiplier),
        el('span', { class: 'k', text: ' x ' }), m4(row.breadth_multiplier),
        el('span', { class: 'k', text: ' = ' }), usd(row.implied_value_usd)),
      el('div', { class: 'kv' },
        kvRow('TVL', usd(row.tvl_usd)),
        kvRow('Category ' + (row.category || 'Other'), 'x' + m4(row.category_multiplier)),
        kvRow('Growth ' + pct(row.change_7d), 'x' + m4(row.growth_multiplier)),
        kvRow('Size', 'x' + m4(row.size_multiplier)),
        kvRow('Age ' + age(row.age_days), 'x' + m4(row.maturity_multiplier)),
        kvRow('Breadth ' + ((row.chains && row.chains.length) || 0) + ' chains', 'x' + m4(row.breadth_multiplier)),
        kvRow('Implied value', usd(row.implied_value_usd), true))),
    el('div', { class: 'sec' },
      el('h4', { text: '80% conformal band' }),
      el('div', { class: 'cband' },
        el('span', { class: 'lo', text: usd(row.implied_lo_usd) }),
        el('span', { text: 'band' }),
        el('b', { text: usd(row.implied_value_usd) }),
        el('span', { class: 'hi', text: usd(row.implied_hi_usd) })),
      el('p', { class: 'note', text: 'Split-conformal on leave-one-out residuals: the band multiplies and divides the point estimate by one factor.' })),
    el('div', { class: 'sec' },
      el('h4', { text: 'Peer launch odds' }),
      el('div', { class: 'cap' }, el('span', { text: 'Token launch odds' }), el('b', { text: odds(row.launch_odds) })),
      el('div', { class: 'kv' },
        kvRow('Cohort', String(row.launch_cohort || 'n/a')),
        kvRow('Cohort peers', String(row.launch_cohort_n === undefined ? 'n/a' : row.launch_cohort_n)))),
    el('div', { class: 'sec' },
      el('h4', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, (row.farm_steps || []).map(function (s) {
        var p = splitStep(s);
        return el('li', null, el('b', { text: p.act }), p.ct ? el('span', { class: 'ct', text: p.ct }) : null);
      })),
      el('div', { class: 'cap' }, el('span', { text: 'Minimum viable capital' }), el('b', { text: usd(row.min_capital_usd) }))));
  return box;
}
window.RadarPanels = { el: el, usd: usd, pct: pct, age: age, m4: m4, odds: odds, ocls: ocls, splitStep: splitStep, strip: strip, kpis: kpis, modelCards: modelCards, drawer: drawer, sortedOk: sortedOk, plansOk: plansOk, heldOk: heldOk };
})();
