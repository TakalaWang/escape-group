<script lang="ts">
  import { onMount } from "svelte";

  type MatchRequest = {
    id: string;
    status: string;
    matchedGroupId: string | null;
    timeRangeStart: string;
    timeRangeEnd: string;
    createdAt: string;
    roomName: string;
    roomStudio: string | null;
    roomLocation: string | null;
  };

  let requests = $state<MatchRequest[]>([]);
  let loading = $state(true);
  let submitting = $state(false);
  let form = $state({
    roomName: "",
    roomStudio: "",
    roomUrl: "",
    roomLocation: "",
    timeRangeStart: "",
    timeRangeEnd: "",
  });

  const statusLabels: Record<string, string> = {
    waiting: "等待配對中",
    matched: "已配對",
    expired: "已過期",
  };

  onMount(loadRequests);

  async function loadRequests() {
    loading = true;
    const res = await fetch("/api/match");
    if (res.ok) requests = await res.json();
    loading = false;
  }

  async function submitRequest() {
    submitting = true;
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const data = await res.json();
      form = {
        roomName: "",
        roomStudio: "",
        roomUrl: "",
        roomLocation: "",
        timeRangeStart: "",
        timeRangeEnd: "",
      };
      if (data.matchedGroupId) {
        window.location.href = `/groups/${data.matchedGroupId}`;
      } else {
        await loadRequests();
      }
    } else {
      const err = await res.json();
      alert(err.message || "提交失敗");
    }
    submitting = false;
  }

  async function cancelRequest(requestId: string) {
    const res = await fetch("/api/match", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (res.ok) await loadRequests();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<svelte:head>
  <title>配對找團 | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
  <h1 class="font-display mb-2 text-3xl font-bold">配對找團</h1>
  <p class="mb-8 text-sm text-text-dim">
    填入想玩的密室和可接受時間，系統會自動幫你配對同好組團。4 人以上自動成團。
  </p>

  <!-- Submit form -->
  <div class="mb-8 rounded-xl border border-border bg-surface p-6">
    <h2 class="font-display mb-4 text-lg font-bold">我想玩...</h2>
    <div class="space-y-4">
      <div>
        <label for="roomName" class="mb-1 block text-sm text-text-dim">密室名稱 *</label>
        <input
          id="roomName"
          bind:value={form.roomName}
          placeholder="例：末日列車"
          class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="roomStudio" class="mb-1 block text-sm text-text-dim">工作室</label>
          <input
            id="roomStudio"
            bind:value={form.roomStudio}
            placeholder="例：笨蛋工作室"
            class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
          />
        </div>
        <div>
          <label for="roomLocation" class="mb-1 block text-sm text-text-dim">地區</label>
          <input
            id="roomLocation"
            bind:value={form.roomLocation}
            placeholder="例：台北市中山區"
            class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="timeStart" class="mb-1 block text-sm text-text-dim">最早時間 *</label>
          <input
            id="timeStart"
            type="datetime-local"
            bind:value={form.timeRangeStart}
            class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
          />
        </div>
        <div>
          <label for="timeEnd" class="mb-1 block text-sm text-text-dim">最晚時間 *</label>
          <input
            id="timeEnd"
            type="datetime-local"
            bind:value={form.timeRangeEnd}
            class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <button
        onclick={submitRequest}
        disabled={submitting || !form.roomName || !form.timeRangeStart || !form.timeRangeEnd}
        class="w-full rounded-lg bg-gold py-3 font-semibold text-bg transition-all hover:bg-gold-dim hover:shadow-[0_0_30px_var(--color-gold-glow)] disabled:opacity-50"
      >
        {submitting ? "提交中..." : "加入配對"}
      </button>
    </div>
  </div>

  <!-- My requests -->
  <h2 class="font-display mb-4 text-xl font-bold">我的配對請求</h2>

  {#if loading}
    <div class="py-8 text-center text-text-dim">載入中...</div>
  {:else if requests.length === 0}
    <div class="rounded-xl border border-dashed border-border py-12 text-center text-text-dim">
      還沒有配對請求
    </div>
  {:else}
    <div class="space-y-3">
      {#each requests as req}
        <div
          class="rounded-xl border bg-surface p-4 {req.status === 'matched'
            ? 'border-success/30 bg-success/5'
            : req.status === 'expired'
              ? 'border-text-dim/20'
              : 'border-gold/20'}"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="font-medium">{req.roomName}</div>
              {#if req.roomStudio}
                <div class="text-xs text-text-dim">{req.roomStudio}</div>
              {/if}
              <div class="mt-1 text-xs text-text-dim">
                {formatDate(req.timeRangeStart)} — {formatDate(req.timeRangeEnd)}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="text-xs {req.status === 'matched'
                  ? 'text-success'
                  : req.status === 'expired'
                    ? 'text-text-dim'
                    : 'text-gold'}"
              >
                {statusLabels[req.status]}
              </span>
              {#if req.status === "waiting"}
                <button
                  onclick={() => cancelRequest(req.id)}
                  class="rounded-md border border-border px-2 py-0.5 text-xs text-text-dim hover:border-danger/30 hover:text-danger"
                >
                  取消
                </button>
              {/if}
              {#if req.status === "matched" && req.matchedGroupId}
                <a
                  href="/groups/{req.matchedGroupId}"
                  class="rounded-md bg-success/20 px-2 py-0.5 text-xs font-medium text-success"
                >
                  查看團
                </a>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
