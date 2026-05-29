import { join, resolve } from "node:path";
import {
  buildAvailableRequests,
  collectObservedSequences,
  findLatestExperimentDir,
  readJson,
} from "./restler-artifacts.mjs";

const sbflFormulas = [
  { id: "jaccard", label: "Jaccard", description: "Penalizes requests also seen in non-failing sequences.", formulaText: "aef / (aef + anf + aep)" },
  { id: "sorensen-dice", label: "Sorensen-Dice", description: "Weights failing executions more strongly than Jaccard.", formulaText: "2aef / (2aef + anf + aep)" },
  { id: "kulczynski1", label: "Kulczynski1", description: "Focuses on failing executions against non-matching counts.", formulaText: "aef / (anf + aep)" },
  { id: "russell-rao", label: "Russell and Rao", description: "Normalizes by the entire spectrum population.", formulaText: "aef / (aef + anf + aep + anp)" },
  { id: "simple-matching", label: "Simple Matching", description: "Rewards both failing matches and passing non-matches.", formulaText: "(aef + anp) / (aef + anf + aep + anp)" },
  { id: "m1", label: "M1", description: "Contrasts suspicion against all mismatched outcomes.", formulaText: "(aef + anp) / (anf + aep)" },
  { id: "rogers-tanimoto", label: "Rogers-Tanimoto", description: "Dampens scores when mismatches dominate.", formulaText: "(aef + anp) / (aef + anp + 2(anf + aep))" },
  { id: "hamming", label: "Hamming etc.", description: "Counts agreement-style evidence directly.", formulaText: "aef + anp" },
  { id: "ochiai", label: "Ochiai", description: "Balances failed execution frequency against both passed and failed totals.", formulaText: "aef / sqrt((aef + anf)(aef + aep))" },
  { id: "tarantula", label: "Tarantula", description: "Compares the failure execution ratio against the pass execution ratio.", formulaText: "(aef/(aef+anf)) / ((aef/(aef+anf)) + (aep/(aep+anp)))" },
  { id: "ample", label: "Ample", description: "Measures the separation between failing and passing execution ratios.", formulaText: "|aef/(aef+anf) - aep/(aep+anp)|" },
  { id: "anderberg", label: "Anderberg", description: "Penalizes evidence from both failing and passing mismatches.", formulaText: "aef / (aef + 2(anf + aep))" },
  { id: "dice", label: "Dice", description: "Alternative Dice-style weighting over failing matches.", formulaText: "2aef / (aef + anf + aep)" },
  { id: "kulczynski2", label: "Kulczynski2", description: "Averages failed-vs-failed and failed-vs-passed precision terms.", formulaText: "1/2 * (aef/(aef+anf) + aef/(aef+aep))" },
  { id: "hamann", label: "Hamann", description: "Balances matching and mismatching evidence symmetrically.", formulaText: "(aef + anp - anf - aep) / (aef + anf + aep + anp)" },
  { id: "sokal", label: "Sokal", description: "Emphasizes both failing and passing agreements.", formulaText: "2(aef + anp) / (2(aef + anp) + anf + aep)" },
  { id: "m2", label: "M2", description: "A harsher mismatch-penalized alternative to M1.", formulaText: "aef / (aef + anp + 2(anf + aep))" },
  { id: "goodman", label: "Goodman", description: "Highlights contrast between failing and passing mismatches.", formulaText: "(2aef - anf - aep) / (2aef + anf + aep)" },
  { id: "euclid", label: "Euclid", description: "Distance-flavored score using matching evidence.", formulaText: "sqrt(aef + anp)" },
  { id: "overlap", label: "Overlap", description: "Looks for requests that dominate both failing and passing support sets.", formulaText: "aef / min(aef + anf, aef + aep)" },
  { id: "zoltar", label: "Zoltar", description: "Strongly penalizes requests often seen in passed sequences.", formulaText: "aef / (aef + anf + aep + 10000*anf*aep/aef)" },
  { id: "wong1", label: "Wong1", description: "Uses only failing executions as suspicion.", formulaText: "aef" },
  { id: "wong2", label: "Wong2", description: "Subtracts passing executions from failing executions.", formulaText: "aef - aep" },
  { id: "wong3", label: "Wong3", description: "Softly discounts passing executions with a piecewise penalty.", formulaText: "aef - h(aep)" },
  { id: "ochiai2", label: "Ochiai2", description: "Extends Ochiai using both positive and negative agreement terms.", formulaText: "aef*anp / sqrt((aef+aep)(anp+anf)(aef+anf)(aep+anp))" },
  { id: "geometric-mean", label: "Geometric Mean", description: "Blends positive and negative evidence geometrically.", formulaText: "(aef*anp - anf*aep) / sqrt((aef+aep)(anp+anf)(aef+anf)(aep+anp))" },
  { id: "harmonic-mean", label: "Harmonic Mean", description: "Uses harmonic-style coupling of both agreement axes.", formulaText: "((aef*anp-anf*aep)((aef+aep)(anp+anf)+(aef+anf)(aep+anp))) / ((aef+aep)(anp+anf)(aef+anf)(aep+anp))" },
  { id: "arithmetic-mean", label: "Arithmetic Mean", description: "Arithmetic blend of positive and negative correlation evidence.", formulaText: "(2aef*anp - 2anf*aep) / ((aef+aep)(anp+anf) + (aef+anf)(aep+anp))" },
  { id: "cohen", label: "Cohen", description: "Chance-corrected agreement inspired suspiciousness score.", formulaText: "(2aef*anp - 2anf*aep) / ((aef+aep)(2anp) + (aef+anf)(anf+anp))" },
  { id: "scott", label: "Scott", description: "Another agreement-corrected score using squared mismatch terms.", formulaText: "(4aef*anp - 4anf*aep - (anf-aep)^2) / ((2aef+anf+aep)(2anp+anf+aep))" },
  { id: "fleiss", label: "Fleiss", description: "Chance-adjusted suspicion score over both match classes.", formulaText: "(4aef*anp - 4anf*aep - (anf-aep)^2) / ((2aef+anf+aep) + (2anp+anf+aep))" },
  { id: "rogot1", label: "Rogot1", description: "Averages positive-match and negative-match agreement ratios.", formulaText: "1/2 * (aef/(2aef+anf+aep) + anp/(2anp+anf+aep))" },
  { id: "rogot2", label: "Rogot2", description: "A four-way average over the major support ratios.", formulaText: "1/4 * (aef/(aef+aep) + aef/(aef+anf) + anp/(anp+aep) + anp/(anp+anf))" },
];

