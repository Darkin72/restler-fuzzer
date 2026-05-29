<script lang="ts">
  import SectionCard from "../components/common/SectionCard.svelte";
  import { restlerConfig } from "../state";
</script>

<div class="grid gap-6 lg:grid-cols-2">
  <SectionCard
    eyebrow="Global defaults"
    title="Backend hooks to add next"
    description="Suggested endpoints and capabilities for turning this UI into a working RESTler console."
  >
    <div class="space-y-3 text-sm leading-6 text-stone-600">
      <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <strong class="text-stone-900">POST /api/runs</strong> to execute Docker commands for compile, test, or fuzz.
      </p>
      <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <strong class="text-stone-900">GET /api/runs/:id/logs</strong> to stream command output into the UI.
      </p>
      <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <strong class="text-stone-900">GET /api/docker/containers</strong> to discover running Docker services from a backend.
      </p>
      <p class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <strong class="text-stone-900">POST /api/spec/fetch</strong> to download `openapi.json` from a live FastAPI service into the workspace.
      </p>
    </div>
  </SectionCard>

  <SectionCard
    eyebrow="Current defaults"
    title="BioInformatic-oriented settings"
    description="Defaults aligned with the currently running Docker stack detected on this machine."
  >
    <dl class="space-y-4 text-sm">
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Docker image</dt>
        <dd class="mt-1 font-medium text-stone-900">{$restlerConfig.dockerImage}</dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Docker target</dt>
        <dd class="mt-1 font-medium text-stone-900">{$restlerConfig.dockerTargetName}</dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Auth command</dt>
        <dd class="mt-1 break-all font-medium text-stone-900">
          {$restlerConfig.authCommand || "Not configured"}
        </dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Grammar path</dt>
        <dd class="mt-1 break-all font-medium text-stone-900">{$restlerConfig.grammarPath}</dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Settings path</dt>
        <dd class="mt-1 break-all font-medium text-stone-900">{$restlerConfig.settingsPath}</dd>
      </div>
    </dl>
  </SectionCard>
</div>
