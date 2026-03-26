<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>錯誤 | Escape Group</title>
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
  <div class="font-display text-6xl font-bold text-gold">{page.status}</div>
  <h1 class="mt-4 text-xl font-medium text-text">{page.error?.message ?? "發生錯誤"}</h1>
  <p class="mt-2 text-sm text-text-dim">
    {#if page.status === 404}
      找不到你要的頁面
    {:else if page.status === 403}
      你沒有權限存取此頁面
    {:else}
      請稍後再試
    {/if}
  </p>
  <a
    href="/"
    class="mt-8 rounded-lg border border-border px-6 py-2 text-sm font-medium text-text-dim transition-colors hover:border-gold/30 hover:text-gold"
  >
    回首頁
  </a>
</div>