function divide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function computeSbflScore(formula, spectrum) {
  const { aef, aep, anf, anp } = spectrum;
  const total = aef + aep + anf + anp;
  const failRate = divide(aef, aef + anf);
  const passRate = divide(aep, aep + anp);
  const covariance = aef * anp - anf * aep;
  const ochiai2Denominator = Math.sqrt(
    (aef + aep) * (anp + anf) * (aef + anf) * (aep + anp),
  );

  switch (formula) {
    case "jaccard":
      return divide(aef, aef + anf + aep);
    case "sorensen-dice":
      return divide(2 * aef, 2 * aef + anf + aep);
    case "kulczynski1":
      return divide(aef, anf + aep);
    case "russell-rao":
      return divide(aef, total);
    case "simple-matching":
      return divide(aef + anp, total);
    case "m1":
      return divide(aef + anp, anf + aep);
    case "rogers-tanimoto":
      return divide(aef + anp, aef + anp + 2 * (anf + aep));
    case "hamming":
      return aef + anp;
    case "ochiai":
      return divide(aef, Math.sqrt((aef + anf) * (aef + aep)));
    case "tarantula":
      return divide(failRate, failRate + passRate);
    case "ample":
      return Math.abs(failRate - passRate);
    case "anderberg":
      return divide(aef, aef + 2 * (anf + aep));
    case "dice":
      return divide(2 * aef, aef + anf + aep);
    case "kulczynski2":
      return 0.5 * (divide(aef, aef + anf) + divide(aef, aef + aep));
    case "hamann":
      return divide(aef + anp - anf - aep, total);
    case "sokal":
      return divide(2 * (aef + anp), 2 * (aef + anp) + anf + aep);
    case "m2":
      return divide(aef, aef + anp + 2 * (anf + aep));
    case "goodman":
      return divide(2 * aef - anf - aep, 2 * aef + anf + aep);
    case "euclid":
      return Math.sqrt(aef + anp);
    case "overlap":
      return divide(aef, Math.min(aef + anf, aef + aep));
    case "zoltar":
      return aef === 0 ? 0 : divide(aef, aef + anf + aep + (10000 * anf * aep) / aef);
    case "wong1":
      return aef;
    case "wong2":
      return aef - aep;
    case "wong3": {
      const h =
        aep <= 2 ? aep : aep <= 10 ? 2 + 0.1 * (aep - 2) : 2.8 + 0.001 * (aep - 10);
      return aef - h;
    }
    case "ochiai2":
      return divide(aef * anp, ochiai2Denominator);
    case "geometric-mean":
      return divide(covariance, ochiai2Denominator);
    case "harmonic-mean":
      return divide(
        covariance * ((aef + aep) * (anp + anf) + (aef + anf) * (aep + anp)),
        (aef + aep) * (anp + anf) * (aef + anf) * (aep + anp),
      );
    case "arithmetic-mean":
      return divide(
        2 * aef * anp - 2 * anf * aep,
        (aef + aep) * (anp + anf) + (aef + anf) * (aep + anp),
      );
    case "cohen":
      return divide(
        2 * aef * anp - 2 * anf * aep,
        (aef + aep) * (2 * anp) + (aef + anf) * (anf + anp),
      );
    case "scott":
      return divide(
        4 * aef * anp - 4 * anf * aep - (anf - aep) ** 2,
        (2 * aef + anf + aep) * (2 * anp + anf + aep),
      );
    case "fleiss":
      return divide(
        4 * aef * anp - 4 * anf * aep - (anf - aep) ** 2,
        2 * aef + anf + aep + 2 * anp + anf + aep,
      );
    case "rogot1":
      return 0.5 * (
        divide(aef, 2 * aef + anf + aep) + divide(anp, 2 * anp + anf + aep)
      );
    case "rogot2":
      return 0.25 * (
        divide(aef, aef + aep) +
        divide(aef, aef + anf) +
        divide(anp, anp + aep) +
        divide(anp, anp + anf)
      );
    default:
      return 0;
  }
}

