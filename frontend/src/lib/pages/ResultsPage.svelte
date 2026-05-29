<script lang="ts">
  import { onMount } from "svelte";
  import {
    analyzeResultsArtifacts,
    analyzeRiskMetric,
    analyzeSequenceWithAi,
    deleteRestlerRun,
    fetchRestlerRuns,
    fetchRiskFormulas,
    openLocalPath,
    sortFailingSequencesWithAi as sortFailingSequencesWithAiRequest,
  } from "../api";
  import SectionCard from "../components/common/SectionCard.svelte";
  import { expectedResultFiles, restlerConfig, selectedModeMeta, updateConfigField } from "../state";
  import type {
    FailingSequence,
    RankedRiskRequest,
    RestlerRunSummary,
    ResultsAnalysisSnapshot,
    SbflFormula,
    SequenceAiAnalysis,
  } from "../types";

  let showAnalysisPreview = false;
  let showRiskModal = false;
  let showRiskAssessmentResults = false;
  let selectedFormula = "ochiai";
  let pendingFormula = selectedFormula;
  let riskFormulas: SbflFormula[] = [];
  let rankedRiskRequests: RankedRiskRequest[] = [];
  let totalRiskRequests = 0;
  let appliedFormula: SbflFormula | null = null;
  let analysisSnapshot: ResultsAnalysisSnapshot | null = null;
  let isLoadingRiskFormulas = false;
  let isRunningRiskAssessment = false;
  let isRunningResultAnalysis = false;
  let riskApiError = "";
  let resultApiError = "";
  let runsApiError = "";
  let selectedRunId = "";
  let selectedRunPath = "";
  let restlerRuns: RestlerRunSummary[] = [];
  let isLoadingRuns = false;
  let deletingRunPath: string | null = null;
  let include4xxFailures = false;
  let include5xxFailures = true;
  let isSortingFailingSequencesWithAi = false;
  let sortFailingSequencesAiError = "";
  let sortFailingSequencesAiStatus = "";
  let sequenceAiLoadingKey: string | null = null;
  let sequenceAiErrorByKey: Record<string, string> = {};
  let sequenceAiResultByKey: Record<string, SequenceAiAnalysis> = {};
  let expandedStepKeys: Record<string, boolean> = {};

  function splitRequestStep(step: string) {
    const trimmed = step.trim();
    const firstSpaceIndex = trimmed.indexOf(" ");

    if (firstSpaceIndex === -1) {
      return {
        method: trimmed,
        target: "",
      };
    }

    return {
      method: trimmed.slice(0, firstSpaceIndex),
      target: trimmed.slice(firstSpaceIndex + 1),
    };
  }

  function isLongSequenceStep(step: string) {
    return splitRequestStep(step).target.length > 180;
  }

  function getSequenceKey(sequence: FailingSequence) {
    return [sequence.title, sequence.outcome, ...sequence.requests].join("::");
  }

  function getSequenceStepKey(sequence: FailingSequence, stepIndex: number) {
    return `${getSequenceKey(sequence)}::${stepIndex}`;
  }

  function isExpandedStep(sequence: FailingSequence, stepIndex: number) {
    return expandedStepKeys[getSequenceStepKey(sequence, stepIndex)] ?? false;
  }

  function toggleExpandedStep(sequence: FailingSequence, stepIndex: number) {
    const stepKey = getSequenceStepKey(sequence, stepIndex);
    expandedStepKeys = {
      ...expandedStepKeys,
      [stepKey]: !expandedStepKeys[stepKey],
    };
  }

  function resetSequenceAnalysisState() {
    isSortingFailingSequencesWithAi = false;
    sortFailingSequencesAiError = "";
    sortFailingSequencesAiStatus = "";
    sequenceAiLoadingKey = null;
    sequenceAiErrorByKey = {};
    sequenceAiResultByKey = {};
    expandedStepKeys = {};
  }

  function toggleRunSelection(run: RestlerRunSummary) {
    const isSameRun = selectedRunId === run.id;
    selectedRunId = isSameRun ? "" : run.id;
    selectedRunPath = isSameRun ? "" : run.path;
  }

  async function refreshRuns() {
    isLoadingRuns = true;
    runsApiError = "";

    try {
      const response = await fetchRestlerRuns($restlerConfig.resultsRootPath);
      restlerRuns = response.runs;

      if (selectedRunPath) {
        const stillExists = response.runs.find((run) => run.path === selectedRunPath);
        if (!stillExists) {
          selectedRunId = "";
          selectedRunPath = "";
        }
      }
    } catch (error) {
      runsApiError = error instanceof Error ? error.message : "Unable to load RESTler runs.";
    } finally {
      isLoadingRuns = false;
    }
  }

  async function openResultsRoot() {
    const target = $restlerConfig.resultsRootPath?.trim();
    if (!target) {
      window.alert("Results root folder is empty.");
      return;
    }

    try {
      await openLocalPath(target);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to open the results folder.");
    }
  }

  async function analyzeResults() {
    showRiskModal = false;
    showRiskAssessmentResults = false;
    resultApiError = "";
    resetSequenceAnalysisState();

    if (showAnalysisPreview) {
      showAnalysisPreview = false;
      return;
    }

    isRunningResultAnalysis = true;

    try {
      analysisSnapshot = await analyzeResultsArtifacts(
        $restlerConfig.resultsRootPath,
        selectedRunPath || undefined,
        selectedFailureStatusClasses,
      );
      showAnalysisPreview = true;
    } catch (error) {
      resultApiError = error instanceof Error ? error.message : "Unable to analyze RESTler results.";
      showAnalysisPreview = false;
    } finally {
      isRunningResultAnalysis = false;
    }
  }

  async function loadRiskFormulas() {
    isLoadingRiskFormulas = true;
    riskApiError = "";

    try {
      const response = await fetchRiskFormulas();
      riskFormulas = response.formulas;
      selectedFormula = response.defaultFormulaId;
      pendingFormula = response.defaultFormulaId;
      appliedFormula =
        response.formulas.find((formula) => formula.id === response.defaultFormulaId) ?? response.formulas[0] ?? null;
    } catch (error) {
      riskApiError = error instanceof Error ? error.message : "Unable to load risk formulas.";
    } finally {
      isLoadingRiskFormulas = false;
    }
  }

  async function openRiskAssessmentModal() {
    if (riskFormulas.length === 0 && !isLoadingRiskFormulas) {
      await loadRiskFormulas();
    }

    if (riskFormulas.length === 0) {
      return;
    }

    showAnalysisPreview = false;
    pendingFormula = selectedFormula;
    showRiskModal = true;
  }

  function closeRiskAssessmentModal() {
    showRiskModal = false;
  }

  async function applyRiskAssessment() {
    if (!pendingFormula) {
      return;
    }

    isRunningRiskAssessment = true;
    riskApiError = "";

    try {
      const response = await analyzeRiskMetric(
        pendingFormula,
        $restlerConfig.resultsRootPath,
        selectedRunPath || undefined,
        selectedFailureStatusClasses,
      );
      selectedFormula = pendingFormula;
      appliedFormula = response.formula;
      rankedRiskRequests = response.rankedRequests;
      totalRiskRequests = response.totalRequests;
      showAnalysisPreview = false;
      showRiskAssessmentResults = true;
      showRiskModal = false;
      resetSequenceAnalysisState();
    } catch (error) {
      riskApiError = error instanceof Error ? error.message : "Unable to analyze the selected metric.";
    } finally {
      isRunningRiskAssessment = false;
    }
  }

  async function copySequence(sequence: FailingSequence) {
    const lines = sequence.requests.map((request, index) => `${index + 1}. ${request}`);
    const payload = `${sequence.title}\n${sequence.outcome}\n\n${lines.join("\n")}\n\n${sequence.reason}`;
    await navigator.clipboard.writeText(payload);
  }

  async function openRunFolder(run: RestlerRunSummary) {
    try {
      await openLocalPath(run.path);
    } catch (error) {
      runsApiError = error instanceof Error ? error.message : "Unable to open the selected run folder.";
    }
  }

  async function removeRun(run: RestlerRunSummary) {
    const confirmed = window.confirm(`Delete ${run.reportName}?`);
    if (!confirmed) {
      return;
    }

    deletingRunPath = run.path;
    runsApiError = "";

    try {
      await deleteRestlerRun($restlerConfig.resultsRootPath, run.path);

      if (selectedRunPath === run.path) {
        selectedRunId = "";
        selectedRunPath = "";
        showAnalysisPreview = false;
        showRiskAssessmentResults = false;
        analysisSnapshot = null;
      }

      await refreshRuns();
    } catch (error) {
      runsApiError = error instanceof Error ? error.message : "Unable to delete the selected run.";
    } finally {
      deletingRunPath = null;
    }
  }

  async function runSequenceAiAnalysis(sequence: FailingSequence) {
    const sequenceKey = getSequenceKey(sequence);
    sequenceAiLoadingKey = sequenceKey;
    sequenceAiErrorByKey = {
      ...sequenceAiErrorByKey,
      [sequenceKey]: "",
    };

    try {
      const analysis = await analyzeSequenceWithAi(
        $restlerConfig.resultsRootPath,
        sequence,
        selectedFormula,
      );

      sequenceAiResultByKey = {
        ...sequenceAiResultByKey,
        [sequenceKey]: analysis,
      };
    } catch (error) {
      sequenceAiErrorByKey = {
        ...sequenceAiErrorByKey,
        [sequenceKey]: error instanceof Error ? error.message : "Unable to analyze this sequence with AI.",
      };
    } finally {
      sequenceAiLoadingKey = null;
    }
  }

  async function sortFailingSequencesByAi() {
    const experimentPath = selectedRunPath || analysisSnapshot?.generatedFrom || "";
    if (!analysisSnapshot || !experimentPath) {
      sortFailingSequencesAiError = "Select and analyze a report before using AI sorting.";
      return;
    }

    isSortingFailingSequencesWithAi = true;
    sortFailingSequencesAiError = "";
    sortFailingSequencesAiStatus = "";

    try {
      const response = await sortFailingSequencesWithAiRequest(
        $restlerConfig.resultsRootPath,
        experimentPath,
      );

      analysisSnapshot = {
        ...analysisSnapshot,
        failingSequences: response.sequences,
      };
      sortFailingSequencesAiStatus = `AI ranking ready. Cache saved at ${response.cachePath}.`;
    } catch (error) {
      sortFailingSequencesAiError =
        error instanceof Error ? error.message : "Unable to sort failing sequences with AI.";
    } finally {
      isSortingFailingSequencesWithAi = false;
    }
  }

  function onFormulaSelectionChange(event: Event) {
    pendingFormula = (event.currentTarget as HTMLSelectElement).value;
  }

  onMount(() => {
    void loadRiskFormulas();
    void refreshRuns();
  });

  $: selectedFailureStatusClasses = [
    include4xxFailures ? "4xx" : "",
    include5xxFailures ? "5xx" : "",
  ].filter(Boolean);
  $: selectedRun = restlerRuns.find((run) => run.id === selectedRunId) ?? null;
  $: selectedFormulaMeta =
    riskFormulas.find((formula) => formula.id === selectedFormula) ?? appliedFormula ?? null;
  $: pendingFormulaMeta =
    riskFormulas.find((formula) => formula.id === pendingFormula) ?? selectedFormulaMeta;
