<script lang="ts">
  let { title } = $props<{
    eyebrow: string;
    title: string;
    description: string;
  }>();
</script>

<header class="page-title-shell">
  <h2 class="page-title">{title}</h2>
</header>