function summarizeSpectrumNote(endpoint, failedCount, passedCount) {
  if (failedCount > 0 && passedCount === 0) {
    return "Observed only in failing sequences from current RESTler artifacts.";
  }

  if (failedCount === 0 && passedCount > 0) {
    return "Observed only in passing sequences from current RESTler artifacts.";
  }

  if (failedCount === 0 && passedCount === 0) {
    return "Present in the OpenAPI spec but not observed in the current RESTler logs.";
  }

  return "Observed in both passing and failing sequences from current RESTler artifacts.";
}

function inferSelectedExperiment(workspacePath, experimentPathInput) {
  if (!experimentPathInput) {
    return null;
  }

  return resolve(experimentPathInput);
}

function buildRiskSpectra(workspacePathInput, experimentPathInput = "", failureStatusClasses = []) {
  const workspacePath = resolve(workspacePathInput);
  const openApiSpec = readJson(join(workspacePath, "openapi.json"), { paths: {} });
  const availableRequests = buildAvailableRequests(openApiSpec);
  const endpoints = availableRequests.map((request) => `${request.method} ${request.path}`);

  const testExperimentDir = findLatestExperimentDir(join(workspacePath, "Test", "RestlerResults"));
  const fuzzExperimentDir = findLatestExperimentDir(join(workspacePath, "Fuzz", "RestlerResults"));
  const fuzzLeanExperimentDir = findLatestExperimentDir(join(workspacePath, "FuzzLean", "RestlerResults"));
  const selectedExperimentDir = inferSelectedExperiment(workspacePath, experimentPathInput);
  const observedSequences = collectObservedSequences(
    selectedExperimentDir
      ? [selectedExperimentDir]
      : [fuzzExperimentDir, fuzzLeanExperimentDir, testExperimentDir].filter(Boolean),
    availableRequests,
    failureStatusClasses,
  );

  const passSequences = observedSequences.filter((sequence) => sequence.outcome === "passed");
  const failSequenceRequests = observedSequences
    .filter((sequence) => sequence.outcome === "failed")
    .map((sequence) => sequence.normalizedRequests ?? sequence.requests);
  const passSequenceRequests = passSequences.map((sequence) => sequence.normalizedRequests ?? sequence.requests);

  const totalFailed = failSequenceRequests.length;
  const totalPassed = passSequenceRequests.length;

  return endpoints.map((endpoint) => {
    const aef = failSequenceRequests.filter((requests) => requests.includes(endpoint)).length;
    const aep = passSequenceRequests.filter((requests) => requests.includes(endpoint)).length;
    const anf = totalFailed - aef;
    const anp = totalPassed - aep;

    return {
      endpoint,
      aef,
      aep,
      anf,
      anp,
      note: summarizeSpectrumNote(endpoint, aef, aep),
    };
  });
}

export function getRiskFormulas() {
  return {
    formulas: sbflFormulas,
    defaultFormulaId: "ochiai",
  };
}

export function analyzeRisk(formulaId, workspacePath, experimentPath = "", failureStatusClasses = []) {
  const formula = sbflFormulas.find((item) => item.id === formulaId) ?? sbflFormulas[0];
  const riskSpectra = buildRiskSpectra(workspacePath, experimentPath, failureStatusClasses);
  const rankedRequests = [...riskSpectra]
    .map((item) => ({
      ...item,
      score: computeSbflScore(formula.id, item),
    }))
    .sort((left, right) => right.score - left.score || right.aef - left.aef || left.endpoint.localeCompare(right.endpoint));

  return {
    formula,
    rankedRequests,
    totalRequests: rankedRequests.length,
  };
}
