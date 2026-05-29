<script lang="ts">
  import { appRoutes } from "../../mock-data";
  import { currentPath, navigate } from "../../router";

  let searchText = "";

  function onNavigate(event: MouseEvent, path: string) {
    event.preventDefault();
    navigate(path);
  }
</script>

<header class="glass-nav">
  <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
    <div class="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-center">
      <div class="min-w-0">
        <div class="flex items-center gap-4">
          <span class="inline-flex h-11 w-11 items-center justify-center bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] text-sm font-bold text-white">
            R
          </span>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">RESTler UI</p>
            <h1 class="truncate font-[var(--font-display)] text-[1.7rem] font-semibold tracking-[-0.03em] text-[color:var(--on-surface)]">
              The Testing Curator
            </h1>
          </div>
        </div>
      </div>

      <nav class="flex flex-wrap gap-1 xl:ml-6">
        {#each appRoutes as route}
          <a
            href={route.path}
            class:active={$currentPath === route.path}
            class="topnav-link"
            on:click={(event) => onNavigate(event, route.path)}
          >
            {route.label}
          </a>
        {/each}
      </nav>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label class="relative block min-w-[280px]">
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--on-surface-variant)]">
          <svg viewBox="0 0 20 20" class="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M8.5 3a5.5 5.5 0 1 0 3.47 9.77l3.63 3.63 1.06-1.06-3.63-3.63A5.5 5.5 0 0 0 8.5 3Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
          </svg>
        </span>
        <input
          bind:value={searchText}
          class="field-input !bg-white/72 !pl-11"
          placeholder="Search runs, paths, endpoints..."
          type="text"
        />
      </label>

      <button type="button" class="primary-button min-w-[140px]">
        Open Runbook
      </button>
    </div>
  </div>
</header>
