// Pure, side-effect-free logic for the uptime monitoring state machine and
// aggregation. Kept free of DB/network access so it can be unit-tested in
// isolation and reused by both the worker and the dashboard.

export type MonitorStatus = "up" | "down" | "paused" | "unknown";
export type CheckStatus = "up" | "down";

export interface ProbeResult {
  ok: boolean;
  httpStatus?: number;
  responseMs?: number;
  error?: string;
}

export interface MonitorState {
  currentStatus: MonitorStatus;
  consecutiveFailures: number;
  failureThreshold: number;
}

export type StateTransition =
  | { type: "none" }
  | { type: "open-incident"; cause: string }
  | { type: "resolve-incident" };

export interface EvaluatedState {
  status: MonitorStatus;
  consecutiveFailures: number;
  checkStatus: CheckStatus;
  transition: StateTransition;
}

/**
 * Decide the next monitor status from its current state and a fresh probe.
 *
 * A monitor only flips to `down` once it has failed `failureThreshold` times in
 * a row (debouncing transient blips). The first success after a down period
 * resolves the open incident. Transitions are reported so the caller can
 * open/resolve incident rows without re-deriving state.
 */
export function evaluateCheck(state: MonitorState, probe: ProbeResult): EvaluatedState {
  const threshold = Math.max(1, state.failureThreshold);

  if (probe.ok) {
    return {
      status: "up",
      consecutiveFailures: 0,
      checkStatus: "up",
      transition: state.currentStatus === "down" ? { type: "resolve-incident" } : { type: "none" },
    };
  }

  const consecutiveFailures = state.consecutiveFailures + 1;
  const downNow = consecutiveFailures >= threshold;

  let status: MonitorStatus;
  if (downNow || state.currentStatus === "down") {
    status = "down";
  } else if (state.currentStatus === "unknown") {
    status = "unknown";
  } else {
    status = "up";
  }

  const justWentDown = downNow && state.currentStatus !== "down";
  const transition: StateTransition = justWentDown
    ? {
        type: "open-incident",
        cause: probe.error ?? `Unexpected response (HTTP ${probe.httpStatus ?? "n/a"})`,
      }
    : { type: "none" };

  return { status, consecutiveFailures, checkStatus: "down", transition };
}

/**
 * Percentage of checks that were `up`, rounded to two decimals. Returns 100
 * when there is no data yet (nothing has gone wrong).
 */
export function computeUptimePercentage(checks: ReadonlyArray<{ status: CheckStatus }>): number {
  if (checks.length === 0) return 100;
  const up = checks.reduce((acc, c) => acc + (c.status === "up" ? 1 : 0), 0);
  return Math.round((up / checks.length) * 10000) / 100;
}

/** Average response time across checks that recorded one, rounded to an integer. */
export function averageResponseMs(
  checks: ReadonlyArray<{ responseMs?: number | null }>
): number | null {
  const samples = checks
    .map((c) => c.responseMs)
    .filter((ms): ms is number => typeof ms === "number");
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((acc, ms) => acc + ms, 0) / samples.length);
}

/** Whether a probe should be considered successful given a monitor's expectations. */
export function isExpectedResponse(
  expectedStatus: number,
  httpStatus: number | undefined,
  hadError: boolean
): boolean {
  if (hadError || httpStatus === undefined) return false;
  return httpStatus === expectedStatus;
}
