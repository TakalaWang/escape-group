<script lang="ts">
  let { data } = $props();

  const { group, members } = data;
  const user = data.user;
  const isHost = user?.id === group.hostId;
  const isMember = members.some((m) => m.userId === user?.id);
  const acceptedCount = members.filter((m) => m.status === "accepted" || m.status === "attended").length;
  const spotsLeft = group.maxMembers - acceptedCount;

  const modeLabels: Record<string, string> = {
    host: "團主制",
    match: "配對制",
    gather: "湊人制",
  };

  const statusLabels: Record<string, string> = {
    open: "招募中",
    full: "已額滿",
    confirmed: "已確認",
    completed: "已結束",
    cancelled: "已取消",
  };

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
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  let joining = $state(false);

  async function handleJoin() {
    joining = true;
    const res = await fetch(`/api/groups/${group.id}/join`, { method: "POST" });
    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json();
      alert(err.message || "加入失敗");
    }
    joining = false;
  }
</script>

<svelte:head>
  <title>{group.roomName ?? "待選密室"} | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
  <!-- Header -->
  <div class="mb-8">
    <div class="mb-2 flex flex-wrap items-center gap-3">
      <span class="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
        {modeLabels[group.mode]}
      </span>
      <span class="rounded-md px-2.5 py-1 text-xs font-semibold
        {group.status === 'open' ? 'bg-success/10 text-success' :
         group.status === 'full' ? 'bg-warning/10 text-warning' :
         group.status === 'completed' ? 'bg-text-dim/10 text-text-dim' :
         'bg-danger/10 text-danger'}">
        {statusLabels[group.status]}
      </span>
    </div>

    <h1 class="font-display text-3xl font-bold">
      {group.roomName ?? "待選密室"}
    </h1>

    {#if group.roomStudio}
      <p class="mt-1 text-text-dim">{group.roomStudio}</p>
    {/if}
  </div>

  <!-- Info grid -->
  <div class="mb-8 grid gap-4 sm:grid-cols-2">
    <div class="rounded-xl border border-border bg-surface p-4">
      <div class="text-xs text-text-dim">時間</div>
      <div class="mt-1 text-sm font-medium">{formatDate(group.datetime)}</div>
    </div>

    {#if group.roomLocation}
      <div class="rounded-xl border border-border bg-surface p-4">
        <div class="text-xs text-text-dim">地點</div>
        <div class="mt-1 text-sm font-medium">{group.roomLocation}</div>
      </div>
    {/if}

    <div class="rounded-xl border border-border bg-surface p-4">
      <div class="text-xs text-text-dim">人數</div>
      <div class="mt-1 text-sm font-medium">{acceptedCount} / {group.maxMembers} 人</div>
    </div>

    {#if group.minCredit > 0}
      <div class="rounded-xl border border-border bg-surface p-4">
        <div class="text-xs text-text-dim">最低信用門檻</div>
        <div class="mt-1 text-sm font-medium text-warning">{group.minCredit} 分</div>
      </div>
    {/if}
  </div>

  {#if group.roomUrl}
    <a
      href={group.roomUrl}
      target="_blank"
      rel="noopener"
      class="mb-8 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-dim transition-colors hover:border-gold/30 hover:text-gold"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      密室資訊連結
    </a>
  {/if}

  <!-- Join button -->
  {#if group.status === "open" && user && !isMember}
    <button
      onclick={handleJoin}
      disabled={joining || (user.creditScore < group.minCredit)}
      class="mb-8 w-full rounded-lg bg-gold py-3 font-semibold text-bg transition-all hover:bg-gold-dim hover:shadow-[0_0_30px_var(--color-gold-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if user.creditScore < group.minCredit}
        信用分數不足（需 {group.minCredit} 分）
      {:else if joining}
        加入中...
      {:else}
        我要參加
      {/if}
    </button>
  {:else if !user}
    <a
      href="/auth/facebook"
      class="mb-8 block w-full rounded-lg bg-gold py-3 text-center font-semibold text-bg transition-all hover:bg-gold-dim"
    >
      登入後報名
    </a>
  {/if}

  <!-- Members -->
  <div>
    <h2 class="font-display mb-4 text-xl font-bold">成員 ({acceptedCount}/{group.maxMembers})</h2>
    <div class="space-y-2">
      {#each members as member}
        <div class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
          <div class="flex items-center gap-3">
            {#if member.avatarUrl}
              <img src={member.avatarUrl} alt="" class="h-8 w-8 rounded-full object-cover" />
            {:else}
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-border text-xs text-text-dim">
                {member.displayName.charAt(0)}
              </div>
            {/if}
            <div>
              <span class="text-sm font-medium">{member.displayName}</span>
              {#if member.userId === group.hostId}
                <span class="ml-1 text-xs text-gold">團主</span>
              {/if}
              {#if member.isFlagged}
                <span class="ml-1 text-xs text-danger">!</span>
              {/if}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">
              {member.creditScore}
            </span>
            <span class="text-xs text-text-dim">
              {memberStatusLabels[member.status]}
            </span>
          </div>
        </div>
      {/each}

      {#if spotsLeft > 0 && group.status === "open"}
        {#each Array(spotsLeft) as _}
          <div class="flex items-center justify-center rounded-lg border border-dashed border-border py-3 text-sm text-text-dim">
            空位
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
