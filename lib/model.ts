// The token radar's fitted comps model: the snapshot's own live-token protocols price the pre-token ones.
//
// Nothing here names a protocol: every number is fit from the snapshot's live-token comps (protocols
// that record a token and carry both a market cap and a TVL above zero). The fit is deterministic —
// sorted arrays, closed-form medians and ordinary least squares, no random draws, no clock reads — so
// two runs over the same snapshot write the same bytes.
//
//   comps        live-token protocols with mcap_usd > 0 and tvl_usd > 0 (the market's own pricings)
//   category     each category's median mcap/TVL, shrunk toward the global median with a prior weight
//                of 4 (an unseen category scores at the global median; no category is hand-tuned)
//   adjustments  univariate OLS slopes of the residual log-ratio on 7d growth, log TVL (the size
//                elasticity: bigger books trade at lower multiples), age and chain count, each damped
//                toward zero by SLOPE_SHRINK so small-sample folds cannot swing the board
//   implied      tvl_usd x exp(category effect + bounded growth/size/age/breadth moves, +-0.7 each)
//
// Launch odds come from peer cohorts, not from a model of the future: every snapshot protocol sits in
// an age-bucket x TVL-bucket cohort, and the odds are the Laplace-smoothed share of that cohort that
// already records a token. Walk-forward (by listed_at) and leave-one-out cross-validation score the
// fitted model against a naive TVL baseline (the global median mcap/TVL for every protocol), and the
// 80% interval is split-conformal on the leave-one-out residuals: symmetric in log space, so the band
// multiplies and divides the point estimate by one factor.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) plus the
// strongest pre-token protocols below the floor by TVL: the early rows the radar exists to find. A
// protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); live-token protocols are kept apart and shown as the market's own values.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

/**
 * The prior constants: the house starting point the fit falls back to when the snapshot carries too
 * few live-token comps to fit from (under MIN_COMPS). On this snapshot the fit always wins; the
 * priors only keep degenerate inputs scoring instead of crashing.
 */
export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 180;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Live-token comps below this count cannot carry the fit: the priors score instead. */
export const MIN_COMPS = 10;

/** Prior weight shrinking each category's median mcap/TVL toward the global median. */
export const CATEGORY_PRIOR = 4;

/**
 * Slope shrinkage: each univariate OLS slope is damped by n / (n + SLOPE_SHRINK), so the size,
 * growth, age and breadth effects survive at full-sample strength but shrink toward zero in the
 * small folds of walk-forward validation instead of swinging the board.
 */
export const SLOPE_SHRINK = 30;

/** The most the growth/age/breadth adjustments may move a log-ratio up or down, each way. */
export const ADJUST_CAP = 0.7;

/** The conformal interval's coverage: 80% on the leave-one-out residuals. */
export const CONFORMAL_LEVEL = 0.8;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_lo_usd: number;
  implied_hi_usd: number;
  launch_odds: number;
  launch_cohort: string;
  launch_cohort_n: number;
  min_capital_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    size_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    category_key: string;
    category_multiplier: number;
    breadth_multiplier: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row: the fitted breakdown, the cohort odds and the plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_lo_usd: number;
  implied_hi_usd: number;
  launch_odds: number;
  launch_cohort: string;
  launch_cohort_n: number;
  min_capital_usd: number;
  growth_multiplier: number;
  size_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  category_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's fitted multiple: its comps' median mcap/TVL, shrunk toward the global median. */
export interface CategoryComp {
  n: number;
  median_ratio: number;
  shrunk_ratio: number;
}

/** The fitted comps model: every number fit from the snapshot's live-token protocols. */
export interface FitParams {
  comps_n: number;
  global_median_ratio: number;
  growth_ref: number;
  tvl_ref: number;
  age_ref: number;
  chain_ref: number;
  growth_slope: number;
  tvl_slope: number;
  age_slope: number;
  chain_slope: number;
  categories: Record<string, CategoryComp>;
}

/** One validation split: the fitted model against the naive TVL baseline. */
export interface ValidationSplit {
  n: number;
  fitted_male: number;
  naive_male: number;
  fitted_within_2x: number;
  naive_within_2x: number;
}

