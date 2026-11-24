[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/BangDills/token-radar-v3-20261124/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/BangDills/token-radar-v3-20261124/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — fitted comps board for pre-token protocols

A dark fintech terminal ranking 220 pre-token protocols by fitted implied value:
40 watchlist protocols (the floor) plus 180 early rows below the floor, priced
from the market's own live-token comps. No protocol name is special-cased anywhere.

## Architecture

- `main.ts` — reads `/input/snapshot.json`, builds board + `data.js`, copies
  `dashboard/` and `screenshots/`, writes `dossier.json` with the vendored
  `buildDossier`. Supports `--verify-determinism` (rebuilds in memory, refuses
  on any byte difference).
- `lib/model.ts` (`radar-2`) — the fitted comps model, Node 22 stdlib only,
  fully deterministic (sorted arrays, closed-form medians/OLS, no randomness).
- `dashboard/` — `index.html` + `app.css` + `panels.js` (strip, KPIs, model
  cards, detail drawer) + `app.js` (table, filters, live tab, hash routes).
  Vanilla JS, zero `http(s)://`, reads `../data.js`.
- `vendor/makefun-board.ts` — untouched scoring library.

## Fitted model (fit on 128 live-token comps, mcap > 0 and TVL > 0)

`implied = tvl_usd x cat_mult x growth_mult x size_mult x age_mult x breadth_mult`

- `cat_mult` — category median mcap/TVL shrunk toward the global median
  (prior weight 4; unseen categories score at the global median 0.2136).
  Largest pools: Lending n=15 (0.1464), Dexs n=11 (0.3019), CEX n=9 (0.1033),
  Liquid Staking n=9 (0.0677), RWA n=9 (0.2543), Yield n=9 (0.1980),
  Canonical Bridge n=8 (0.4452), Basis Trading n=7 (0.4356),
  Bridge n=6 (0.2880), Cross Chain Bridge n=4 (0.3925); 34 pools total.
- Adjustment slopes (univariate OLS on residual log-ratio, damped n/(n+30),
  each move capped at ±0.7 in log space):
  growth −0.03491 (ref −9.31%), size −0.29530 (ref log-TVL 17.30),
  age +0.000096/day (ref 1000d), breadth +0.00077/chain (ref 2).
- Launch odds — Laplace-smoothed share of each protocol's age×TVL peer
  cohort that already records a token.
- Farm plans — 5 category-aware steps per protocol, each with $ cost, time
  and minimum viable capital ($50/100/150/250 by TVL).

## Held-out validation (vs naive global-median baseline)

- Leave-one-out (n=128): fitted MALE 1.7081 vs naive 1.807.
- Walk-forward by listed date (n=75): fitted 1.729 vs naive 1.7571.
- 80% split-conformal band on LOO residuals: ×0.0752 / ×13.3012.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|dir>
```

Expected output:

```text
token radar: 758 protocols, 40 on the watchlist, 220 rows scored (180 early, 24 live set aside)
token radar: fit on 128 live comps: global median 0.2136, slopes g=-0.03491 t=-0.29530 a=0.000096 c=0.00077
token radar: LOO fitted 1.7081 vs naive 1.807 (n=128); walk-forward fitted 1.729 vs naive 1.7571 (n=75); 80pct band x0.0752/x13.3012
token radar: wrote out/board.json, out/data.js, out/dashboard (4 files), out/screenshots (3 images) and out/dossier.json
```

## Gate checks (local)

```sh
python3 /root/makefun/verify_radar.py /root/makefun/work/radar-v3
```

Covers: dashboard files (index.html + css + js, ≤4MB/400 files, no network
refs), board shape (100–4000 rows, ranks 1..N, non-increasing implied value,
3–12 farm steps of 20–600 chars), full 40/40 watchlist coverage,
screenshots (3–4 PNG/JPEG ≤ 512KiB, long side ≤ 1440, short side ≥ 800),
and dashboard source ≤ 64KB so the dossier carries it whole.
