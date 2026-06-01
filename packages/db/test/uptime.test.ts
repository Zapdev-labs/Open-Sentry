import { describe, test, expect } from "bun:test";
import {
  evaluateCheck,
  computeUptimePercentage,
  averageResponseMs,
  isExpectedResponse,
  type MonitorState,
} from "../src/uptime.js";

const baseState: MonitorState = {
  currentStatus: "unknown",
  consecutiveFailures: 0,
  failureThreshold: 2,
};

describe("evaluateCheck state machine", () => {
  test("a success marks the monitor up and clears failures", () => {
    const result = evaluateCheck({ ...baseState, consecutiveFailures: 1 }, { ok: true });
    expect(result.status).toBe("up");
    expect(result.consecutiveFailures).toBe(0);
    expect(result.checkStatus).toBe("up");
    expect(result.transition.type).toBe("none");
  });

  test("a single failure below threshold does not flip to down", () => {
    const result = evaluateCheck({ ...baseState, currentStatus: "up" }, { ok: false, httpStatus: 500 });
    expect(result.status).toBe("up");
    expect(result.consecutiveFailures).toBe(1);
    expect(result.transition.type).toBe("none");
  });

  test("reaching the failure threshold opens an incident and goes down", () => {
    const result = evaluateCheck(
      { currentStatus: "up", consecutiveFailures: 1, failureThreshold: 2 },
      { ok: false, httpStatus: 503, error: "Service Unavailable" }
    );
    expect(result.status).toBe("down");
    expect(result.consecutiveFailures).toBe(2);
    expect(result.transition.type).toBe("open-incident");
    if (result.transition.type === "open-incident") {
      expect(result.transition.cause).toBe("Service Unavailable");
    }
  });

  test("further failures while already down do not re-open an incident", () => {
    const result = evaluateCheck(
      { currentStatus: "down", consecutiveFailures: 5, failureThreshold: 2 },
      { ok: false, httpStatus: 503 }
    );
    expect(result.status).toBe("down");
    expect(result.consecutiveFailures).toBe(6);
    expect(result.transition.type).toBe("none");
  });

  test("recovering from down resolves the incident", () => {
    const result = evaluateCheck(
      { currentStatus: "down", consecutiveFailures: 4, failureThreshold: 2 },
      { ok: true }
    );
    expect(result.status).toBe("up");
    expect(result.consecutiveFailures).toBe(0);
    expect(result.transition.type).toBe("resolve-incident");
  });

  test("threshold of 1 goes down on the first failure", () => {
    const result = evaluateCheck(
      { currentStatus: "up", consecutiveFailures: 0, failureThreshold: 1 },
      { ok: false, httpStatus: 500 }
    );
    expect(result.status).toBe("down");
    expect(result.transition.type).toBe("open-incident");
  });

  test("falls back to a generic cause when no error message is given", () => {
    const result = evaluateCheck(
      { currentStatus: "up", consecutiveFailures: 0, failureThreshold: 1 },
      { ok: false, httpStatus: 500 }
    );
    if (result.transition.type === "open-incident") {
      expect(result.transition.cause).toContain("500");
    }
  });
});

describe("computeUptimePercentage", () => {
  test("returns 100 for no data", () => {
    expect(computeUptimePercentage([])).toBe(100);
  });

  test("computes a rounded percentage", () => {
    const checks = [
      { status: "up" as const },
      { status: "up" as const },
      { status: "down" as const },
    ];
    expect(computeUptimePercentage(checks)).toBe(66.67);
  });

  test("all down is 0", () => {
    expect(computeUptimePercentage([{ status: "down" }, { status: "down" }])).toBe(0);
  });
});

describe("averageResponseMs", () => {
  test("ignores null samples and rounds", () => {
    expect(averageResponseMs([{ responseMs: 100 }, { responseMs: 201 }, { responseMs: null }])).toBe(
      151
    );
  });

  test("returns null when nothing recorded", () => {
    expect(averageResponseMs([{ responseMs: null }, {}])).toBeNull();
  });
});

describe("isExpectedResponse", () => {
  test("matches the expected status", () => {
    expect(isExpectedResponse(200, 200, false)).toBe(true);
    expect(isExpectedResponse(200, 500, false)).toBe(false);
    expect(isExpectedResponse(200, 200, true)).toBe(false);
    expect(isExpectedResponse(200, undefined, false)).toBe(false);
  });
});