/** The model's validation: walk-forward by listed_at, leave-one-out, and the conformal band. */
export interface ValidationReport {
  loo: ValidationSplit;
  walk_forward: ValidationSplit;
  conformal: {
    level: number;
    n: number;
    q_log: number;
    lo_factor: number;
    hi_factor: number;
  };
}

/** Everything the dashboard needs: the board, the live set, the fit, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  fit: FitParams;
  validation: ValidationReport;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp `v` into [`lo`, `hi`]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The median of `values` (sorted copy; the mean of the middle two when even), or `fallback`. */
function median(values: number[], fallback = 0): number {
  if (values.length === 0) return fallback;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * The univariate OLS slope of `ys` on `xs` (through their means; the intercept is discarded since
 * only the marginal effect feeds the adjustments), damped by n / (n + SLOPE_SHRINK) toward zero.
 * Zero when `xs` does not vary.
 */
function olsSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    sxx += dx * dx;
    sxy += dx * (ys[i]! - my);
  }
  if (sxx <= 0) return 0;
  return (sxy / sxx) * (n / (n + SLOPE_SHRINK));
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The live-token comps the fit learns from: a recorded token with market cap and TVL above zero. */
export function liveComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** The category key the fit files a protocol under: its own category, or the pooled fallback. */
function categoryKey(p: SnapshotProtocol): string {
  return p.category ?? 'Unknown';
}

/**
 * Fit the comps model from the snapshot's live-token protocols: shrunk category median mcap/TVL
 * ratios plus univariate OLS slopes of the residual log-ratio on growth, age and chain breadth.
 * Null growth falls back to the comps' median growth and unknown ages to their median age, so the
 * references are the market's own, never a hand-picked constant.
 */
export function fitComps(comps: SnapshotProtocol[], asOf: string): FitParams {
  const ratios = comps.map((p) => Math.log((p.mcap_usd as number) / p.tvl_usd));
  const globalMedian = median(ratios, Math.log(MODEL.base_multiple));
  const growths = comps.map((p) => clamp(finite(p.change_7d, 0), MODEL.growth_floor, MODEL.growth_cap));
  const growthRef = median(growths, 0);
  const tvlRef = median(
    comps.map((p) => Math.log(p.tvl_usd)),
    Math.log(50_000_000),
  );
  const ages = comps.map((p) => ageDays(asOf, p.listed_at)).filter((a): a is number => a !== null);
  const ageRef = median(ages, MODEL.unknown_age_days);
  const chains = comps.map((p) => p.chains.length);
  const chainRef = median(chains, 1);

  const byCat = new Map<string, number[]>();
  for (const p of comps) {
    const k = categoryKey(p);
    const list = byCat.get(k);
    const r = Math.log((p.mcap_usd as number) / p.tvl_usd);
    if (list === undefined) byCat.set(k, [r]);
    else list.push(r);
  }
  const categories: Record<string, CategoryComp> = {};
  for (const [k, list] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const med = median(list, globalMedian);
    categories[k] = {
      n: list.length,
      median_ratio: Math.exp(med),
      shrunk_ratio: Math.exp((list.length * med + CATEGORY_PRIOR * globalMedian) / (list.length + CATEGORY_PRIOR)),
    };
  }

  const shrunkOf = (p: SnapshotProtocol): number => {
    const c = categories[categoryKey(p)];
    return Math.log(c === undefined ? Math.exp(globalMedian) : c.shrunk_ratio);
  };
  const resid = comps.map((p) => Math.log((p.mcap_usd as number) / p.tvl_usd) - shrunkOf(p));
  const growthSlope = olsSlope(
    comps.map((p, i) => clamp(finite(p.change_7d, growths[i]!), MODEL.growth_floor, MODEL.growth_cap) - growthRef),
    resid,
  );
  const tvlSlope = olsSlope(
    comps.map((p) => Math.log(p.tvl_usd) - tvlRef),
    resid,
  );
  const ageSlope = olsSlope(
    comps.map((p) => (ageDays(asOf, p.listed_at) ?? ageRef) - ageRef),
    resid,
  );
  const chainSlope = olsSlope(
    comps.map((p) => p.chains.length - chainRef),
    resid,
  );

  return {
    comps_n: comps.length,
    global_median_ratio: Math.exp(globalMedian),
    growth_ref: growthRef,
    tvl_ref: tvlRef,
    age_ref: ageRef,
    chain_ref: chainRef,
    growth_slope: growthSlope,
    tvl_slope: tvlSlope,
    age_slope: ageSlope,
    chain_slope: chainSlope,
    categories,
  };
}

