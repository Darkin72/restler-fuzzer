import { existsSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  buildAvailableRequests,
  collectObservedSequences,
  collectResponseStatusCountsFromLogs,
  findLatestExperimentDir,
  readJson,
} from "./restler-artifacts.mjs";

function summarizeMethodCounts(availableRequests) {
  const counts = new Map();

  for (const request of availableRequests) {
    counts.set(request.method, (counts.get(request.method) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => right.count - left.count);
}

function summarizeStatusCounts(errorBuckets) {
  const counts = new Map();

  for (const [statusCode, groups] of Object.entries(errorBuckets ?? {})) {
    if (statusCode === "0") {
      continue;
    }

    let total = 0;
    for (const records of Object.values(groups ?? {})) {
      total += Array.isArray(records) ? records.length : 0;
    }

    if (total > 0) {
      counts.set(statusCode, total);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => Number(left.code) - Number(right.code));
}

function summarizeBugBuckets(bugsJson) {
  const groups = new Map();

  for (const bug of bugsJson.bugs ?? []) {
    const key = `${bug.checker_name}|${bug.error_code}|${bug.reproducible}`;
    const current = groups.get(key) ?? {
      checker: bug.checker_name,
      errorCode: bug.error_code,
      count: 0,
      reproducible: Boolean(bug.reproducible),
    };

    current.count += 1;
    groups.set(key, current);
  }

  return [...groups.values()].sort((left, right) => right.count - left.count);
}

function buildNotableFailures(errorBuckets) {
  const failures = [];

  for (const [statusCode, groups] of Object.entries(errorBuckets ?? {})) {
    if (statusCode === "0") {
      continue;
    }

    for (const records of Object.values(groups ?? {})) {
      if (!Array.isArray(records) || records.length === 0) {
        continue;
      }

      const first = records[0];
      const requestData = first.request?.RequestData;
      const responseData = first.response?.ResponseData;

      if (!requestData || !responseData) {
        continue;
      }

      failures.push({
        endpoint: `${requestData.method} ${requestData.path}`,
        statusCode,
        reason: responseData.content || responseData.codeDescription || "Failure captured by RESTler.",
      });
      break;
    }
  }

  return failures.slice(0, 12);
}

function findPreferredSummarySource(workspacePath, experimentDirs) {
  const candidates = experimentDirs
    .map((item) => {
      const summaryPath = join(item.dir ?? "", "logs", "testing_summary.json");
      if (!item.dir || !existsSync(summaryPath)) {
        return null;
      }

      return {
        kind: item.kind,
        dir: item.dir,
        summaryPath,
        mtimeMs: statSync(summaryPath).mtimeMs,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0] ?? {
    kind: "workspace",
    dir: workspacePath,
    summaryPath: "",
    mtimeMs: 0,
  };
}

function inferKindFromExperimentDir(experimentDir) {
  const normalized = experimentDir.replace(/\\/g, "/");

  if (normalized.includes("/FuzzLean/")) {
    return "fuzz-lean";
  }

  if (normalized.includes("/Fuzz/")) {
    return "fuzz";
  }

  if (normalized.includes("/Test/")) {
    return "test";
  }

  return "workspace";
}

export function analyzeResults(
  workspacePathInput,
  experimentPathInput = "",
  failureStatusClasses = [],
) {
  const workspacePath = resolve(workspacePathInput);
  const openApiSpec = readJson(join(workspacePath, "openapi.json"), { paths: {} });
  const availableRequests = buildAvailableRequests(openApiSpec);

  const testExperimentDir = findLatestExperimentDir(join(workspacePath, "Test", "RestlerResults"));
  const fuzzExperimentDir = findLatestExperimentDir(join(workspacePath, "Fuzz", "RestlerResults"));
  const fuzzLeanExperimentDir = findLatestExperimentDir(join(workspacePath, "FuzzLean", "RestlerResults"));

  const selectedExperimentDir = experimentPathInput ? resolve(experimentPathInput) : "";

  const preferredSummary = selectedExperimentDir
    ? {
      kind: inferKindFromExperimentDir(selectedExperimentDir),
      dir: selectedExperimentDir,
      summaryPath: join(selectedExperimentDir, "logs", "testing_summary.json"),
      mtimeMs: existsSync(join(selectedExperimentDir, "logs", "testing_summary.json"))
        ? statSync(join(selectedExperimentDir, "logs", "testing_summary.json")).mtimeMs
        : 0,
    }
    : findPreferredSummarySource(workspacePath, [
      { kind: "fuzz", dir: fuzzExperimentDir },
      { kind: "fuzz-lean", dir: fuzzLeanExperimentDir },
      { kind: "test", dir: testExperimentDir },
    ]);

  const testingSummary = readJson(preferredSummary.summaryPath, {});
  const responseBucketsRoot = selectedExperimentDir
    ? join(selectedExperimentDir, "..", "..", "ResponseBuckets")
    : preferredSummary.kind === "fuzz"
      ? join(workspacePath, "Fuzz", "ResponseBuckets")
      : preferredSummary.kind === "fuzz-lean"
        ? join(workspacePath, "FuzzLean", "ResponseBuckets")
        : join(workspacePath, "Test", "ResponseBuckets");
  const errorBuckets = readJson(join(responseBucketsRoot, "errorBuckets.json"), {});
  const bugsJson = selectedExperimentDir
    ? readJson(join(selectedExperimentDir, "bug_buckets", "Bugs.json"), { bugs: [] })
    : (
      readJson(join(fuzzExperimentDir ?? "", "bug_buckets", "Bugs.json"), null)
      ?? readJson(join(fuzzLeanExperimentDir ?? "", "bug_buckets", "Bugs.json"), null)
      ?? readJson(join(testExperimentDir ?? "", "bug_buckets", "Bugs.json"), { bugs: [] })
    );

  const totalRequestsSent = testingSummary.total_requests_sent?.main_driver ?? 0;
  const renderedValid = testingSummary.num_fully_valid ?? 0;
  const renderedRequestsTotal = Number(String(testingSummary.rendered_requests ?? "0 / 0").split("/")[0].trim()) || 0;

  const failingSequenceExperimentDirs = selectedExperimentDir
    ? [selectedExperimentDir]
    : preferredSummary.dir && preferredSummary.kind !== "workspace"
      ? [preferredSummary.dir]
      : [fuzzExperimentDir, fuzzLeanExperimentDir, testExperimentDir].filter(Boolean);

  const observedSequences = collectObservedSequences(
    failingSequenceExperimentDirs,
    availableRequests,
    failureStatusClasses,
  );
  const responseStatusCounts =
    Object.keys(errorBuckets ?? {}).length > 0
      ? summarizeStatusCounts(errorBuckets)
      : collectResponseStatusCountsFromLogs(failingSequenceExperimentDirs);
  const passedSequenceCount = observedSequences.filter((sequence) => sequence.outcome === "passed").length;
  const totalSequenceCount = observedSequences.length;

  return {
    generatedFrom: preferredSummary.dir || workspacePath,
    reportName: preferredSummary.dir ? basename(preferredSummary.dir) : basename(workspacePath),
    availableRequests,
    testSummary: {
      finalSpecCoverage: testingSummary.final_spec_coverage ?? `0 / ${availableRequests.length}`,
      renderedRequests: testingSummary.rendered_requests ?? `0 / ${availableRequests.length}`,
      validSequences: `${passedSequenceCount} / ${totalSequenceCount}`,
      totalRequestsSent,
      reproducibleBugBuckets: testingSummary.reproducible_bug_buckets ?? {},
    },
    requestMethodCounts: summarizeMethodCounts(availableRequests),
    requestValidityCounts: [
      { label: "Valid", count: renderedValid },
      { label: "Invalid", count: Math.max(renderedRequestsTotal - renderedValid, 0) },
    ],
    responseStatusCounts,
    bugBuckets: summarizeBugBuckets(bugsJson),
    notableFailures: buildNotableFailures(errorBuckets),
    failingSequences: observedSequences
      .filter((sequence) => sequence.outcome === "failed")
      .slice(0, 100)
      .map((sequence) => ({
        title: sequence.title,
        outcome: sequence.reason,
        requests: sequence.requests,
        reason: "Parsed from executed RESTler network logs.",
      })),
  };
}
