<script lang="ts">
  import { enhance } from "$app/forms";

  let { form } = $props();
  let mode = $state("host");
</script>

<svelte:head>
  <title>開團 | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
  <h1 class="font-display mb-8 text-3xl font-bold">開新團</h1>

  {#if form?.error}
    <div class="mb-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance class="space-y-8">
    <!-- Mode selection -->
    <fieldset>
      <legend class="mb-3 text-sm font-medium text-text-dim">開團模式</legend>
      <div class="grid grid-cols-3 gap-3">
        {#each [
          { value: "host", label: "團主制", desc: "指定密室和時間" },
          { value: "match", label: "配對制", desc: "系統自動配對" },
          { value: "gather", label: "湊人制", desc: "先找人再選" },
        ] as opt}
          <label
            class="cursor-pointer rounded-xl border p-4 text-center transition-all {mode === opt.value
              ? 'border-gold bg-gold/5 shadow-[0_0_15px_var(--color-gold-glow)]'
              : 'border-border bg-surface hover:border-gold/20'}"
          >
            <input type="radio" name="mode" value={opt.value} bind:group={mode} class="sr-only" />
            <div class="font-display text-sm font-bold">{opt.label}</div>
            <div class="mt-1 text-xs text-text-dim">{opt.desc}</div>
          </label>
        {/each}
      </div>
    </fieldset>

    <!-- Escape room info (for host and match modes) -->
    {#if mode !== "gather"}
      <fieldset class="space-y-4">
        <legend class="mb-1 text-sm font-medium text-text-dim">密室資訊</legend>

        <div>
          <label for="roomName" class="mb-1 block text-sm text-text-dim">密室名稱 *</label>
          <input
            id="roomName"
            name="roomName"
            type="text"
            required
            placeholder="例：末日列車"
            class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="roomStudio" class="mb-1 block text-sm text-text-dim">工作室</label>
            <input
              id="roomStudio"
              name="roomStudio"
              type="text"
              placeholder="例：笨蛋工作室"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label for="roomLocation" class="mb-1 block text-sm text-text-dim">地區</label>
            <input
              id="roomLocation"
              name="roomLocation"
              type="text"
              placeholder="例：台北市中山區"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label for="roomUrl" class="mb-1 block text-sm text-text-dim">連結（選填）</label>
          <input
            id="roomUrl"
            name="roomUrl"
            type="url"
            placeholder="https://..."
            class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="minPlayers" class="mb-1 block text-sm text-text-dim">最少人數</label>
            <input
              id="minPlayers"
              name="minPlayers"
              type="number"
              min="1"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label for="maxPlayers" class="mb-1 block text-sm text-text-dim">最多人數</label>
            <input
              id="maxPlayers"
              name="maxPlayers"
              type="number"
              min="1"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </fieldset>
    {/if}

    <!-- Group settings -->
    <fieldset class="space-y-4">
      <legend class="mb-1 text-sm font-medium text-text-dim">開團設定</legend>

      <div>
        <label for="datetime" class="mb-1 block text-sm text-text-dim">
          {mode === "host" ? "活動時間 *" : "期望時間（選填）"}
        </label>
        <input
          id="datetime"
          name="datetime"
          type="datetime-local"
          required={mode === "host"}
          class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="maxMembers" class="mb-1 block text-sm text-text-dim">需要人數 *</label>
          <input
            id="maxMembers"
            name="maxMembers"
            type="number"
            min="2"
            max="20"
            required
            value="6"
            class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
          />
        </div>
        <div>
          <label for="minCredit" class="mb-1 block text-sm text-text-dim">最低信用門檻</label>
          <input
            id="minCredit"
            name="minCredit"
            type="number"
            min="0"
            max="100"
            value="0"
            class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <label class="flex items-center gap-3">
        <input
          name="autoAccept"
          type="checkbox"
          checked
          class="h-4 w-4 rounded border-border bg-surface text-gold focus:ring-gold"
        />
        <span class="text-sm text-text-dim">自動接受報名（不需手動審核）</span>
      </label>
    </fieldset>

    <button
      type="submit"
      class="w-full rounded-lg bg-gold py-3 font-semibold text-bg transition-all hover:bg-gold-dim hover:shadow-[0_0_30px_var(--color-gold-glow)]"
    >
      發布開團
    </button>
  </form>
</div>