/** One protocol's fitted adjustments: the log-ratio moves from growth, size, age and breadth. */
export interface Adjustments {
  growthPct: number;
  growthMult: number;
  sizeMult: number;
  maturityMult: number;
  breadthMult: number;
  categoryMult: number;
  age: number | null;
}

/** The fitted adjustments and multipliers one protocol gets under `fit`. */
export function adjustmentsFor(p: SnapshotProtocol, asOf: string, fit: FitParams): Adjustments {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = clamp(finite(p.change_7d, fit.growth_ref), MODEL.growth_floor, MODEL.growth_cap);
  const ageForModel = age ?? fit.age_ref;
  const growthAdj = clamp(fit.growth_slope * (growthPct - fit.growth_ref), -ADJUST_CAP, ADJUST_CAP);
  const sizeAdj = clamp(fit.tvl_slope * (Math.log(p.tvl_usd) - fit.tvl_ref), -ADJUST_CAP, ADJUST_CAP);
  const ageAdj = clamp(fit.age_slope * (ageForModel - fit.age_ref), -ADJUST_CAP, ADJUST_CAP);
  const chainAdj = clamp(fit.chain_slope * (p.chains.length - fit.chain_ref), -ADJUST_CAP, ADJUST_CAP);
  const cat = fit.categories[categoryKey(p)];
  const categoryMult = cat === undefined ? fit.global_median_ratio : cat.shrunk_ratio;
  return {
    growthPct,
    growthMult: Math.exp(growthAdj),
    sizeMult: Math.exp(sizeAdj),
    maturityMult: Math.exp(ageAdj),
    breadthMult: Math.exp(chainAdj),
    categoryMult,
    age,
  };
}

/** The fitted implied value: TVL times the category multiple times the bounded adjustments. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: FitParams,
): { implied: number; adjustments: Adjustments } {
  const adjustments = adjustmentsFor(protocol, asOf, fit);
  const ratio =
    adjustments.categoryMult *
    adjustments.growthMult *
    adjustments.sizeMult *
    adjustments.maturityMult *
    adjustments.breadthMult;
  const implied = Math.min(100_000_000_000_000, Math.max(1, Math.round(protocol.tvl_usd * ratio)));
  return { implied, adjustments };
}

/** A launch cohort's key: an age bucket crossed with a TVL bucket. */
export function cohortKey(p: SnapshotProtocol, asOf: string): string {
  const age = ageDays(asOf, p.listed_at);
  const ageBucket =
    age === null ? 'age-unknown' : age < 180 ? 'age-under-6m' : age < 365 ? 'age-6m-1y' : age < 730 ? 'age-1y-2y' : age < 1460 ? 'age-2y-4y' : 'age-over-4y';
  const tvl = p.tvl_usd;
  const tvlBucket =
    tvl < 10_000_000
      ? 'tvl-under-10m'
      : tvl < 25_000_000
        ? 'tvl-10m-25m'
        : tvl < 50_000_000
          ? 'tvl-25m-50m'
          : tvl < 150_000_000
            ? 'tvl-50m-150m'
            : tvl < 500_000_000
              ? 'tvl-150m-500m'
              : 'tvl-over-500m';
  return `${ageBucket}|${tvlBucket}`;
}

/**
 * Token launch odds from peer cohorts: every snapshot protocol sits in an age x TVL cohort, and the
 * odds are the Laplace-smoothed share of that cohort that already records a token — the fraction of
 * protocols this old and this big that the market has seen launch.
 */
