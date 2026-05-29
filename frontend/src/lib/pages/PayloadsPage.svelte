<script lang="ts">
  import SectionCard from "../components/common/SectionCard.svelte";
  import { payloadInContainer, restlerConfig, updateConfigField } from "../state";
</script>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
  <SectionCard
    eyebrow="Manual input"
    title="OpenAPI and payload sources"
    description="Use direct URLs and local files instead of choosing mock Docker projects."
  >
    <div class="grid gap-4">
      <label class="block">
        <span class="field-label">OpenAPI URL</span>
        <input
          value={$restlerConfig.openApiUrl}
          class="field-input"
          on:input={(event) =>
            updateConfigField("openApiUrl", (event.currentTarget as HTMLInputElement).value)}
        />
      </label>

      <label class="block">
        <span class="field-label">OpenAPI spec file on host</span>
        <input
          value={$restlerConfig.specPath}
          class="field-input"
          on:input={(event) =>
            updateConfigField("specPath", (event.currentTarget as HTMLInputElement).value)}
        />
      </label>

      <label class="block">
        <span class="field-label">Manual payload file path</span>
        <input
          value={$restlerConfig.payloadPath}
          class="field-input"
          on:input={(event) =>
            updateConfigField("payloadPath", (event.currentTarget as HTMLInputElement).value)}
        />
      </label>

      <label class="block">
        <span class="field-label">Manual payload body</span>
        <textarea
          class="field-textarea"
          rows="14"
          on:input={(event) =>
            updateConfigField("payloadBody", (event.currentTarget as HTMLTextAreaElement).value)}
        >{$restlerConfig.payloadBody}</textarea>
      </label>
    </div>
  </SectionCard>

  <SectionCard
    eyebrow="Container mapping"
    title="How RESTler will see these files"
    description="Useful when you want to save the payload locally and mount it into Docker."
  >
    <dl class="space-y-4 text-sm">
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Spec in container</dt>
        <dd class="mt-1 break-all font-medium text-stone-900">{$restlerConfig.specPath}</dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Payload in container</dt>
        <dd class="mt-1 break-all font-medium text-stone-900">
          {$payloadInContainer || "Not mapped yet"}
        </dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Detected bio target</dt>
        <dd class="mt-1 font-medium text-stone-900">bioinformatics-serving-api on localhost:8001</dd>
      </div>
      <div class="rounded-2xl bg-stone-50 px-4 py-3">
        <dt class="text-stone-500">Note</dt>
        <dd class="mt-1 text-stone-700">
          Frontend-only mode cannot query Docker directly. Use the manual fields now, then add a backend if you want live Docker discovery.
        </dd>
      </div>
    </dl>
  </SectionCard>
</div>
