import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const httpMethods = ["get", "post", "put", "delete", "patch", "options", "head"];

export function readJson(filePath, fallback) {
  try {
    if (!existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function readText(filePath, fallback = "") {
  try {
    if (!existsSync(filePath)) {
      return fallback;
    }

    return readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

export function findLatestExperimentDir(baseDir) {
  if (!existsSync(baseDir)) {
    return null;
  }

  const entries = readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("experiment"))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  return entries.length > 0 ? join(baseDir, entries[0]) : null;
}

export function buildAvailableRequests(openApiSpec) {
  const requests = [];

  for (const [path, pathItem] of Object.entries(openApiSpec.paths ?? {})) {
    for (const method of httpMethods) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }

      requests.push({
        method: method.toUpperCase(),
        path,
        auth: Array.isArray(operation.security) && operation.security.length > 0,
      });
    }
  }

  return requests;
}

function normalizePathForMatch(path) {
  return path.split("?")[0].trim();
}

function buildTemplateRegex(templatePath) {
  const escaped = templatePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\\\{[^}]+\\\}/g, "[^/]+")}$`);
}

export function normalizeRequestToSpec(requestLine, availableRequests) {
  const trimmed = requestLine.trim();
  const firstSpace = trimmed.indexOf(" ");

  if (firstSpace === -1) {
    return trimmed;
  }

  const method = trimmed.slice(0, firstSpace).toUpperCase();
  const requestPath = normalizePathForMatch(trimmed.slice(firstSpace + 1));

  for (const request of availableRequests) {
    if (request.method !== method) {
      continue;
    }

    if (buildTemplateRegex(request.path).test(requestPath)) {
      return `${method} ${request.path}`;
    }
  }

  return `${method} ${requestPath}`;
}

function parseReplaySequence(content, fileName) {
  const requestLines = [...content.matchAll(/->\s+([A-Z]+)\s+([^\s]+)\s+HTTP\/1\.1/g)]
    .map((match) => `${match[1]} ${match[2]}`);
  const responseMatch = content.match(/PREVIOUS RESPONSE:\s+'HTTP\/1\.1\s+(\d+)\s+([^\\']+)/);
  const headerMatch = content.match(/^\s*([A-Za-z0-9_]+)\s*$/m);

  if (requestLines.length === 0) {
    return null;
  }

  const title = headerMatch?.[1]?.replaceAll("_", " ") ?? fileName.replace(".replay.txt", "");
  const statusCode = responseMatch?.[1] ?? "Unknown";
  const statusText = responseMatch?.[2]?.trim() ?? "Captured response";
  const replayName = fileName.replace(".replay.txt", "");

  return {
    title,
    outcome: `${statusCode} ${statusText}`.trim(),
    requests: requestLines,
    reason: `Parsed from replay log ${replayName}.`,
  };
}

function parseCoverageFailures(content) {
  const sections = content.split("-----------------------------------------------").map((section) => section.trim());
  const sequences = [];

  for (const section of sections) {
    if (!section.startsWith("Request:")) {
      continue;
    }

    const requestMatch = section.match(/^Request:\s+(.+)$/m);
    const blockedMatch = section.match(/Number of blocked dependent requests:\s+(\d+)/);
    const requestLines = [...section.matchAll(/>\s+([A-Z]+)\s+([^\s]+)\s+HTTP\/1\.1/g)]
      .map((match) => `${match[1]} ${match[2]}`);
    const responseLine = section.match(/<\s+HTTP\/1\.1\s+(\d+)\s+([^\r\n]+)/);
    const bodyLine = section.match(/\{"detail".+\}|\{"detail":"[^"]+"\}/);

    if (!requestMatch || requestLines.length === 0) {
      continue;
    }

    sequences.push({
      title: requestMatch[1],
      outcome: responseLine ? `${responseLine[1]} ${responseLine[2]}` : "Failure captured",
      requests: [...new Set(requestLines)],
      reason: [
        blockedMatch ? `${blockedMatch[1]} dependent requests were blocked.` : null,
        bodyLine ? bodyLine[0] : null,
      ].filter(Boolean).join(" "),
    });
  }

  return sequences;
}

export function collectFailingSequences(workspacePath, testExperimentDir, fuzzExperimentDir, availableRequests = []) {
  const sequences = [];
  const replayDirs = [
    join(testExperimentDir ?? "", "bug_buckets"),
    join(fuzzExperimentDir ?? "", "bug_buckets"),
  ].filter((value) => value && existsSync(value));

  for (const replayDir of replayDirs) {
    const replayFiles = readdirSync(replayDir)
      .filter((file) => file.endsWith(".replay.txt"))
      .sort();

    for (const replayFile of replayFiles) {
      const parsed = parseReplaySequence(readText(join(replayDir, replayFile)), replayFile);
      if (parsed) {
        sequences.push({
          ...parsed,
          requests: parsed.requests.map((request) => normalizeRequestToSpec(request, availableRequests)),
        });
      }
    }
  }

  const coverageFile = join(workspacePath, "Test", "coverage_failures_to_investigate.txt");
  const coverageSequences = parseCoverageFailures(readText(coverageFile))
    .map((sequence) => ({
      ...sequence,
      requests: sequence.requests.map((request) => normalizeRequestToSpec(request, availableRequests)),
    }));
  sequences.push(...coverageSequences);

  const deduped = [];
  const seen = new Set();

  for (const sequence of sequences) {
    const key = `${sequence.title}|${sequence.requests.join(">")}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(sequence);
  }

  return deduped;
}

