<script lang="ts">
  import GroupCard from "$lib/components/GroupCard.svelte";

  let { data } = $props();

  let tab = $state<"active" | "past">("active");
</script>

<svelte:head>
  <title>我的團 | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
  <div class="mb-8 flex items-end justify-between">
    <div>
      <h1 class="font-display text-3xl font-bold">我的團</h1>
      <p class="mt-1 text-sm text-text-dim">管理你參加的密室團</p>
    </div>
    <a
      href="/groups/new"
      class="hidden rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-gold-dim sm:block"
    >
      + 開新團
    </a>
  </div>

  <!-- Tabs -->
  <div class="mb-6 flex gap-2">
    <button
      onclick={() => (tab = "active")}
      class="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors {tab === 'active'
        ? 'bg-gold/10 text-gold'
        : 'text-text-dim hover:text-text'}"
    >
      進行中 ({data.activeGroups.length})
    </button>
    <button
      onclick={() => (tab = "past")}
      class="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors {tab === 'past'
        ? 'bg-gold/10 text-gold'
        : 'text-text-dim hover:text-text'}"
    >
      歷史 ({data.pastGroups.length})
    </button>
  </div>

  {#if tab === "active"}
    {#if data.activeGroups.length === 0}
      <div class="rounded-xl border border-border bg-surface py-20 text-center">
        <p class="text-lg text-text-dim">沒有進行中的團</p>
        <a href="/groups" class="mt-4 inline-block text-sm font-medium text-gold hover:underline">
          去找團
        </a>
      </div>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each data.activeGroups as group}
          <div class="relative">
            {#if group.isHost}
              <div
                class="absolute -top-2 -right-2 z-10 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-bg"
              >
                團主
              </div>
            {/if}
            <GroupCard {group} />
          </div>
        {/each}
      </div>
    {/if}
  {:else if data.pastGroups.length === 0}
    <div class="rounded-xl border border-border bg-surface py-20 text-center">
      <p class="text-lg text-text-dim">沒有歷史紀錄</p>
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-2">
      {#each data.pastGroups as group}
        <GroupCard {group} />
      {/each}
    </div>
  {/if}
</div>
