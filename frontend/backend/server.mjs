import { createServer } from "node:http";
import { analyzeRisk, getRiskFormulas } from "./risk-service.mjs";
import { analyzeResults } from "./results-service.mjs";
import { analyzeSequenceWithAi, sortFailingSequencesWithAi } from "./sequence-ai-service.mjs";
import {
  generateDictionaryWithAi,
  readDictionaryFile,
  saveDictionaryFile,
} from "./dictionary-service.mjs";
import { deleteRestlerRun, listRestlerRuns, openLocalFolder } from "./runs-service.mjs";

const port = Number(process.env.RESTLER_UI_API_PORT ?? 8787);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(message);
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS") {
    sendText(response, 204, "");
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/risk/formulas") {
    sendJson(response, 200, getRiskFormulas());
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/results/analyze") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const experimentPath = typeof payload.experimentPath === "string" ? payload.experimentPath : "";
      const failureStatusClasses = Array.isArray(payload.failureStatusClasses)
        ? payload.failureStatusClasses.filter((value) => typeof value === "string")
        : [];

      if (!workspacePath) {
        sendText(response, 400, "workspacePath is required.");
        return;
      }

      sendJson(response, 200, analyzeResults(workspacePath, experimentPath, failureStatusClasses));
      return;
    } catch (error) {
      sendText(
        response,
        400,
        error instanceof Error ? error.message : "Unable to analyze RESTler artifacts.",
      );
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dictionary/read") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const containerWorkdir = typeof payload.containerWorkdir === "string" ? payload.containerWorkdir : "";
      const dictionaryPath = typeof payload.dictionaryPath === "string" ? payload.dictionaryPath : "";

      if (!workspacePath || !containerWorkdir || !dictionaryPath) {
        sendText(response, 400, "workspacePath, containerWorkdir, and dictionaryPath are required.");
        return;
      }

      sendJson(response, 200, readDictionaryFile({ workspacePath, containerWorkdir, dictionaryPath }));
      return;
    } catch (error) {
      sendText(response, 400, error instanceof Error ? error.message : "Unable to read dictionary.");
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dictionary/save") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const containerWorkdir = typeof payload.containerWorkdir === "string" ? payload.containerWorkdir : "";
      const dictionaryPath = typeof payload.dictionaryPath === "string" ? payload.dictionaryPath : "";
      const content = typeof payload.content === "string" ? payload.content : "";

      if (!workspacePath || !containerWorkdir || !dictionaryPath) {
        sendText(response, 400, "workspacePath, containerWorkdir, and dictionaryPath are required.");
        return;
      }

      sendJson(response, 200, saveDictionaryFile({
        workspacePath,
        containerWorkdir,
        dictionaryPath,
        content,
      }));
      return;
    } catch (error) {
      sendText(response, 400, error instanceof Error ? error.message : "Unable to save dictionary.");
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dictionary/generate-with-ai") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const containerWorkdir = typeof payload.containerWorkdir === "string" ? payload.containerWorkdir : "";
      const dictionaryPath = typeof payload.dictionaryPath === "string" ? payload.dictionaryPath : "";
      const specPath = typeof payload.specPath === "string" ? payload.specPath : "";
      const currentContent = typeof payload.currentContent === "string" ? payload.currentContent : "";

      if (!workspacePath || !containerWorkdir || !dictionaryPath || !specPath) {
        sendText(response, 400, "workspacePath, containerWorkdir, dictionaryPath, and specPath are required.");
        return;
      }

      sendJson(response, 200, await generateDictionaryWithAi({
        workspacePath,
        containerWorkdir,
        dictionaryPath,
        specPath,
        currentContent,
      }));
      return;
    } catch (error) {
      sendText(response, 400, error instanceof Error ? error.message : "Unable to generate dictionary with AI.");
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/runs/list") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";

      if (!workspacePath) {
        sendText(response, 400, "workspacePath is required.");
        return;
      }

      sendJson(response, 200, listRestlerRuns(workspacePath));
      return;
    } catch (error) {
      sendText(response, 400, error instanceof Error ? error.message : "Unable to list runs.");
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/path/open") {
    try {
      const payload = await readJsonBody(request);
      const path = typeof payload.path === "string" ? payload.path : "";

      if (!path) {
        sendText(response, 400, "path is required.");
        return;
      }

      sendJson(response, 200, openLocalFolder(path));
      return;
    } catch (error) {
      sendText(response, 400, error instanceof Error ? error.message : "Unable to open path.");
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/runs/delete") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const runPath = typeof payload.runPath === "string" ? payload.runPath : "";

      if (!workspacePath || !runPath) {
        sendText(response, 400, "workspacePath and runPath are required.");
        return;
      }

      sendJson(response, 200, deleteRestlerRun(workspacePath, runPath));
      return;
    } catch (error) {
      sendText(response, 400, error instanceof Error ? error.message : "Unable to delete run.");
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/risk/analyze") {
    try {
      const payload = await readJsonBody(request);
      const formulaId = typeof payload.formulaId === "string" ? payload.formulaId : "";
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const experimentPath = typeof payload.experimentPath === "string" ? payload.experimentPath : "";
      const failureStatusClasses = Array.isArray(payload.failureStatusClasses)
        ? payload.failureStatusClasses.filter((value) => typeof value === "string")
        : [];

      if (!formulaId) {
        sendText(response, 400, "formulaId is required.");
        return;
      }

      if (!workspacePath) {
        sendText(response, 400, "workspacePath is required.");
        return;
      }

      sendJson(response, 200, analyzeRisk(formulaId, workspacePath, experimentPath, failureStatusClasses));
      return;
    } catch (error) {
      sendText(
        response,
        400,
        error instanceof Error ? error.message : "Invalid JSON body.",
      );
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/sequences/analyze-with-ai") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const formulaId = typeof payload.formulaId === "string" ? payload.formulaId : "";
      const sequence = payload.sequence;

      if (!workspacePath) {
        sendText(response, 400, "workspacePath is required.");
        return;
      }

      if (
        !sequence
        || typeof sequence.title !== "string"
        || !Array.isArray(sequence.requests)
      ) {
        sendText(response, 400, "sequence is required.");
        return;
      }

      const aiAnalysis = await analyzeSequenceWithAi({
        workspacePath,
        formulaId,
        sequence,
      });

      sendJson(response, 200, aiAnalysis);
      return;
    } catch (error) {
      sendText(
        response,
        400,
        error instanceof Error ? error.message : "Unable to analyze risk with AI.",
      );
      return;
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/sequences/sort-with-ai") {
    try {
      const payload = await readJsonBody(request);
      const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath : "";
      const experimentPath = typeof payload.experimentPath === "string" ? payload.experimentPath : "";

      if (!workspacePath || !experimentPath) {
        sendText(response, 400, "workspacePath and experimentPath are required.");
        return;
      }

      const resultSnapshot = analyzeResults(workspacePath, experimentPath, ["4xx", "5xx"]);
      const sorted = await sortFailingSequencesWithAi({
        workspacePath,
        experimentPath,
        sequences: resultSnapshot.failingSequences,
      });

      sendJson(response, 200, sorted);
      return;
    } catch (error) {
      sendText(
        response,
        400,
        error instanceof Error ? error.message : "Unable to sort failing sequences with AI.",
      );
      return;
    }
  }

  sendText(response, 404, "Not found.");
});

server.listen(port, () => {
  console.log(`RESTler UI API listening on http://localhost:${port}`);
});
