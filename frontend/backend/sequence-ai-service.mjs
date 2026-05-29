import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const AI_BASE_URL =
  process.env.RESTLER_AI_BASE_URL ?? "https://codex.iselab.site/v1";
const AI_MODEL = process.env.RESTLER_AI_MODEL ?? "cx/gpt-5.4";
const AI_API_KEY = "sk-prC2OEAfjw97t7QOh6BaIA";

function extractJsonObject(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI response did not contain valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, numeric));
}

function getSequenceCacheKey(sequence) {
  return [sequence.title, sequence.outcome, ...sequence.requests].join("::");
}

function getSequenceSortCachePath(experimentPath) {
  const resolvedExperimentPath = resolve(experimentPath);
  return join(resolvedExperimentPath, "logs", "sequence_ai_sort_cache.json");
}

function readSortCache(cachePath) {
  try {
    if (!existsSync(cachePath)) {
      return {};
    }

    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
}

function writeSortCache(cachePath, cache) {
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function buildSequenceSortPrompt({ workspacePath, sequence }) {
  return [
    "You are ranking one failing RESTler sequence by how suspicious it is as a true bug signal.",
    "Return JSON only. No markdown.",
    "",
    "The JSON schema must be:",
    "{",
    '  "suspicion_score": number,',
    '  "reason": string',
    "}",
    "",
    "Rules:",
    "- suspicion_score must be between 0 and 100.",
    "- Higher means more likely to indicate a real bug worth triaging first.",
    "- Penalize obvious malformed-request noise, random invalid path values, and shallow client-side failures.",
    "- Reward crashes, 5xx patterns, stateful dependency failures, reproducibility hints, and plausible server-side faults.",
    "- reason must be short, concrete, and sequence-specific.",
    "",
    `Workspace: ${workspacePath}`,
    "Failing sequence:",
    JSON.stringify(sequence, null, 2),
  ].join("\n");
}

async function requestAiJson(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (AI_API_KEY) {
      headers.Authorization = `Bearer ${AI_API_KEY}`;
    }

    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert API fuzzing triage assistant. Return strict JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        message || `AI request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("AI response did not contain any JSON text.");
    }

    return extractJsonObject(content);
  } finally {
    clearTimeout(timeout);
  }
}

function buildAiPrompt({ workspacePath, sequence, formulaId }) {
  return [
    "You are analyzing one failing RESTler sequence from an API fuzzing run.",
    "Your task is to infer why this sequence failed and propose likely, concrete fix directions.",
    "Return JSON only. No markdown, no explanation outside JSON.",
    "",
    "The JSON schema must be:",
    "{",
    '  "summary": string,',
    '  "failure_stage": string,',
    '  "likely_causes": string[],',
    '  "suggested_fixes": string[],',
    '  "verification_steps": string[],',
    '  "suspicious_requests": string[]',
    "}",
    "",
    `Workspace: ${workspacePath}`,
    formulaId ? `Selected SBFL metric: ${formulaId}` : "",
    "Failing sequence:",
    JSON.stringify(sequence, null, 2),
    "",
    "Guidance:",
    "- failure_stage should name the most likely stage or handler where failure originates.",
    "- likely_causes should be concrete and specific to this sequence.",
    "- suggested_fixes should be practical engineering checks or code-level fix directions.",
    "- suspicious_requests should be a subset of requests from this sequence, not invented endpoints.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function analyzeSequenceWithAi({
  workspacePath,
  sequence,
  formulaId,
}) {
  const parsed = await requestAiJson(
    buildAiPrompt({ workspacePath, sequence, formulaId }),
  );

  return {
    model: AI_MODEL,
    summary: String(parsed.summary ?? "").trim(),
    failure_stage: String(parsed.failure_stage ?? "").trim(),
    likely_causes: normalizeStringArray(parsed.likely_causes),
    suggested_fixes: normalizeStringArray(parsed.suggested_fixes),
    verification_steps: normalizeStringArray(parsed.verification_steps),
    suspicious_requests: normalizeStringArray(parsed.suspicious_requests),
  };
}

export async function sortFailingSequencesWithAi({
  workspacePath,
  experimentPath,
  sequences,
}) {
  if (!experimentPath) {
    throw new Error("experimentPath is required for AI sorting.");
  }

  const cachePath = getSequenceSortCachePath(experimentPath);
  const cache = readSortCache(cachePath);
  const enrichedSequences = [];
  let updatedCache = false;

  for (const sequence of sequences) {
    const cacheKey = getSequenceCacheKey(sequence);
    const cachedEntry = cache[cacheKey];

    if (
      cachedEntry &&
      typeof cachedEntry.suspicion_score !== "undefined" &&
      typeof cachedEntry.reason === "string"
    ) {
      enrichedSequences.push({
        ...sequence,
        aiSuspicionScore: clampScore(cachedEntry.suspicion_score),
        aiSuspicionReason: String(cachedEntry.reason).trim(),
        aiSuspicionSource: "cache",
      });
      continue;
    }

    const parsed = await requestAiJson(
      buildSequenceSortPrompt({ workspacePath, sequence }),
    );
    const suspicionScore = clampScore(parsed.suspicion_score);
    const reason =
      String(parsed.reason ?? "").trim() || "AI did not provide a reason.";

    cache[cacheKey] = {
      model: AI_MODEL,
      suspicion_score: suspicionScore,
      reason,
      updated_at: new Date().toISOString(),
      title: sequence.title,
      outcome: sequence.outcome,
      requests: sequence.requests,
    };
    updatedCache = true;

    enrichedSequences.push({
      ...sequence,
      aiSuspicionScore: suspicionScore,
      aiSuspicionReason: reason,
      aiSuspicionSource: "fresh",
    });
  }

  if (updatedCache) {
    writeSortCache(cachePath, cache);
  }

  const sortedSequences = [...enrichedSequences].sort((left, right) => {
    const scoreDelta =
      (right.aiSuspicionScore ?? 0) - (left.aiSuspicionScore ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.title.localeCompare(right.title);
  });

  return {
    model: AI_MODEL,
    cachePath,
    sequences: sortedSequences,
  };
}
