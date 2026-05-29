<script lang="ts">
  import { navigate } from "../router";
</script>

<section class="rounded-[28px] border border-stone-200 bg-white p-10 text-center shadow-sm">
  <p class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Not found</p>
  <h2 class="mt-2 text-3xl font-semibold text-stone-950">That page does not exist</h2>
  <p class="mt-3 text-sm leading-6 text-stone-600">
    The route was not found in this RESTler UI scaffold.
  </p>
  <button
    class="mt-6 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
    on:click={() => navigate("/")}
  >
    Back to dashboard
  </button>
</section>
