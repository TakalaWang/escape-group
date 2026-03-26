<script lang="ts">
  let { data } = $props();
</script>

<div class="relative overflow-hidden">
  <!-- Hero background effects -->
  <div class="pointer-events-none absolute inset-0">
    <div class="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gold/5 blur-[120px]"></div>
    <div class="absolute bottom-0 left-0 h-[300px] w-[400px] rounded-full bg-gold/3 blur-[80px]"></div>
  </div>

  <!-- Hero -->
  <section class="relative mx-auto max-w-5xl px-4 pb-20 pt-24 text-center">
    <div class="mb-4 inline-block rounded-full border border-gold/20 bg-gold/5 px-4 py-1 text-xs font-medium tracking-wider text-gold">
      密室逃脫揪團平台
    </div>

    <h1 class="font-display text-4xl font-bold leading-tight tracking-wide text-text md:text-6xl">
      再也不怕
      <span class="text-gold">被放鴿子</span>
    </h1>

    <p class="mx-auto mt-6 max-w-xl text-lg text-text-dim">
      信用制度保障每一場密室體驗。輕鬆開團、安心揪人、告別跳車。
    </p>

    <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
      <a
        href="/groups"
        class="rounded-lg bg-gold px-8 py-3 font-semibold text-bg transition-all hover:bg-gold-dim hover:shadow-[0_0_30px_var(--color-gold-glow)]"
      >
        瀏覽開團
      </a>
      {#if !data.user}
        <a
          href="/auth/facebook"
          class="rounded-lg border border-border px-8 py-3 font-semibold text-text-dim transition-colors hover:border-gold/30 hover:text-text"
        >
          Facebook 登入
        </a>
      {:else}
        <a
          href="/groups/new"
          class="rounded-lg border border-border px-8 py-3 font-semibold text-text-dim transition-colors hover:border-gold/30 hover:text-text"
        >
          我要開團
        </a>
      {/if}
    </div>
  </section>

  <!-- Features -->
  <section class="relative mx-auto max-w-5xl px-4 pb-24">
    <div class="grid gap-6 md:grid-cols-3">
      <div class="rounded-xl border border-border bg-surface p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 class="font-display mb-2 text-lg font-bold">信用保障</h3>
        <p class="text-sm text-text-dim">
          每位玩家都有信用分數，跳車紀錄一目瞭然。設定門檻，只跟靠譜的人玩。
        </p>
      </div>

      <div class="rounded-xl border border-border bg-surface p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 class="font-display mb-2 text-lg font-bold">多種開團模式</h3>
        <p class="text-sm text-text-dim">
          團主制、配對制、先湊人再選 — 無論你是揪咖還是找團，都有適合的方式。
        </p>
      </div>

      <div class="rounded-xl border border-border bg-surface p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h3 class="font-display mb-2 text-lg font-bold">實名驗證</h3>
        <p class="text-sm text-text-dim">
          Facebook + 手機雙重綁定，一人一帳號，杜絕分身小帳。
        </p>
      </div>
    </div>
  </section>
</div>
