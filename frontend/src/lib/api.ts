import type {
  FailingSequence,
  RankedRiskRequest,
  RestlerRunSummary,
  ResultsAnalysisSnapshot,
  SequenceAiAnalysis,
  SbflFormula,
  SbflFormulaId,
} from "./types";

type RiskFormulaResponse = {
  formulas: SbflFormula[];
  defaultFormulaId: SbflFormulaId;
};

type RiskAnalysisResponse = {
  formula: SbflFormula;
  rankedRequests: RankedRiskRequest[];
  totalRequests: number;
};

type SequenceAiAnalysisResponse = SequenceAiAnalysis;
type DictionaryFileResponse = {
  hostPath: string;
  containerPath: string;
  content: string;
};
type SaveDictionaryResponse = {
  hostPath: string;
  containerPath: string;
  saved: boolean;
};
type GenerateDictionaryResponse = {
  model: string;
  content: string;
};
type SortFailingSequencesWithAiResponse = {
  model: string;
  cachePath: string;
  sequences: FailingSequence[];
};
type RunsResponse = {
  runs: RestlerRunSummary[];
};
type OpenPathResponse = {
  opened: boolean;
  path: string;
};
type DeleteRunResponse = {
  deleted: boolean;
  path: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchRiskFormulas() {
  const response = await fetch("/api/risk/formulas");
  return parseJsonResponse<RiskFormulaResponse>(response);
}

export async function analyzeResultsArtifacts(
  workspacePath: string,
  experimentPath?: string,
  failureStatusClasses?: string[],
) {
  const response = await fetch("/api/results/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath, experimentPath, failureStatusClasses }),
  });

  return parseJsonResponse<ResultsAnalysisSnapshot>(response);
}

export async function analyzeRiskMetric(
  formulaId: SbflFormulaId,
  workspacePath: string,
  experimentPath?: string,
  failureStatusClasses?: string[],
) {
  const response = await fetch("/api/risk/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ formulaId, workspacePath, experimentPath, failureStatusClasses }),
  });

  return parseJsonResponse<RiskAnalysisResponse>(response);
}

export async function analyzeSequenceWithAi(
  workspacePath: string,
  sequence: FailingSequence,
  formulaId?: SbflFormulaId,
) {
  const response = await fetch("/api/sequences/analyze-with-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath, sequence, formulaId }),
  });

  return parseJsonResponse<SequenceAiAnalysisResponse>(response);
}

export async function readDictionaryFile(
  workspacePath: string,
  containerWorkdir: string,
  dictionaryPath: string,
) {
  const response = await fetch("/api/dictionary/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath, containerWorkdir, dictionaryPath }),
  });

  return parseJsonResponse<DictionaryFileResponse>(response);
}

export async function saveDictionaryFile(
  workspacePath: string,
  containerWorkdir: string,
  dictionaryPath: string,
  content: string,
) {
  const response = await fetch("/api/dictionary/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath, containerWorkdir, dictionaryPath, content }),
  });

  return parseJsonResponse<SaveDictionaryResponse>(response);
}

export async function generateDictionaryWithAi(
  workspacePath: string,
  containerWorkdir: string,
  dictionaryPath: string,
  specPath: string,
  currentContent: string,
) {
  const response = await fetch("/api/dictionary/generate-with-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspacePath,
      containerWorkdir,
      dictionaryPath,
      specPath,
      currentContent,
    }),
  });

  return parseJsonResponse<GenerateDictionaryResponse>(response);
}

export async function sortFailingSequencesWithAi(
  workspacePath: string,
  experimentPath: string,
) {
  const response = await fetch("/api/sequences/sort-with-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath, experimentPath }),
  });

  return parseJsonResponse<SortFailingSequencesWithAiResponse>(response);
}

export async function fetchRestlerRuns(workspacePath: string) {
  const response = await fetch("/api/runs/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath }),
  });

  return parseJsonResponse<RunsResponse>(response);
}

export async function openLocalPath(path: string) {
  const response = await fetch("/api/path/open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  return parseJsonResponse<OpenPathResponse>(response);
}

export async function deleteRestlerRun(workspacePath: string, runPath: string) {
  const response = await fetch("/api/runs/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspacePath, runPath }),
  });

  return parseJsonResponse<DeleteRunResponse>(response);
}
