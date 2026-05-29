import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { buildAvailableRequests, collectObservedSequences, readJson } from "./restler-artifacts.mjs";

const runKinds = [
  { dirName: "Fuzz", kind: "fuzz" },
  { dirName: "FuzzLean", kind: "fuzz-lean" },
  { dirName: "Test", kind: "test" },
];

function toLocalTimestamp(timestampMs) {
  const date = new Date(timestampMs);
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function readRunSummary(experimentDir) {
  return readJson(join(experimentDir, "logs", "testing_summary.json"), {});
}

function summarizeBugBuckets(experimentDir) {
  const bugsJson = readJson(join(experimentDir, "bug_buckets", "Bugs.json"), { bugs: [] });
  const grouped = new Map();

  for (const bug of bugsJson.bugs ?? []) {
    const key = `${bug.checker_name}_${bug.error_code}`;
    grouped.set(key, {
      name: key,
      count: (grouped.get(key)?.count ?? 0) + 1,
    });
  }

  return [...grouped.values()].sort((left, right) => right.count - left.count);
}

function ensureInsideWorkspace(workspacePath, targetPath) {
  const workspaceRoot = resolve(workspacePath);
  const resolvedTarget = resolve(targetPath);
  const relativeTarget = relative(workspaceRoot, resolvedTarget);

  if (
    relativeTarget.startsWith("..")
    || relativeTarget.includes(":")
    || relativeTarget === ""
  ) {
    throw new Error("Target path is outside the selected workspace.");
  }

  return resolvedTarget;
}

export function listRestlerRuns(workspacePathInput) {
  const workspacePath = resolve(workspacePathInput);
  const openApiSpec = readJson(join(workspacePath, "openapi.json"), { paths: {} });
  const availableRequests = buildAvailableRequests(openApiSpec);
  const runs = [];

  for (const runKind of runKinds) {
    const resultsRoot = join(workspacePath, runKind.dirName, "RestlerResults");
    if (!existsSync(resultsRoot)) {
      continue;
    }

    const experimentNames = readdirSync(resultsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("experiment"))
      .map((entry) => entry.name);

    for (const experimentName of experimentNames) {
      const experimentDir = join(resultsRoot, experimentName);
      const summary = readRunSummary(experimentDir);
      const summaryPath = join(experimentDir, "logs", "testing_summary.json");
      const timeSourcePath = existsSync(summaryPath) ? summaryPath : experimentDir;
      const stats = statSync(timeSourcePath);
      const bugBuckets = summarizeBugBuckets(experimentDir);
      const observedSequences = collectObservedSequences([experimentDir], availableRequests, ["5xx"]);
      const passedSequenceCount = observedSequences.filter((sequence) => sequence.outcome === "passed").length;
      const totalSequenceCount = observedSequences.length;

      runs.push({
        id: `${runKind.kind}:${experimentName}`,
        kind: runKind.kind,
        experimentName,
        reportName: `${runKind.kind.toUpperCase()} Report ${toLocalTimestamp(stats.mtimeMs)}`,
        path: experimentDir,
        createdAt: toLocalTimestamp(stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs),
        updatedAt: toLocalTimestamp(stats.mtimeMs),
        requestCoverage: summary.final_spec_coverage ?? "0 / 0",
        renderedRequests: summary.rendered_requests ?? "0 / 0",
        validSequences: `${passedSequenceCount} / ${totalSequenceCount}`,
        totalRequestsSent: summary.total_requests_sent?.main_driver ?? 0,
        bugBucketCount: bugBuckets.reduce((total, item) => total + item.count, 0),
        bugBuckets,
      });
    }
  }

  runs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { runs };
}

export function openLocalFolder(targetPath) {
  const resolvedTarget = resolve(targetPath);

  if (!existsSync(resolvedTarget)) {
    throw new Error("The requested path does not exist.");
  }

  const child = spawn("explorer.exe", [resolvedTarget], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return {
    opened: true,
    path: resolvedTarget,
  };
}

export function deleteRestlerRun(workspacePathInput, runPathInput) {
  const workspacePath = resolve(workspacePathInput);
  const runPath = ensureInsideWorkspace(workspacePath, runPathInput);

  if (!existsSync(runPath)) {
    throw new Error("Run path does not exist.");
  }

  rmSync(runPath, { recursive: true, force: true });
  return {
    deleted: true,
    path: runPath,
  };
}
