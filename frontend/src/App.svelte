<script lang="ts">
  import TopNav from "./lib/components/layout/TopNav.svelte";
  import DashboardPage from "./lib/pages/DashboardPage.svelte";
  import PageNotFound from "./lib/pages/PageNotFound.svelte";
  import ResultsPage from "./lib/pages/ResultsPage.svelte";
  import { currentPath, currentRoute, navigate } from "./lib/router";

  const pages = {
    "/": DashboardPage,
    "/results": ResultsPage,
  } as const;

  $: if ($currentPath === "/payloads") {
    navigate("/");
  }

  $: ActivePage = pages[$currentPath as keyof typeof pages] ?? PageNotFound;
</script>

<svelte:head>
  <title>RESTler Control Center</title>
</svelte:head>

<div class="page-shell">
  <div class="page-frame">
    <div class="space-y-6">
      <TopNav />

      <svelte:component this={ActivePage} />
    </div>
  </div>
</div>
