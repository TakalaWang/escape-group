<script lang="ts">
  import GroupCard from "$lib/components/GroupCard.svelte";

  let { data } = $props();

  const modes = [
    { value: "", label: "全部" },
    { value: "host", label: "團主制" },
    { value: "match", label: "配對制" },
    { value: "gather", label: "湊人制" },
  ];
</script>

<svelte:head>
  <title>瀏覽開團 | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
  <div class="mb-8 flex items-end justify-between">
    <div>
      <h1 class="font-display text-3xl font-bold">瀏覽開團</h1>
      <p class="mt-1 text-sm text-text-dim">找到你的下一場密室冒險</p>
    </div>
    <a
      href="/groups/new"
      class="hidden rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-gold-dim sm:block"
    >
      + 我要開團
    </a>
  </div>

  <!-- Filter tabs -->
  <div class="mb-6 flex gap-2">
    {#each modes as m}
      <a
        href="/groups{m.value ? `?mode=${m.value}` : ''}"
        class="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors {data.filters.mode === m.value || (!data.filters.mode && m.value === '') ? 'bg-gold/10 text-gold' : 'text-text-dim hover:text-text'}"
      >
        {m.label}
      </a>
    {/each}
  </div>

  {#if data.groups.length === 0}
    <div class="rounded-xl border border-border bg-surface py-20 text-center">
      <p class="text-lg text-text-dim">目前沒有開放中的團</p>
      <a href="/groups/new" class="mt-4 inline-block text-sm font-medium text-gold hover:underline">
        來開第一個團吧
      </a>
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-2">
      {#each data.groups as group}
        <GroupCard {group} />
      {/each}
    </div>
  {/if}

  <!-- Mobile FAB -->
  <a
    href="/groups/new"
    class="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl font-bold text-bg shadow-lg transition-transform hover:scale-110 sm:hidden"
    aria-label="開團"
  >
    +
  </a>
</div>
