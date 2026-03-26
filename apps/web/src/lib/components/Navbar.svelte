<script lang="ts">
  type User = {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    creditScore: number;
    phone: string | null;
    isFlagged: boolean;
  };

  type Notifications = {
    pendingApprovals: number;
    matchedGroups: number;
  };

  let { user, notifications = { pendingApprovals: 0, matchedGroups: 0 } }: { user: User | null; notifications?: Notifications } = $props();
  const totalNotifs = (notifications?.pendingApprovals ?? 0) + (notifications?.matchedGroups ?? 0);
  let menuOpen = $state(false);
</script>

<nav class="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-xl">
  <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
    <a href="/" class="font-display text-xl font-bold tracking-wider text-gold">
      ESCAPE GROUP
    </a>

    <div class="hidden items-center gap-6 md:flex">
      <a href="/groups" class="text-sm font-medium text-text-dim transition-colors hover:text-gold">
        瀏覽開團
      </a>
      {#if user}
        <a href="/my-groups" class="relative text-sm font-medium text-text-dim transition-colors hover:text-gold">
          我的團
          {#if totalNotifs > 0}
            <span class="absolute -top-1.5 -right-3 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {totalNotifs}
            </span>
          {/if}
        </a>
        <a href="/match" class="text-sm font-medium text-text-dim transition-colors hover:text-gold">
          配對
        </a>
        <a href="/groups/new" class="text-sm font-medium text-text-dim transition-colors hover:text-gold">
          開團
        </a>
        <a href="/profile" class="flex items-center gap-2 text-sm font-medium text-text-dim transition-colors hover:text-gold">
          {#if user.avatarUrl}
            <img src={user.avatarUrl} alt="" class="h-6 w-6 rounded-full object-cover" />
          {/if}
          <span>{user.displayName}</span>
          <span class="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
            {user.creditScore}
          </span>
        </a>
      {:else}
        <a
          href="/auth/facebook"
          class="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-bg transition-colors hover:bg-gold-dim"
        >
          Facebook 登入
        </a>
      {/if}
    </div>

    <!-- Mobile menu button -->
    <button
      class="text-text-dim md:hidden"
      onclick={() => (menuOpen = !menuOpen)}
      aria-label="Toggle menu"
    >
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {#if menuOpen}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        {:else}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        {/if}
      </svg>
    </button>
  </div>

  {#if menuOpen}
    <div class="border-t border-border px-4 py-3 md:hidden">
      <div class="flex flex-col gap-3">
        <a href="/groups" class="text-sm text-text-dim" onclick={() => (menuOpen = false)}>瀏覽開團</a>
        {#if user}
          <a href="/my-groups" class="text-sm text-text-dim" onclick={() => (menuOpen = false)}>我的團</a>
          <a href="/match" class="text-sm text-text-dim" onclick={() => (menuOpen = false)}>配對找團</a>
          <a href="/groups/new" class="text-sm text-text-dim" onclick={() => (menuOpen = false)}>開新團</a>
          <a href="/profile" class="text-sm text-text-dim" onclick={() => (menuOpen = false)}>個人檔案</a>
        {:else}
          <a href="/auth/facebook" class="text-sm text-gold">Facebook 登入</a>
        {/if}
      </div>
    </div>
  {/if}
</nav>