export function launchOdds(snapshot: Snapshot): Map<string, { odds: number; cohort: string; cohort_n: number }> {
  const cohorts = new Map<string, { launched: number; total: number }>();
  for (const p of snapshot.protocols) {
    const k = cohortKey(p, snapshot.as_of);
    const c = cohorts.get(k) ?? { launched: 0, total: 0 };
    c.total += 1;
    if (!isPreToken(p)) c.launched += 1;
    cohorts.set(k, c);
  }
  const out = new Map<string, { odds: number; cohort: string; cohort_n: number }>();
  for (const p of snapshot.protocols) {
    const k = cohortKey(p, snapshot.as_of);
    const c = cohorts.get(k)!;
    out.set(p.slug, { odds: round4((c.launched + 1) / (c.total + 2)), cohort: k, cohort_n: c.total });
  }
  return out;
}

/** Score one split: mean absolute log-error and the share of predictions within 2x, both models. */
function scoreSplit(actual: number[], fitted: number[], naive: number[]): ValidationSplit {
  const n = actual.length;
  let fErr = 0;
  let nErr = 0;
  let fIn = 0;
  let nIn = 0;
  for (let i = 0; i < n; i++) {
    const fe = Math.abs(Math.log(fitted[i]! / actual[i]!));
    const ne = Math.abs(Math.log(naive[i]! / actual[i]!));
    fErr += fe;
    nErr += ne;
    if (fe <= Math.LN2) fIn += 1;
    if (ne <= Math.LN2) nIn += 1;
  }
  return {
    n,
    fitted_male: n === 0 ? 0 : round4(fErr / n),
    naive_male: n === 0 ? 0 : round4(nErr / n),
    fitted_within_2x: n === 0 ? 0 : round4(fIn / n),
    naive_within_2x: n === 0 ? 0 : round4(nIn / n),
  };
}

/**
 * Validate the fitted model on the live comps: leave-one-out cross-validation over every comp and a
 * walk-forward over comps ordered by listed_at (each protocol predicted from strictly earlier
 * listings), both against the naive TVL baseline of one global median mcap/TVL. The 80% interval is
 * conformal on the leave-one-out residuals: the symmetric log-band covering 80% of held-out errors.
 */
