<script lang="ts">
  let { eyebrow = "", title, description = "", children } = $props<{
    eyebrow?: string;
    title: string;
    description?: string;
    children?: () => unknown;
  }>();
</script>

<section class="section-surface">
  <div class="mb-5">
    {#if eyebrow}
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">{eyebrow}</p>
    {/if}
    <h3 class="section-title">{title}</h3>
    {#if description}
      <p class="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--on-surface-variant)]">{description}</p>
    {/if}
  </div>
  {@render children?.()}
</section>
