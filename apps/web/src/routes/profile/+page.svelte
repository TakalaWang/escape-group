<script lang="ts">
  let { data } = $props();
  const user = data.user!;

  const memberStatusLabels: Record<string, string> = {
    pending: "待審核",
    accepted: "已加入",
    attended: "已出席",
    no_show: "跳車",
    excused: "請假",
  };

  function formatDate(d: string | null) {
    if (!d) return "待定";
    return new Date(d).toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  }
</script>

<svelte:head>
  <title>個人檔案 | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
  <!-- Profile card -->
  <div class="mb-8 rounded-xl border border-border bg-surface p-6">
    <div class="flex items-center gap-4">
      {#if user.avatarUrl}
        <img src={user.avatarUrl} alt="" class="h-16 w-16 rounded-full object-cover" />
      {:else}
        <div class="flex h-16 w-16 items-center justify-center rounded-full bg-border text-xl font-bold text-text-dim">
          {user.displayName.charAt(0)}
        </div>
      {/if}

      <div class="flex-1">
        <h1 class="font-display text-2xl font-bold">{user.displayName}</h1>
        <div class="mt-1 flex items-center gap-3 text-sm text-text-dim">
          {#if user.phone}
            <span class="flex items-center gap-1 text-success">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              手機已驗證
            </span>
          {:else}
            <a href="/verify-phone" class="text-warning hover:underline">
              尚未驗證手機
            </a>
          {/if}
        </div>
      </div>

      <div class="text-center">
        <div class="font-display text-3xl font-bold text-gold">{user.creditScore}</div>
        <div class="text-xs text-text-dim">信用分數</div>
        {#if user.isFlagged}
          <div class="mt-1 text-xs text-danger">信用警示中</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Group history -->
  <h2 class="font-display mb-4 text-xl font-bold">參加紀錄</h2>

  {#if data.history.length === 0}
    <div class="rounded-xl border border-border bg-surface py-12 text-center text-text-dim">
      還沒有參加過任何團
    </div>
  {:else}
    <div class="space-y-2">
      {#each data.history as item}
        <a
          href="/groups/{item.groupId}"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-gold/20"
        >
          <div>
            <span class="text-sm font-medium">{item.roomName ?? "待選密室"}</span>
            {#if item.roomStudio}
              <span class="text-xs text-text-dim"> — {item.roomStudio}</span>
            {/if}
            <div class="mt-0.5 text-xs text-text-dim">{formatDate(item.groupDatetime)}</div>
          </div>
          <span class="text-xs
            {item.memberStatus === 'attended' ? 'text-success' :
             item.memberStatus === 'no_show' ? 'text-danger' :
             'text-text-dim'}">
            {memberStatusLabels[item.memberStatus]}
          </span>
        </a>
      {/each}
    </div>
  {/if}

  <!-- Logout -->
  <form method="POST" action="/auth/logout" class="mt-8">
    <button
      type="submit"
      class="rounded-lg border border-border px-6 py-2 text-sm text-text-dim transition-colors hover:border-danger/30 hover:text-danger"
    >
      登出
    </button>
  </form>
</div>