function collectNetworkLogPaths(experimentDirs) {
  const files = [];
  for (const experimentDir of experimentDirs) {
    const logsDir = join(experimentDir, "logs");
    if (!existsSync(logsDir)) {
      continue;
    }

    for (const entry of readdirSync(logsDir)) {
      if (entry.startsWith("network.testing.") && entry.endsWith(".txt")) {
        files.push(join(logsDir, entry));
      }
    }
  }

  return files;
}

export function collectResponseStatusCountsFromLogs(experimentDirs) {
  const counts = new Map();

  for (const logPath of collectNetworkLogPaths(
    experimentDirs.map((dir) => resolve(dir)).filter(Boolean),
  )) {
    const content = readText(logPath);
    const matches = [...content.matchAll(/Received:\s+'HTTP\/1\.1\s+(\d+)\s+/g)];

    for (const match of matches) {
      const code = match[1];
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => Number(left.code) - Number(right.code));
}

function normalizeFailureStatusClasses(failureStatusClasses = []) {
  const classes = new Set(
    Array.isArray(failureStatusClasses)
      ? failureStatusClasses.filter((value) => value === "4xx" || value === "5xx")
      : [],
  );

  if (classes.size === 0) {
    classes.add("5xx");
  }

  return classes;
}

function classifySequenceOutcome(responses, sawTransportFailure, transportMessages, failureStatusClasses) {
  if (sawTransportFailure || responses.length === 0) {
    return "failed";
  }

  const statusCodes = responses
    .map((response) => Number.parseInt(response.statusCode, 10))
    .filter((code) => Number.isFinite(code));

  if (statusCodes.length === 0) {
    return "failed";
  }

  const enabledClasses = normalizeFailureStatusClasses(failureStatusClasses);

  if (enabledClasses.has("5xx") && statusCodes.some((code) => code >= 500 || code === 0)) {
    return "failed";
  }

  if (enabledClasses.has("4xx") && statusCodes.some((code) => code >= 400 && code < 500)) {
    return "failed";
  }

  return "passed";
}

function summarizeFailureOutcome(responses, sawTransportFailure, transportMessages) {
  if (transportMessages.length > 0) {
    const lastTransportMessage = transportMessages[transportMessages.length - 1];
    const invalidHttpMatch = lastTransportMessage.match(/Invalid HTTP request received\.?/i);
    if (invalidHttpMatch) {
      return "Transport error: Invalid HTTP request received.";
    }

    const emptyResponseMatch = lastTransportMessage.match(/Empty response received/i);
    if (emptyResponseMatch) {
      return "Transport error: Empty response received.";
    }

    const failedReceiveMatch = lastTransportMessage.match(/Failed to receive response/i);
    if (failedReceiveMatch) {
      return "Transport error: Failed to receive response.";
    }

    const parserExceptionMatch = lastTransportMessage.match(/Parser exception:/i);
    if (parserExceptionMatch) {
      return "Transport error: Parser exception.";
    }

    const unknownErrorMatch = lastTransportMessage.match(/Unknown error:/i);
    if (unknownErrorMatch) {
      return "Transport error: Unknown error.";
    }

    return "Transport error.";
  }

  const lastResponse = responses[responses.length - 1];
  if (!lastResponse) {
    return sawTransportFailure ? "Transport failure" : "No response captured";
  }

  return `${lastResponse.statusCode} ${lastResponse.statusText}`.trim();
}

export function collectObservedSequences(experimentDirs, availableRequests, failureStatusClasses = []) {
  const normalizedKnownRequests = new Set(
    availableRequests.map((request) => `${request.method} ${request.path}`),
  );
  const sequences = [];

  for (const logPath of collectNetworkLogPaths(
    experimentDirs.map((dir) => resolve(dir)).filter(Boolean),
  )) {
    const content = readText(logPath);
    const lines = content.split(/\r?\n/);
    let current = null;

    for (const line of lines) {
      const generationMatch = line.match(/^Generation-\d+:\s+Rendering Sequence-\d+/);
      if (generationMatch) {
        if (current && current.requests.length > 0) {
          current.outcome = classifySequenceOutcome(
            current.responses,
            current.sawTransportFailure,
            current.transportMessages,
            failureStatusClasses,
          );
          sequences.push(current);
        }

        current = {
          title: generationMatch[0],
          requests: [],
          normalizedRequests: [],
          responses: [],
          sawTransportFailure: false,
          transportMessages: [],
          inCheckerPhase: false,
        };
        continue;
      }

      if (!current) {
        continue;
      }

      if (line.includes("Checker:")) {
        current.inCheckerPhase = true;
        continue;
      }

      const sendingMatch = line.match(/Sending:\s+'([A-Z]+)\s+([^\s]+)\s+HTTP\/1\.1/);
      if (sendingMatch && !current.inCheckerPhase) {
        const rawRequest = `${sendingMatch[1]} ${sendingMatch[2]}`;
        const normalized = normalizeRequestToSpec(`${sendingMatch[1]} ${sendingMatch[2]}`, availableRequests);
        if (normalizedKnownRequests.has(normalized)) {
          current.requests.push(rawRequest);
          current.normalizedRequests.push(normalized);
        }
        continue;
      }

      const receivedMatch = line.match(/Received:\s+'HTTP\/1\.1\s+(\d+)\s+([^\\']+)/);
      if (receivedMatch && !current.inCheckerPhase) {
        current.responses.push({
          statusCode: receivedMatch[1],
          statusText: receivedMatch[2].trim(),
        });
        continue;
      }

      if (
        line.includes("Failed to receive response")
        || line.includes("Invalid HTTP request received")
        || line.includes("Unknown error:")
        || line.includes("Parser exception:")
      ) {
        current.sawTransportFailure = true;
        current.transportMessages.push(line.trim());
      }
    }

    if (current && current.requests.length > 0) {
      current.outcome = classifySequenceOutcome(
        current.responses,
        current.sawTransportFailure,
        current.transportMessages,
        failureStatusClasses,
      );
      sequences.push(current);
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const sequence of sequences) {
    const uniqueRawRequests = [...new Set(sequence.requests)];
    const uniqueNormalizedRequests = [...new Set(sequence.normalizedRequests ?? [])];
    if (uniqueRawRequests.length === 0 || uniqueNormalizedRequests.length === 0) {
      continue;
    }

    const key = `${sequence.outcome}|${uniqueRawRequests.join(">")}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({
      title: uniqueNormalizedRequests[uniqueNormalizedRequests.length - 1] ?? sequence.title,
      requests: uniqueRawRequests,
      normalizedRequests: uniqueNormalizedRequests,
      outcome: sequence.outcome,
      reason: summarizeFailureOutcome(
        sequence.responses,
        sequence.sawTransportFailure,
        sequence.transportMessages ?? [],
      ),
    });
  }

  return deduped;
}
