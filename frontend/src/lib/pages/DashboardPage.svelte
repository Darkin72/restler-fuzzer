<script lang="ts">
  import { onMount } from "svelte";
  import SectionCard from "../components/common/SectionCard.svelte";
  import {
    generateDictionaryWithAi,
    readDictionaryFile,
    saveDictionaryFile,
  } from "../api";
  import {
    commandSteps,
    dictionaryHostPath,
    restlerConfig,
    updateConfigField,
  } from "../state";

  let dictionaryContent = "";
  let dictionaryStatus = "";
  let dictionaryError = "";
  let dictionaryLoadedHostPath = "";
  let dictionaryAiModel = "";
  let isLoadingDictionary = false;
  let isSavingDictionary = false;
  let isGeneratingDictionary = false;
  let showCommandModal = false;
  let showDictionaryModal = false;
  let copyStatusByStep: Record<string, "idle" | "success" | "error"> = {};

  async function copyCommandStep(stepId: string, command: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = command;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      copyStatusByStep = {
        ...copyStatusByStep,
        [stepId]: "success",
      };
    } catch {
      copyStatusByStep = {
        ...copyStatusByStep,
        [stepId]: "error",
      };
    }

    setTimeout(() => {
      copyStatusByStep = {
        ...copyStatusByStep,
        [stepId]: "idle",
      };
    }, 1800);
  }

  async function loadDictionary() {
    isLoadingDictionary = true;
    dictionaryError = "";
    dictionaryStatus = "";

    try {
      const response = await readDictionaryFile(
        $restlerConfig.workspacePath,
        $restlerConfig.containerWorkdir,
        $restlerConfig.dictionaryPath,
      );
      dictionaryContent = response.content;
      dictionaryLoadedHostPath = response.hostPath;
      dictionaryStatus = "Dictionary loaded.";
    } catch (error) {
      dictionaryError = error instanceof Error ? error.message : "Unable to load dictionary.";
    } finally {
      isLoadingDictionary = false;
    }
  }

  async function persistDictionary() {
    isSavingDictionary = true;
    dictionaryError = "";
    dictionaryStatus = "";

    try {
      const response = await saveDictionaryFile(
        $restlerConfig.workspacePath,
        $restlerConfig.containerWorkdir,
        $restlerConfig.dictionaryPath,
        dictionaryContent,
      );
      dictionaryLoadedHostPath = response.hostPath;
      dictionaryStatus = "Dictionary saved.";
    } catch (error) {
      dictionaryError = error instanceof Error ? error.message : "Unable to save dictionary.";
    } finally {
      isSavingDictionary = false;
    }
  }

  async function generateDictionary() {
    isGeneratingDictionary = true;
    dictionaryError = "";
    dictionaryStatus = "";
    dictionaryAiModel = "";

    try {
      const response = await generateDictionaryWithAi(
        $restlerConfig.workspacePath,
        $restlerConfig.containerWorkdir,
        $restlerConfig.dictionaryPath,
        $restlerConfig.specPath,
        dictionaryContent,
      );
      dictionaryContent = response.content;
      dictionaryAiModel = response.model;
      dictionaryStatus = "AI dictionary generated. Review it, then save if it looks right.";
    } catch (error) {
      dictionaryError = error instanceof Error ? error.message : "Unable to generate dictionary with AI.";
    } finally {
      isGeneratingDictionary = false;
    }
  }

  async function importDictionaryFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    dictionaryContent = await file.text();
    dictionaryStatus = `Loaded ${file.name} into the editor. Save to write it to disk.`;
    dictionaryError = "";
  }

  onMount(() => {
    void loadDictionary();
  });
