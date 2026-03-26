<script lang="ts">
  let { data } = $props();

  const { group, members } = data;
  const user = data.user;
  const isHost = user?.id === group.hostId;
  const isMember = members.some((m) => m.userId === user?.id);
  const acceptedCount = members.filter((m) => m.status === "accepted" || m.status === "attended").length;
  const pendingMembers = members.filter((m) => m.status === "pending");
  const spotsLeft = group.maxMembers - acceptedCount;
  const isCompleted = group.status === "completed";
  const canConfirmAttendance = isHost && (group.status === "confirmed" || group.status === "full" || group.status === "open");

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
  let showAttendance = $state(false);
  let attendanceMap = $state<Record<string, string>>({});
  let submittingAttendance = $state(false);
  let reportingUserId = $state<string | null>(null);
  let reportReason = $state("");

  // Gather mode proposals
  type Proposal = {
    id: string;
    roomName: string;
    roomStudio: string | null;
    roomLocation: string | null;
    roomUrl: string | null;
    proposerName: string;
    voteCount: number;
    voters: string[];
  };
  let proposals = $state<Proposal[]>([]);
  let showProposalForm = $state(false);
  let proposalForm = $state({ roomName: "", roomStudio: "", roomUrl: "", roomLocation: "" });

  async function loadProposals() {
    const res = await fetch(`/api/groups/${group.id}/proposals`);
    if (res.ok) proposals = await res.json();
  }

  async function submitProposal() {
    const res = await fetch(`/api/groups/${group.id}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proposalForm),
    });
    if (res.ok) {
      showProposalForm = false;
      proposalForm = { roomName: "", roomStudio: "", roomUrl: "", roomLocation: "" };
      await loadProposals();
    } else {
      const err = await res.json();
      alert(err.message || "提案失敗");
    }
  }

  async function toggleVote(proposalId: string) {
    const res = await fetch(`/api/groups/${group.id}/proposals/${proposalId}/vote`, {
      method: "POST",
    });
    if (res.ok) await loadProposals();
  }

  async function confirmProposal(proposalId: string) {
    // Host picks the winning proposal — set the escape room on the group
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return;
    // This requires a new API, but for now we just confirm the group
    alert("此功能將在團主確認密室後自動設定。目前請手動更新。");
  }

  // Load proposals if gather mode
  if (group.mode === "gather" && group.status !== "completed" && group.status !== "cancelled") {
    loadProposals();
  }

  // Initialize attendance map with current statuses
  function initAttendance() {
    const map: Record<string, string> = {};
    for (const m of members) {
      if (m.status === "accepted" && m.userId !== group.hostId) {
        map[m.id] = "attended";
      }
    }
    attendanceMap = map;
    showAttendance = true;
  }

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

  async function handleLeave() {
    if (!confirm("確定要退出此團？")) return;
    const myMembership = members.find((m) => m.userId === user?.id);
    if (!myMembership) return;

    const res = await fetch(`/api/groups/${group.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: myMembership.id }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json();
      alert(err.message || "退出失敗");
    }
  }

  async function handleApproveMember(memberId: string) {
    const res = await fetch(`/api/groups/${group.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, status: "accepted" }),
    });
    if (res.ok) window.location.reload();
  }

  async function handleRejectMember(memberId: string) {
    const res = await fetch(`/api/groups/${group.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) window.location.reload();
  }

  async function handleCancelGroup() {
    if (!confirm("確定要取消此團？此操作無法復原。")) return;
    const res = await fetch(`/api/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) window.location.reload();
  }

  async function submitAttendance() {
    submittingAttendance = true;
    const attendance = Object.entries(attendanceMap).map(([memberId, status]) => ({
      memberId,
      status,
    }));

    const res = await fetch(`/api/groups/${group.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance }),
    });

    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json();
      alert(err.message || "提交失敗");
    }
    submittingAttendance = false;
  }

  async function submitReport() {
    if (!reportingUserId) return;
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedUserId: reportingUserId,
        groupId: group.id,
        reason: reportReason || null,
      }),
    });

    if (res.ok) {
      reportingUserId = null;
      reportReason = "";
      alert("檢舉已提交");
    } else {
      const err = await res.json();
      alert(err.message || "檢舉失敗");
    }
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
         group.status === 'cancelled' ? 'bg-danger/10 text-danger' :
         'bg-gold/10 text-gold'}">
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

  <!-- Gather mode proposals -->
  {#if group.mode === "gather" && group.status !== "completed" && group.status !== "cancelled"}
    <div class="mb-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-display text-xl font-bold">密室提案投票</h2>
        {#if isMember}
          <button
            onclick={() => (showProposalForm = !showProposalForm)}
            class="rounded-lg border border-gold/30 px-4 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
          >
            {showProposalForm ? "取消" : "+ 提案"}
          </button>
        {/if}
      </div>

      {#if showProposalForm}
        <div class="mb-4 rounded-xl border border-gold/20 bg-gold/5 p-4">
          <div class="space-y-3">
            <input
              bind:value={proposalForm.roomName}
              placeholder="密室名稱 *"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
            />
            <div class="grid grid-cols-2 gap-3">
              <input
                bind:value={proposalForm.roomStudio}
                placeholder="工作室"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
              />
              <input
                bind:value={proposalForm.roomLocation}
                placeholder="地區"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
              />
            </div>
            <input
              bind:value={proposalForm.roomUrl}
              placeholder="連結（選填）"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
            />
            <button
              onclick={submitProposal}
              disabled={!proposalForm.roomName}
              class="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-gold-dim disabled:opacity-50"
            >
              送出提案
            </button>
          </div>
        </div>
      {/if}

      {#if proposals.length === 0}
        <div class="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-dim">
          還沒有人提案，成為第一個吧！
        </div>
      {:else}
        <div class="space-y-3">
          {#each proposals.sort((a, b) => b.voteCount - a.voteCount) as proposal}
            <div class="rounded-xl border border-border bg-surface p-4 transition-all {proposal.voters.includes(user?.id ?? '') ? 'border-gold/30 bg-gold/5' : ''}">
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-medium">{proposal.roomName}</div>
                  {#if proposal.roomStudio}
                    <div class="text-xs text-text-dim">{proposal.roomStudio}</div>
                  {/if}
                  {#if proposal.roomLocation}
                    <div class="mt-1 text-xs text-text-dim">{proposal.roomLocation}</div>
                  {/if}
                  <div class="mt-1 text-xs text-text-dim">提案者：{proposal.proposerName}</div>
                </div>
                <div class="flex items-center gap-3">
                  {#if isMember}
                    <button
                      onclick={() => toggleVote(proposal.id)}
                      class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
                        {proposal.voters.includes(user?.id ?? '')
                          ? 'bg-gold/20 text-gold'
                          : 'border border-border text-text-dim hover:text-text'}"
                    >
                      <svg class="h-4 w-4" fill={proposal.voters.includes(user?.id ?? '') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      </svg>
                      {proposal.voteCount}
                    </button>
                  {:else}
                    <span class="text-sm text-text-dim">{proposal.voteCount} 票</span>
                  {/if}
                </div>
              </div>
              {#if proposal.roomUrl}
                <a href={proposal.roomUrl} target="_blank" rel="noopener" class="mt-2 inline-block text-xs text-gold hover:underline">
                  查看連結
                </a>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Action buttons -->
  <div class="mb-8 flex flex-wrap gap-3">
    {#if group.status === "open" && user && !isMember}
      <button
        onclick={handleJoin}
        disabled={joining || (user.creditScore < group.minCredit)}
        class="flex-1 rounded-lg bg-gold py-3 font-semibold text-bg transition-all hover:bg-gold-dim hover:shadow-[0_0_30px_var(--color-gold-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if user.creditScore < group.minCredit}
          信用分數不足（需 {group.minCredit} 分）
        {:else if joining}
          加入中...
        {:else}
          我要參加
        {/if}
      </button>
    {:else if !user && group.status === "open"}
      <a
        href="/auth/facebook"
        class="flex-1 block rounded-lg bg-gold py-3 text-center font-semibold text-bg transition-all hover:bg-gold-dim"
      >
        登入後報名
      </a>
    {/if}

    {#if isMember && !isHost && group.status !== "completed" && group.status !== "cancelled"}
      <button
        onclick={handleLeave}
        class="rounded-lg border border-border px-6 py-3 text-sm text-text-dim transition-colors hover:border-danger/30 hover:text-danger"
      >
        退出
      </button>
    {/if}
  </div>

  <!-- Host controls -->
  {#if isHost && group.status !== "completed" && group.status !== "cancelled"}
    <div class="mb-8 rounded-xl border border-gold/20 bg-gold/5 p-5">
      <h3 class="font-display mb-3 text-sm font-bold text-gold">團主控制</h3>
      <div class="flex flex-wrap gap-3">
        {#if canConfirmAttendance}
          <button
            onclick={initAttendance}
            class="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-gold-dim"
          >
            確認出席
          </button>
        {/if}
        <button
          onclick={handleCancelGroup}
          class="rounded-lg border border-danger/30 px-5 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
        >
          取消此團
        </button>
      </div>
    </div>
  {/if}

  <!-- Attendance confirmation modal -->
  {#if showAttendance}
    <div class="mb-8 rounded-xl border border-gold/30 bg-surface p-5">
      <h3 class="font-display mb-4 text-lg font-bold">確認出席狀態</h3>
      <div class="space-y-3">
        {#each members.filter((m) => m.status === "accepted" && m.userId !== group.hostId) as member}
          <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div class="flex items-center gap-3">
              {#if member.avatarUrl}
                <img src={member.avatarUrl} alt="" class="h-8 w-8 rounded-full object-cover" />
              {:else}
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-border text-xs text-text-dim">
                  {member.displayName.charAt(0)}
                </div>
              {/if}
              <span class="text-sm font-medium">{member.displayName}</span>
            </div>
            <div class="flex gap-2">
              {#each [
                { value: "attended", label: "出席", color: "success" },
                { value: "no_show", label: "跳車", color: "danger" },
                { value: "excused", label: "請假", color: "warning" },
              ] as opt}
                <button
                  onclick={() => (attendanceMap[member.id] = opt.value)}
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors
                    {attendanceMap[member.id] === opt.value
                      ? opt.color === 'success' ? 'bg-success/20 text-success' :
                        opt.color === 'danger' ? 'bg-danger/20 text-danger' :
                        'bg-warning/20 text-warning'
                      : 'bg-surface text-text-dim hover:text-text border border-border'}"
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <div class="mt-4 flex gap-3">
        <button
          onclick={submitAttendance}
          disabled={submittingAttendance}
          class="rounded-lg bg-gold px-6 py-2 text-sm font-semibold text-bg transition-colors hover:bg-gold-dim disabled:opacity-50"
        >
          {submittingAttendance ? "提交中..." : "確認提交"}
        </button>
        <button
          onclick={() => (showAttendance = false)}
          class="rounded-lg border border-border px-6 py-2 text-sm text-text-dim hover:text-text"
        >
          取消
        </button>
      </div>
    </div>
  {/if}

  <!-- Pending members for host approval -->
  {#if isHost && pendingMembers.length > 0}
    <div class="mb-8">
      <h2 class="font-display mb-3 text-lg font-bold text-warning">待審核 ({pendingMembers.length})</h2>
      <div class="space-y-2">
        {#each pendingMembers as member}
          <div class="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
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
                <span class="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">{member.creditScore}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                onclick={() => handleApproveMember(member.id)}
                class="rounded-md bg-success/20 px-3 py-1 text-xs font-medium text-success transition-colors hover:bg-success/30"
              >
                接受
              </button>
              <button
                onclick={() => handleRejectMember(member.id)}
                class="rounded-md bg-danger/20 px-3 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/30"
              >
                拒絕
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Members -->
  <div>
    <h2 class="font-display mb-4 text-xl font-bold">成員 ({acceptedCount}/{group.maxMembers})</h2>
    <div class="space-y-2">
      {#each members.filter((m) => m.status !== "pending") as member}
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
            <span class="text-xs
              {member.status === 'attended' ? 'text-success' :
               member.status === 'no_show' ? 'text-danger' :
               'text-text-dim'}">
              {memberStatusLabels[member.status]}
            </span>
            {#if isCompleted && member.status === "no_show" && user && user.id !== member.userId && isMember}
              <button
                onclick={() => (reportingUserId = member.userId)}
                class="rounded-md border border-danger/30 px-2 py-0.5 text-xs text-danger transition-colors hover:bg-danger/10"
              >
                檢舉
              </button>
            {/if}
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

  <!-- Report modal -->
  {#if reportingUserId}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div class="mx-4 w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h3 class="font-display mb-4 text-lg font-bold">檢舉跳車</h3>
        <textarea
          bind:value={reportReason}
          placeholder="檢舉原因（選填）"
          rows="3"
          class="mb-4 w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
        ></textarea>
        <div class="flex gap-3">
          <button
            onclick={submitReport}
            class="rounded-lg bg-danger px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger/80"
          >
            確認檢舉
          </button>
          <button
            onclick={() => { reportingUserId = null; reportReason = ""; }}
            class="rounded-lg border border-border px-5 py-2 text-sm text-text-dim hover:text-text"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