</script>

<div class="grid gap-6">
  <section class="space-y-4">
      <label class="block">
        <span class="field-label">Results root folder</span>
        <input
          value={$restlerConfig.resultsRootPath}
          class="field-input"
          on:input={(event) =>
            updateConfigField("resultsRootPath", (event.currentTarget as HTMLInputElement).value)}
        />
        <span class="mt-2 block text-sm leading-6 text-stone-500">
          Choose a real RESTler report below or leave it empty to analyze the latest artifacts automatically.
        </span>
      </label>

      <div class="border border-stone-200 bg-stone-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-stone-900">Available reports</p>
            <p class="mt-1 text-sm leading-6 text-stone-600">
              Each report name uses the run timestamp so you can quickly spot the right execution.
            </p>
          </div>
          <button
            class="border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
            on:click={refreshRuns}
            disabled={isLoadingRuns}
          >
            {isLoadingRuns ? "Refreshing..." : "Refresh runs"}
          </button>
        </div>

        {#if runsApiError}
          <p class="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {runsApiError}
          </p>
        {/if}

        {#if restlerRuns.length === 0}
          <p class="mt-4 border border-dashed border-stone-300 bg-white px-4 py-4 text-sm leading-6 text-stone-600">
            No RESTler reports were found under this workspace yet.
          </p>
        {:else}
          <div class="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {#each restlerRuns as run}
              <article class={`border px-4 py-4 transition ${selectedRunId === run.id ? "border-cyan-500 bg-cyan-50" : "border-stone-200 bg-white"}`}>
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="text-sm font-semibold text-stone-950">{run.reportName}</h4>
                      <span class="border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-700">
                        {run.kind}
                      </span>
                    </div>
                    <p class="mt-2 text-sm leading-6 text-stone-600">{run.experimentName}</p>
                    <p class="text-sm leading-6 text-stone-500">Updated: {run.updatedAt}</p>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <button
                      class="border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                      on:click={() => toggleRunSelection(run)}
                    >
                      {selectedRunId === run.id ? "Hide" : "View"}
                    </button>
                    <button
                      class="border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                      on:click={() => openRunFolder(run)}
                    >
                      Open folder
                    </button>
                    <button
                      class="border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      on:click={() => removeRun(run)}
                      disabled={deletingRunPath === run.path}
                    >
                      {deletingRunPath === run.path ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                {#if selectedRunId === run.id}
                  <div class="mt-4 grid gap-3 md:grid-cols-4">
                    <div class="bg-stone-50 px-3 py-3">
                      <p class="text-xs uppercase tracking-[0.16em] text-stone-500">Coverage</p>
                      <p class="mt-2 text-lg font-semibold text-stone-950">{run.requestCoverage}</p>
                    </div>
                    <div class="bg-stone-50 px-3 py-3">
                      <p class="text-xs uppercase tracking-[0.16em] text-stone-500">Rendered</p>
                      <p class="mt-2 text-lg font-semibold text-stone-950">{run.renderedRequests}</p>
                    </div>
                    <div class="bg-stone-50 px-3 py-3">
                      <p class="text-xs uppercase tracking-[0.16em] text-stone-500">Valid sequences</p>
                      <p class="mt-2 text-lg font-semibold text-stone-950">{run.validSequences}</p>
                    </div>
                    <div class="bg-stone-50 px-3 py-3">
                      <p class="text-xs uppercase tracking-[0.16em] text-stone-500">Bug buckets</p>
                      <p class="mt-2 text-lg font-semibold text-stone-950">{run.bugBucketCount}</p>
                    </div>
                  </div>

                  <p class="mt-4 break-all border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                    Path: <span class="font-medium text-stone-900">{run.path}</span>
                  </p>

                  {#if run.bugBuckets.length > 0}
                    <div class="mt-4 flex flex-wrap gap-2">
                      {#each run.bugBuckets as bucket}
                        <span class="result-chip">{bucket.name}: {bucket.count}</span>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </article>
            {/each}
          </div>
        {/if}
      </div>

      <div class="grid gap-3 lg:grid-cols-3">
        <button
          class="bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          on:click={analyzeResults}
          disabled={isRunningResultAnalysis}
        >
          {isRunningResultAnalysis ? "Analyzing..." : "Analyze results"}
        </button>
        <button
          class="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          on:click={openResultsRoot}
        >
          Open result paths
        </button>
        <button
          class="border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
          on:click={openRiskAssessmentModal}
        >
          Risk assessment
        </button>
      </div>

      <div class="border border-stone-200 bg-stone-50 p-4">
        <p class="text-sm font-semibold text-stone-900">Sequence failure rule</p>
        <p class="mt-1 text-sm leading-6 text-stone-600">
          Choose which HTTP classes should count as failing sequences. Transport errors still count as failures automatically.
        </p>

        <div class="mt-4 flex flex-wrap gap-4">
          <label class="flex items-center gap-3 border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800">
            <input
              bind:checked={include4xxFailures}
              class="h-4 w-4 accent-cyan-700"
              type="checkbox"
            />
            <span>Include 4xx</span>
          </label>

          <label class="flex items-center gap-3 border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800">
            <input
              bind:checked={include5xxFailures}
              class="h-4 w-4 accent-cyan-700"
              type="checkbox"
            />
            <span>Include 5xx</span>
          </label>
        </div>

        <p class="mt-3 text-sm leading-6 text-stone-500">
          Active rule:
          <span class="font-medium text-stone-900">
            {selectedFailureStatusClasses.length > 0 ? selectedFailureStatusClasses.join(", ") : "Transport errors only"}
          </span>
        </p>
      </div>

      {#if resultApiError}
        <p class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {resultApiError}
        </p>
      {/if}

      {#if riskApiError}
        <p class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {riskApiError}
        </p>
      {/if}

      {#if showAnalysisPreview && analysisSnapshot}
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Coverage</p>
            <p class="mt-2 text-2xl font-semibold text-stone-950">
              {analysisSnapshot.testSummary.finalSpecCoverage}
            </p>
          </div>
          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Rendered</p>
            <p class="mt-2 text-2xl font-semibold text-stone-950">
              {analysisSnapshot.testSummary.renderedRequests}
            </p>
          </div>
          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Valid sequences</p>
            <p class="mt-2 text-2xl font-semibold text-stone-950">
              {analysisSnapshot.testSummary.validSequences}
            </p>
          </div>
          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Sent requests</p>
            <p class="mt-2 text-2xl font-semibold text-stone-950">
              {analysisSnapshot.testSummary.totalRequestsSent}
            </p>
          </div>
        </div>
      {/if}
  </section>

  {#if showRiskAssessmentResults}
    <SectionCard
      eyebrow="SBFL"
      title="Sequence-based risk assessment"
      description="Treat each RESTler sequence as a test case and rank suspicious requests instead of source lines."
    >
      <div class="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="rounded-2xl bg-stone-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Applied metric</p>
              <p class="mt-2 text-base font-semibold text-stone-950">
                {selectedFormulaMeta?.label ?? "Not selected"}
              </p>
            </div>
            <button
              class="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
              on:click={openRiskAssessmentModal}
            >
              Change metric
            </button>
          </div>

          <div class="rounded-2xl border border-stone-200 bg-white px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Requests ranked</p>
            <p class="mt-2 text-2xl font-semibold text-stone-950">{totalRiskRequests || rankedRiskRequests.length}</p>
            <p class="mt-2 text-sm leading-6 text-stone-600">
              All discovered RESTler requests are included in the ranking. The list on the right scrolls if it grows long.
            </p>
          </div>

          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-sm font-semibold text-stone-900">{selectedFormulaMeta?.label ?? "Unknown metric"}</p>
            <p class="mt-2 text-sm leading-6 text-stone-600">
              {selectedFormulaMeta?.description ?? "No description available."}
            </p>
            <p class="mt-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 font-mono text-xs text-stone-700">
              {selectedFormulaMeta?.formulaText ?? "-"}
            </p>
          </div>

          <div class="rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm leading-6 text-stone-600">
            <p class="font-semibold text-stone-900">Spectrum terms</p>
            <ul class="mt-3 space-y-2">
              <li><strong>`aef`</strong>: request executed by failed sequences</li>
              <li><strong>`aep`</strong>: request executed by passed sequences</li>
              <li><strong>`anf`</strong>: request not executed by failed sequences</li>
              <li><strong>`anp`</strong>: request not executed by passed sequences</li>
            </ul>
            <p class="mt-3">
              In this UI, a RESTler sequence is the test case and a request endpoint is the suspicious unit.
            </p>
          </div>
        </div>

        <div class="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
          {#each rankedRiskRequests as request, index}
            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <h4 class="text-sm font-semibold text-stone-950">{request.endpoint}</h4>
                  </div>
                  <p class="mt-3 text-sm leading-6 text-stone-600">{request.note}</p>
                </div>
                <div class="rounded-2xl bg-white px-3 py-2 text-right">
                  <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Score</p>
                  <p class="mt-1 text-lg font-semibold text-stone-950">{request.score.toFixed(3)}</p>
                </div>
              </div>

              <div class="mt-4 grid gap-2 sm:grid-cols-4">
                <div class="rounded-2xl bg-white px-3 py-2 text-sm text-stone-700">
                  <span class="block text-xs uppercase tracking-[0.16em] text-stone-500">aef</span>
                  <span class="mt-1 block font-semibold text-stone-950">{request.aef}</span>
                </div>
                <div class="rounded-2xl bg-white px-3 py-2 text-sm text-stone-700">
                  <span class="block text-xs uppercase tracking-[0.16em] text-stone-500">aep</span>
                  <span class="mt-1 block font-semibold text-stone-950">{request.aep}</span>
                </div>
                <div class="rounded-2xl bg-white px-3 py-2 text-sm text-stone-700">
                  <span class="block text-xs uppercase tracking-[0.16em] text-stone-500">anf</span>
                  <span class="mt-1 block font-semibold text-stone-950">{request.anf}</span>
                </div>
                <div class="rounded-2xl bg-white px-3 py-2 text-sm text-stone-700">
                  <span class="block text-xs uppercase tracking-[0.16em] text-stone-500">anp</span>
                  <span class="mt-1 block font-semibold text-stone-950">{request.anp}</span>
                </div>
              </div>
            </article>
          {/each}
        </div>
      </div>
    </SectionCard>
  {/if}

  {#if showAnalysisPreview && analysisSnapshot}
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <SectionCard
        eyebrow="Artifacts"
        title="Expected files"
        description="The key RESTler artifacts you will most likely inspect for the current mode."
      >
        <div class="rounded-2xl bg-stone-50 px-4 py-4">
          <p class="text-sm font-semibold text-stone-900">Current mode: {$selectedModeMeta.label}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            {#each $expectedResultFiles as file}
              <span class="result-chip">{file}</span>
            {/each}
          </div>
        </div>

        <div class="mt-4 space-y-3 text-sm leading-6 text-stone-600">
          <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <strong class="text-stone-900">`testing_summary.json`</strong> is the fastest place to
            check coverage and high-level outcomes.
          </p>
          <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <strong class="text-stone-900">`coverage_failures_to_investigate.txt`</strong> helps
            prioritize why coverage is missing.
          </p>
          <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <strong class="text-stone-900">`bug_buckets.txt`</strong> is the first stop when fuzzing
            finds reproducible failures.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Request breakdown"
        title="Request and status aggregates"
        description="This summary is parsed from the current RESTler artifact files under your Bio workspace."
      >
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-sm font-semibold text-stone-900">By request method</p>
            <div class="mt-3 space-y-3">
              {#each analysisSnapshot.requestMethodCounts as item}
                <div class="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <span class="font-medium text-stone-800">{item.method}</span>
                  <span class="text-sm font-semibold text-stone-950">{item.count}</span>
                </div>
              {/each}
            </div>
          </div>

          <div class="rounded-2xl bg-stone-50 px-4 py-4">
            <p class="text-sm font-semibold text-stone-900">By response status</p>
            <div class="mt-3 space-y-3">
              {#each analysisSnapshot.responseStatusCounts as item}
                <div class="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <span class="font-medium text-stone-800">{item.code}</span>
                  <span class="text-sm font-semibold text-stone-950">{item.count}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]">
      <SectionCard
        eyebrow="Request catalog"
        title="Available requests"
        description="These requests are parsed from the real `openapi.json` inside the RESTler workspace."
      >
        <div class="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Requests available</p>
          <p class="mt-2 text-2xl font-semibold text-stone-950">
            {analysisSnapshot.availableRequests.length}
          </p>
        </div>

        <div class="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
          {#each analysisSnapshot.availableRequests as request, index}
            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <h4 class="text-sm font-semibold text-stone-950">
                      {request.method} {request.path}
                    </h4>
                  </div>
                </div>
                <span class={`status-chip ${request.auth ? "running" : ""}`}>
                  {request.auth ? "Auth" : "Public"}
                </span>
              </div>
            </article>
          {/each}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Failing sequences"
        title="Sequences worth investigating"
        description="These sequences are parsed from real replay logs and coverage failures in the RESTler output."
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <button
            class="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
            on:click={sortFailingSequencesByAi}
            disabled={isSortingFailingSequencesWithAi}
          >
            {isSortingFailingSequencesWithAi ? "Sorting with AI..." : "Sort by AI"}
          </button>
          <p class="text-sm leading-6 text-stone-500">
            Uses all fail types for ranking: `4xx`, `5xx`, and transport issues. Cached under the report logs for reuse.
          </p>
        </div>

        {#if sortFailingSequencesAiStatus}
          <p class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            {sortFailingSequencesAiStatus}
          </p>
        {/if}

        {#if sortFailingSequencesAiError}
          <p class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {sortFailingSequencesAiError}
          </p>
        {/if}

        <div class="max-h-[72vh] space-y-4 overflow-y-auto pr-2">
          {#each analysisSnapshot.failingSequences as sequence}
            {@const sequenceKey = getSequenceKey(sequence)}
            {@const sequenceAiResult = sequenceAiResultByKey[sequenceKey]}
            {@const sequenceAiError = sequenceAiErrorByKey[sequenceKey]}
            {@const isRunningSequenceAi = sequenceAiLoadingKey === sequenceKey}
            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h4 class="text-sm font-semibold text-stone-950">{sequence.title}</h4>
                  <p class="mt-1 text-sm font-medium text-rose-700">{sequence.outcome}</p>
                  {#if typeof sequence.aiSuspicionScore === "number"}
                    <div class="mt-3 flex flex-wrap items-center gap-3">
                      <span class="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                        AI score {sequence.aiSuspicionScore.toFixed(0)}/100
                      </span>
                      <span class="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                        {sequence.aiSuspicionSource === "cache" ? "From cache" : "Fresh"}
                      </span>
                    </div>
                  {/if}
                </div>
                <span class="status-chip review">Failure path</span>
              </div>

              {#if sequence.aiSuspicionReason}
                <p class="mt-4 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm leading-6 text-stone-700">
                  <span class="font-semibold text-stone-900">AI suspicion reason:</span>
                  {sequence.aiSuspicionReason}
                </p>
              {/if}

              <div class="mt-4 flex flex-wrap gap-3">
                <button
                  class="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
                  on:click={() => runSequenceAiAnalysis(sequence)}
                  disabled={isRunningSequenceAi}
                >
                  {isRunningSequenceAi ? "Analyzing with AI..." : "Analyze with AI"}
                </button>
                <button
                  class="rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                  on:click={() => copySequence(sequence)}
                >
                  Copy sequence
                </button>
              </div>

              <div class="mt-4 space-y-2">
                {#each sequence.requests as step, stepIndex}
                  {@const stepParts = splitRequestStep(step)}
                  {@const isLongStep = isLongSequenceStep(step)}
                  {@const isExpanded = isExpandedStep(sequence, stepIndex)}
                  <div class="sequence-step">
                    <div class="sequence-step__rail">
                      <span class="sequence-step__index">{stepIndex + 1}</span>
                      {#if stepIndex < sequence.requests.length - 1}
                        <span class="sequence-step__line"></span>
                      {/if}
                    </div>
                    <div class="sequence-step__content">
                      {#if isLongStep}
                        <div class="sequence-step__details">
                          <div class="sequence-step__summary">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="sequence-step__method">{stepParts.method}</span>
                            </div>
                            <button
                              type="button"
                              class="sequence-step__toggle"
                              aria-label={isExpanded ? "Collapse request path" : "Expand request path"}
                              aria-expanded={isExpanded}
                              on:click={() => toggleExpandedStep(sequence, stepIndex)}
                            >
                              <span class:expanded={isExpanded} class="sequence-step__toggle-icon"></span>
                            </button>
                          </div>
                          <span class={`sequence-step__target ${isExpanded ? "sequence-step__target--expanded" : "collapsed"}`}>
                            {stepParts.target}
                          </span>
                        </div>
                      {:else}
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="sequence-step__method">{stepParts.method}</span>
                        </div>
                        <span class="sequence-step__target">
                          {stepParts.target}
                        </span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>

              <p class="mt-4 text-sm leading-6 text-stone-600">{sequence.reason}</p>

              {#if sequenceAiError}
                <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
                  {sequenceAiError}
                </div>
              {/if}

              {#if sequenceAiResult}
                <div class="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-xs uppercase tracking-[0.18em] text-cyan-700">AI sequence triage</p>
                      <p class="mt-2 text-sm font-semibold text-stone-950">{sequenceAiResult.model}</p>
                    </div>
                    {#if sequenceAiResult.failure_stage}
                      <span class="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                        {sequenceAiResult.failure_stage}
                      </span>
                    {/if}
                  </div>

                  <div class="mt-4 rounded-2xl bg-stone-50 px-4 py-4">
                    <p class="text-sm font-semibold text-stone-900">Summary</p>
                    <p class="mt-2 text-sm leading-6 text-stone-700">{sequenceAiResult.summary}</p>
                  </div>

                  <div class="mt-4 grid gap-4 xl:grid-cols-2">
                    <div class="rounded-2xl bg-stone-50 px-4 py-4">
                      <p class="text-sm font-semibold text-stone-900">Likely causes</p>
                      <ul class="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                        {#each sequenceAiResult.likely_causes as item}
                          <li class="rounded-2xl bg-white px-3 py-3">{item}</li>
                        {/each}
                      </ul>
                    </div>

                    <div class="rounded-2xl bg-stone-50 px-4 py-4">
                      <p class="text-sm font-semibold text-stone-900">Suggested fixes</p>
                      <ul class="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                        {#each sequenceAiResult.suggested_fixes as item}
                          <li class="rounded-2xl bg-white px-3 py-3">{item}</li>
                        {/each}
                      </ul>
                    </div>

                    <div class="rounded-2xl bg-stone-50 px-4 py-4">
                      <p class="text-sm font-semibold text-stone-900">Verification steps</p>
                      <ul class="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                        {#each sequenceAiResult.verification_steps as item}
                          <li class="rounded-2xl bg-white px-3 py-3">{item}</li>
                        {/each}
                      </ul>
                    </div>

                    <div class="rounded-2xl bg-stone-50 px-4 py-4">
                      <p class="text-sm font-semibold text-stone-900">Suspicious requests</p>
                      <ul class="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                        {#each sequenceAiResult.suspicious_requests as item}
                          <li class="rounded-2xl bg-white px-3 py-3">{item}</li>
                        {/each}
                      </ul>
                    </div>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </SectionCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
      <SectionCard
        eyebrow="Bug buckets"
        title="Observed bug groups"
        description="Buckets collected from the current fuzz or test results under the Bio workspace."
      >
        <div class="space-y-3">
          {#each analysisSnapshot.bugBuckets as bug}
            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h4 class="text-sm font-semibold text-stone-950">{bug.checker}</h4>
                  <p class="mt-1 text-sm text-stone-600">Error code: {bug.errorCode}</p>
                </div>
                <div class="text-right">
                  <p class="text-lg font-semibold text-stone-950">{bug.count}</p>
                  <p class="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {bug.reproducible ? "Reproducible" : "Non-reproducible"}
                  </p>
                </div>
              </div>
            </article>
          {/each}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Notable failures"
        title="Endpoints worth checking first"
        description="These failing endpoints are pulled from the real RESTler response buckets."
      >
        <div class="space-y-3">
          {#each analysisSnapshot.notableFailures as failure}
            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h4 class="text-sm font-semibold text-stone-950">{failure.endpoint}</h4>
                  <p class="mt-2 text-sm leading-6 text-stone-600">{failure.reason}</p>
                </div>
                <span class="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                  {failure.statusCode}
                </span>
              </div>
            </article>
          {/each}
        </div>
      </SectionCard>
    </div>
  {/if}
</div>

{#if showRiskModal}
  <div
    class="modal-backdrop"
    aria-hidden="true"
    on:click={closeRiskAssessmentModal}
  ></div>
  <div
    class="modal-shell"
    role="dialog"
    aria-modal="true"
    aria-labelledby="risk-metric-modal-title"
  >
    <div class="modal-panel">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-cyan-700">SBFL metric selection</p>
          <h3 id="risk-metric-modal-title" class="mt-2 text-xl font-semibold text-stone-950">
            Choose a risk metric
          </h3>
          <p class="mt-2 text-sm leading-6 text-stone-600">
            Pick the suspiciousness metric used to rank RESTler requests from failing and passing sequences.
          </p>
        </div>
        <button
          class="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          on:click={closeRiskAssessmentModal}
        >
          Close
        </button>
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label class="block md:col-span-2 xl:col-span-3">
          <span class="field-label">Suspiciousness metric</span>
          <select
            class="field-select"
            bind:value={pendingFormula}
            on:change={onFormulaSelectionChange}
            disabled={isLoadingRiskFormulas}
          >
            {#each riskFormulas as formula}
              <option value={formula.id}>{formula.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="mt-5 rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
        <p class="text-sm font-semibold text-stone-900">{pendingFormulaMeta?.label ?? "Unknown metric"}</p>
        <p class="mt-2 text-sm leading-6 text-stone-600">
          {pendingFormulaMeta?.description ?? "No description available."}
        </p>
        <p class="mt-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 font-mono text-xs text-stone-700">
          {pendingFormulaMeta?.formulaText ?? "-"}
        </p>
      </div>

      <div class="mt-5 flex flex-wrap justify-end gap-3">
        <button
          class="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          on:click={closeRiskAssessmentModal}
        >
          Cancel
        </button>
        <button
          class="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          on:click={applyRiskAssessment}
          disabled={isLoadingRiskFormulas || isRunningRiskAssessment || riskFormulas.length === 0}
        >
          {isRunningRiskAssessment ? "Analyzing..." : "Apply metric"}
        </button>
      </div>
    </div>
  </div>
{/if}
