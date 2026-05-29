import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readJson, readText } from "./restler-artifacts.mjs";

const AI_BASE_URL =
  process.env.RESTLER_AI_BASE_URL ?? "https://codex.iselab.site/v1";
const AI_MODEL = process.env.RESTLER_AI_MODEL ?? "cx/gpt-5.4";
const AI_API_KEY =
  process.env.RESTLER_AI_API_KEY ??
  process.env.OPENAI_API_KEY ??
  "sk-prC2OEAfjw97t7QOh6BaIA";

function toHostPath(workspacePath, containerWorkdir, containerPath) {
  const normalizedWorkspace = resolve(workspacePath);

  if (!containerPath) {
    return normalizedWorkspace;
  }

  if (containerPath.startsWith(containerWorkdir)) {
    const relative = containerPath
      .slice(containerWorkdir.length)
      .replace(/^\/+/, "")
      .replace(/\//g, "\\");
    return resolve(normalizedWorkspace, relative);
  }

  return resolve(containerPath);
}

function summarizeSpec(openApiSpec) {
  const paths = [];

  for (const [path, pathItem] of Object.entries(openApiSpec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!operation || typeof operation !== "object") {
        continue;
      }

      paths.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId ?? "",
        summary: operation.summary ?? "",
        hasRequestBody: Boolean(operation.requestBody),
        responseCodes: Object.keys(operation.responses ?? {}),
      });
    }
  }

  return {
    title: openApiSpec.info?.title ?? "",
    version: openApiSpec.info?.version ?? "",
    operations: paths.slice(0, 80),
  };
}

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

function buildDictionaryPrompt(
  specSummary,
  rawOpenApiText,
  currentDictionaryText,
) {
  return [
    "Generate a RESTler dictionary JSON object for this API.",
    "Return JSON only. No markdown, no explanation outside JSON.",
    "The output must be a valid RESTler dictionary object.",
    "Prefer practical defaults for fuzzing this API, especially body fields, path parameters, usernames, protein IDs, request IDs, replay IDs, and auth-related inputs.",
    "Include only keys that are useful; do not invent unsupported RESTler syntax.",
    "Use both the OpenAPI summary and the full OpenAPI document below.",
    "",
    "API summary:",
    JSON.stringify(specSummary, null, 2),
    "",
    "Full openapi.json:",
    rawOpenApiText,
    "",
    currentDictionaryText ? "Current dictionary:" : "",
    currentDictionaryText || "",
    "",
    "Return one improved dictionary object.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function readDictionaryFile({
  workspacePath,
  containerWorkdir,
  dictionaryPath,
}) {
  const hostPath = toHostPath(workspacePath, containerWorkdir, dictionaryPath);
  let content = "";

  try {
    content = readFileSync(hostPath, "utf8");
  } catch {
    content =
      '{\n  "restler_custom_payload": {},\n  "restler_custom_payload_uuid4_suffix": {},\n  "restler_fuzzable_string": ["fuzzstring"]\n}';
  }

  return {
    hostPath,
    containerPath: dictionaryPath,
    content,
  };
}

export function saveDictionaryFile({
  workspacePath,
  containerWorkdir,
  dictionaryPath,
  content,
}) {
  const hostPath = toHostPath(workspacePath, containerWorkdir, dictionaryPath);
  const trimmed = String(content ?? "").trim();

  if (!trimmed) {
    throw new Error("Dictionary content is empty.");
  }

  JSON.parse(trimmed);
  mkdirSync(dirname(hostPath), { recursive: true });
  writeFileSync(hostPath, `${trimmed}\n`, "utf8");

  return {
    hostPath,
    containerPath: dictionaryPath,
    saved: true,
  };
}

export async function generateDictionaryWithAi({
  workspacePath,
  containerWorkdir,
  dictionaryPath,
  specPath,
  currentContent,
}) {
  const specHostPath = toHostPath(workspacePath, containerWorkdir, specPath);
  const openApiSpec = readJson(specHostPath, { paths: {}, info: {} });
  const specSummary = summarizeSpec(openApiSpec);
  const rawOpenApiText = readText(specHostPath, "{}");

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
              "You generate valid RESTler dictionary JSON. Return strict JSON only.",
          },
          {
            role: "user",
            content: buildDictionaryPrompt(
              specSummary,
              rawOpenApiText,
              currentContent,
            ),
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

    const dictionaryObject = extractJsonObject(content);
    return {
      model: AI_MODEL,
      content: `${JSON.stringify(dictionaryObject, null, 2)}\n`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