export function validateModel(snapshot: Snapshot, comps: SnapshotProtocol[]): ValidationReport {
  const actual = comps.map((p) => p.mcap_usd as number);

  const looFitted: number[] = [];
  const looNaive: number[] = [];
  const looResid: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const fit = fitComps(rest, snapshot.as_of);
    const naiveRatio = fit.global_median_ratio;
    const { implied } = impliedValue(comps[i]!, snapshot.as_of, fit);
    looFitted.push(implied);
    looNaive.push(Math.max(1, Math.round(comps[i]!.tvl_usd * naiveRatio)));
    looResid.push(Math.abs(Math.log(implied / actual[i]!)));
  }
  const loo = scoreSplit(actual, looFitted, looNaive);

  const dated = comps
    .filter((p) => p.listed_at !== null && Number.isFinite(Date.parse(`${p.listed_at}T00:00:00Z`)))
    .sort((a, b) => (a.listed_at as string) < (b.listed_at as string) ? -1 : (a.listed_at as string) > (b.listed_at as string) ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const warmup = dated.length > 25 ? 20 : Math.max(1, Math.floor(dated.length / 4));
  const wfActual: number[] = [];
  const wfFitted: number[] = [];
  const wfNaive: number[] = [];
  for (let i = warmup; i < dated.length; i++) {
    const fit = fitComps(dated.slice(0, i), snapshot.as_of);
    const { implied } = impliedValue(dated[i]!, snapshot.as_of, fit);
    wfActual.push(dated[i]!.mcap_usd as number);
    wfFitted.push(implied);
    wfNaive.push(Math.max(1, Math.round(dated[i]!.tvl_usd * fit.global_median_ratio)));
  }
  const walkForward = scoreSplit(wfActual, wfFitted, wfNaive);

  const sorted = looResid.slice().sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(CONFORMAL_LEVEL * (sorted.length + 1)) - 1));
  const q = sorted.length === 0 ? 0 : sorted[rank]!;
  return {
    loo,
    walk_forward: walkForward,
    conformal: {
      level: CONFORMAL_LEVEL,
      n: sorted.length,
      q_log: round4(q),
      lo_factor: round4(Math.exp(-q)),
      hi_factor: round4(Math.exp(q)),
    },
  };
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The effective global constants the dashboard states: the fit's backbone in the old shape. */
export function effectiveModel(fit: FitParams): ModelConstants {
  return {
    base_multiple: round4(fit.global_median_ratio),
    growth_weight: round4(fit.growth_slope * 100),
    growth_floor: MODEL.growth_floor,
    growth_cap: MODEL.growth_cap,
    maturity_floor: round4(Math.exp(clamp(fit.age_slope * (0 - fit.age_ref), -ADJUST_CAP, ADJUST_CAP))),
    maturity_range: round4(
      Math.exp(clamp(fit.age_slope * (MODEL.maturity_days - fit.age_ref), -ADJUST_CAP, ADJUST_CAP)) -
        Math.exp(clamp(fit.age_slope * (0 - fit.age_ref), -ADJUST_CAP, ADJUST_CAP)),
    ),
    maturity_days: MODEL.maturity_days,
    unknown_age_days: Math.round(fit.age_ref),
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  fit?: FitParams,
  validation?: ValidationReport,
): BoardRow[] {
  const comps = liveComps(snapshot);
  const fitted = fit ?? (comps.length >= MIN_COMPS ? fitComps(comps, snapshot.as_of) : null);
  const report = validation ?? (comps.length >= MIN_COMPS ? validateModel(snapshot, comps) : null);
  const q = report === null ? 0 : report.conformal.q_log;
  const loFactor = Math.exp(-q);
  const hiFactor = Math.exp(q);
  const odds = launchOdds(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    if (fitted === null) {
      const rawGrowth = finite(p.change_7d, 0);
      const growthPct = clamp(rawGrowth, MODEL.growth_floor, MODEL.growth_cap);
      const growthMult = 1 + (growthPct / 100) * MODEL.growth_weight;
      const age = ageDays(snapshot.as_of, p.listed_at);
      const ageForModel = age ?? MODEL.unknown_age_days;
      const maturityMult =
        MODEL.maturity_floor + (Math.min(Math.max(ageForModel, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
      const implied = Math.min(100_000_000_000_000, Math.max(1, Math.round(p.tvl_usd * MODEL.base_multiple * growthMult * maturityMult)));
      return { p, implied, growthPct, growthMult, sizeMult: 1, maturityMult, breadthMult: 1, categoryMult: MODEL.base_multiple, age };
    }
    const { implied, adjustments } = impliedValue(p, snapshot.as_of, fitted);
    return {
      p,
      implied,
      growthPct: adjustments.growthPct,
      growthMult: adjustments.growthMult,
      sizeMult: adjustments.sizeMult,
      maturityMult: adjustments.maturityMult,
      breadthMult: adjustments.breadthMult,
      categoryMult: adjustments.categoryMult,
      age: adjustments.age,
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const o = odds.get(s.p.slug) ?? { odds: 0.5, cohort: 'age-unknown|tvl-under-10m', cohort_n: 0 };
    const capital = minCapitalFor(s.p);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      implied_lo_usd: Math.max(1, Math.round(s.implied * loFactor)),
      implied_hi_usd: Math.max(1, Math.round(s.implied * hiFactor)),
      launch_odds: o.odds,
      launch_cohort: o.cohort,
      launch_cohort_n: o.cohort_n,
      min_capital_usd: capital,
      model: {
        base_multiple: round4(s.categoryMult),
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        size_multiplier: round4(s.sizeMult),
        maturity_multiplier: round4(s.maturityMult),
        age_days: s.age,
        category_key: categoryKey(s.p),
        category_multiplier: round4(s.categoryMult),
        breadth_multiplier: round4(s.breadthMult),
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The minimum viable capital for one farm position, from the protocol's own TVL. */
export function minCapitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's funding action, in the words a farmer can follow. No protocol name is special-cased. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const min = `Minimum viable capital $${capital}.`;
  if (c.includes('restak')) return `Restake $${capital} of the chain's staking asset through ${name} on ${chain} and hold the receipt. ${min}`;
  if (c.includes('stak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt. ${min}`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow'))
    return `Supply $${capital} of USDC to ${name} on ${chain}, borrow a little against it, and keep the position open. ${min}`;
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open. ${min}`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app. ${min}`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small delta-neutral hedge. ${min}`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} and place one market position. ${min}`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk'))
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares. ${min}`;
  if (c.includes('yield') || c.includes('aggregator') || c.includes('vault'))
    return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the shares. ${min}`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}. ${min}`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it. ${min}`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy. ${min}`;
  if (c.includes('btc') || c.includes('anchor')) return `Deposit $${capital} of BTC into ${name} on ${chain} and hold the receipt. ${min}`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${chain} and use it across ${name}'s apps. ${min}`;
  if (c.includes('payment') || c.includes('card')) return `Deposit $${capital} with ${name} and spend a little through its card or rails. ${min}`;
  if (c.includes('privacy')) return `Deposit $${capital} of USDC into ${name}'s shielded pool on ${chain}. ${min}`;
  if (c.includes('otc')) return `Open a $${capital} quote on ${name} and settle one small trade. ${min}`;
  if (c.includes('governance') || c.includes('incentive')) return `Lock $${capital} with ${name} on ${chain} and vote once a live proposal opens. ${min}`;
  if (c.includes('index')) return `Mint $${capital} of the ${name} index on ${chain} and hold it. ${min}`;
  if (c.includes('interest rate')) return `Lend $${capital} of USDC at a fixed rate through ${name} on ${chain}. ${min}`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name}'s earn product and keep it there. ${min}`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open. ${min}`;
}

/** The category's weekly cadence: what one repeat action keeps the wallet visible. */
function cadenceFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis'))
    return `Open and close one small trade each week so the wallet keeps fresh fills.`;
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm'))
    return `Rebalance or top up a little liquidity each week, or route one swap through the pool.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow'))
    return `Adjust the supply or the borrow a little each week so the position keeps fresh events.`;
  if (c.includes('bridge')) return `Bridge a small amount or use the destination app each week.`;
  if (c.includes('governance') || c.includes('incentive')) return `Vote on every proposal that opens, at least once a month.`;
  return `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`;
}

/**
 * A protocol's farm plan: five steps, each an action with a $ cost and a time, stating the minimum
 * viable capital. The plan is derived from the protocol's own record (category, chains, TVL, age),
 * never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = minCapitalFor(p);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: cadenceFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the $${capital} position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log; before you withdraw, open the protocol's own points page and claim only from the link it publishes.`,
      cost: 'nothing but the log, and never pay a $ fee to claim',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js: the fitted breakdown plus the plan, no page math. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_lo_usd: row.implied_lo_usd,
    implied_hi_usd: row.implied_hi_usd,
    launch_odds: row.launch_odds,
    launch_cohort: row.launch_cohort,
    launch_cohort_n: row.launch_cohort_n,
    min_capital_usd: row.min_capital_usd,
    growth_multiplier: row.model.growth_multiplier,
    size_multiplier: row.model.size_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    category_multiplier: row.model.category_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot: the fitted board, the live set, the fit. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData; fit: FitParams | null; validation: ValidationReport | null } {
  const comps = liveComps(snapshot);
  const fit = comps.length >= MIN_COMPS ? fitComps(comps, snapshot.as_of) : null;
  const validation = comps.length >= MIN_COMPS ? validateModel(snapshot, comps) : null;
  void model;
  const board = buildBoard(snapshot, fit ?? undefined, validation ?? undefined);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const fallbackFit: FitParams = {
    comps_n: 0,
    global_median_ratio: model.base_multiple,
    growth_ref: 0,
    tvl_ref: Math.log(50_000_000),
    age_ref: model.unknown_age_days,
    chain_ref: 1,
    growth_slope: 0,
    tvl_slope: 0,
    age_slope: 0,
    chain_slope: 0,
    categories: {},
  };
  const fallbackValidation: ValidationReport = {
    loo: { n: 0, fitted_male: 0, naive_male: 0, fitted_within_2x: 0, naive_within_2x: 0 },
    walk_forward: { n: 0, fitted_male: 0, naive_male: 0, fitted_within_2x: 0, naive_within_2x: 0 },
    conformal: { level: CONFORMAL_LEVEL, n: 0, q_log: 0, lo_factor: 1, hi_factor: 1 },
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: fit === null ? model : effectiveModel(fit),
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    fit: fit ?? fallbackFit,
    validation: validation ?? fallbackValidation,
  };
  return { board, radar, fit, validation };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