</script>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
    <section class="min-w-0 space-y-6">
      <SectionCard
        eyebrow="Workspace"
        title="Run configuration"
        description="Keep only the values you actually change often. Everything here feeds directly into the generated commands."
      >
        <div class="grid gap-5">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block">
              <span class="field-label">Workspace folder</span>
              <input
                value={$restlerConfig.workspacePath}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("workspacePath", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="block">
              <span class="field-label">OpenAPI URL</span>
              <input
                value={$restlerConfig.openApiUrl}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("openApiUrl", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <label class="block">
              <span class="field-label">Docker image</span>
              <input
                value={$restlerConfig.dockerImage}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("dockerImage", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="block">
              <span class="field-label">Host</span>
              <input
                value={$restlerConfig.host}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("host", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="block">
              <span class="field-label">Port</span>
              <input
                value={$restlerConfig.targetPort}
                class="field-input"
                type="number"
                min="1"
                on:input={(event) =>
                  updateConfigField("targetPort", Number((event.currentTarget as HTMLInputElement).value))}
              />
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label class="block">
              <span class="field-label">Token refresh command</span>
              <input
                value={$restlerConfig.authCommand}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("authCommand", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="block">
              <span class="field-label">Time (minutes)</span>
              <input
                value={$restlerConfig.timeBudget}
                class="field-input"
                type="number"
                min="1"
                on:input={(event) =>
                  updateConfigField("timeBudget", Number((event.currentTarget as HTMLInputElement).value))}
              />
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="block">
              <span class="field-label">Project name</span>
              <input
                value={$restlerConfig.projectName}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("projectName", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="block">
              <span class="field-label">Docker target/container</span>
              <input
                value={$restlerConfig.dockerTargetName}
                class="field-input"
                on:input={(event) =>
                  updateConfigField("dockerTargetName", (event.currentTarget as HTMLInputElement).value)}
              />
            </label>
          </div>

          <div class="flex flex-wrap items-end justify-between gap-4 border-t border-stone-200 pt-4">
            <div class="text-sm leading-6 text-stone-500">
              Commands will use the current workspace, dictionary, host, auth command, and time budget.
            </div>
            <button
              type="button"
              class="primary-button"
              on:click={() => {
                showCommandModal = true;
              }}
            >
              Generate command
            </button>
          </div>
        </div>
      </SectionCard>

    

    </section>

    <aside class="min-w-0 space-y-6">
      <SectionCard
        eyebrow="Dictionary"
        title="Edit dict.json"
        description="Manage the real dictionary file used by the generated RESTler commands."
      >
        <div class="grid gap-4">
          <div class="border border-stone-200 bg-stone-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Container path</p>
            <p class="mt-2 break-all text-sm font-semibold text-stone-900">{$restlerConfig.dictionaryPath}</p>
          </div>
          <div class="border border-stone-200 bg-stone-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-stone-500">Host path</p>
            <p class="mt-2 break-all text-sm font-semibold text-stone-900">
              {dictionaryLoadedHostPath || $dictionaryHostPath}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            class="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
            on:click={loadDictionary}
            disabled={isLoadingDictionary}
          >
            {isLoadingDictionary ? "Loading..." : "Load dict"}
          </button>
          <button
            type="button"
            class="bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            on:click={persistDictionary}
            disabled={isSavingDictionary}
          >
            {isSavingDictionary ? "Saving..." : "Save dict"}
          </button>
          <label class="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50">
            Upload dict
            <input
              type="file"
              accept=".json,application/json"
              class="hidden"
              on:change={importDictionaryFile}
            />
          </label>
          <button
            type="button"
            class="border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
            on:click={generateDictionary}
            disabled={isGeneratingDictionary}
          >
            {isGeneratingDictionary ? "Generating..." : "Generate with AI"}
          </button>
          <button
            type="button"
            class="primary-button"
            on:click={() => {
              showDictionaryModal = true;
            }}
          >
            Edit dictionary
          </button>
        </div>

        {#if dictionaryStatus}
          <p class="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            {dictionaryStatus}
            {#if dictionaryAiModel}
              <span class="font-semibold"> Model: {dictionaryAiModel}</span>
            {/if}
          </p>
        {/if}

        {#if dictionaryError}
          <p class="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {dictionaryError}
          </p>
        {/if}

        <div class="mt-4 border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-600">
          Open the editor only when you need to review or change `dict.json`.
        </div>
      </SectionCard>
    </aside>
</div>

{#if showDictionaryModal}
  <div class="modal-backdrop" aria-hidden="true" on:click={() => { showDictionaryModal = false; }}></div>
  <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="dictionary-editor-title">
    <div class="modal-panel">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Dictionary</p>
          <h3 id="dictionary-editor-title" class="section-title">Edit dict.json</h3>
          <p class="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--on-surface-variant)]">
            Review, paste, or refine the live dictionary used by the generated RESTler commands.
          </p>
        </div>
        <button
          type="button"
          class="border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          on:click={() => { showDictionaryModal = false; }}
        >
          Close
        </button>
      </div>

      <label class="mt-6 block">
        <span class="field-label">Dictionary JSON content</span>
        <textarea
          bind:value={dictionaryContent}
          class="field-textarea min-h-[70vh] font-mono text-sm leading-6"
          spellcheck="false"
        ></textarea>
      </label>

      <div class="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          class="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          on:click={() => { showDictionaryModal = false; }}
        >
          Close editor
        </button>
        <button
          type="button"
          class="primary-button"
          on:click={persistDictionary}
          disabled={isSavingDictionary}
        >
          {isSavingDictionary ? "Saving..." : "Save dict"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCommandModal}
  <div class="modal-backdrop" aria-hidden="true" on:click={() => { showCommandModal = false; }}></div>
  <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="generate-command-title">
    <div class="modal-panel">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Runbook</p>
          <h3 id="generate-command-title" class="section-title">Generated commands</h3>
          <p class="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--on-surface-variant)]">
            Run each command step separately in PowerShell. This keeps the workflow explicit and easier to debug.
          </p>
        </div>
        <button
          type="button"
          class="border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          on:click={() => { showCommandModal = false; }}
        >
          Close
        </button>
      </div>

      <div class="mt-6 space-y-5">
        {#each $commandSteps as step, index}
          <section class="border border-stone-200 bg-stone-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
                  Step {index + 1}
                </p>
                <h4 class="mt-2 text-lg font-semibold text-stone-950">{step.title}</h4>
                <p class="mt-2 text-sm leading-7 text-[color:var(--on-surface-variant)]">
                  {step.description}
                </p>
              </div>

              <button
                type="button"
                class="primary-button"
                on:click={() => copyCommandStep(step.id, step.command)}
              >
                Copy command
              </button>
            </div>

            <pre class="mt-4 overflow-x-auto bg-[#26181d] p-4 text-sm leading-7 text-rose-100 whitespace-pre-wrap break-all"><code class="block max-w-full break-all whitespace-pre-wrap">{step.command}</code></pre>

            {#if copyStatusByStep[step.id] === "success"}
              <p class="mt-3 text-sm leading-6 text-emerald-700">Command copied to clipboard.</p>
            {:else if copyStatusByStep[step.id] === "error"}
              <p class="mt-3 text-sm leading-6 text-rose-700">Could not copy automatically.</p>
            {/if}
          </section>
        {/each}
      </div>
    </div>
  </div>
{/if}
