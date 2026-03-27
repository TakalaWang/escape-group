<script lang="ts">
  type Group = {
    id: string;
    mode: string;
    datetime: string | null;
    timeRangeStart: string | null;
    timeRangeEnd: string | null;
    maxMembers: number;
    currentMembers: number;
    minCredit: number;
    hostName: string;
    hostCredit: number;
    roomName: string | null;
    roomStudio: string | null;
    roomLocation: string | null;
  };

  let { group }: { group: Group } = $props();

  const modeLabels: Record<string, string> = {
    host: "團主制",
    match: "配對制",
    gather: "湊人制",
  };

  function formatDate(d: string | null) {
    if (!d) return "待定";
    return new Date(d).toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<a
  href="/groups/{group.id}"
  class="group block rounded-xl border border-border bg-surface p-5 transition-all hover:border-gold/30 hover:bg-surface-hover hover:shadow-[0_0_20px_var(--color-gold-glow)]"
>
  <div class="mb-3 flex items-start justify-between">
    <div>
      <h3 class="font-display text-lg font-bold text-text">
        {group.roomName ?? "待選密室"}
      </h3>
      {#if group.roomStudio}
        <p class="text-xs text-text-dim">{group.roomStudio}</p>
      {/if}
    </div>
    <span class="rounded-md bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
      {modeLabels[group.mode] ?? group.mode}
    </span>
  </div>

  <div class="mb-4 flex flex-wrap gap-3 text-sm text-text-dim">
    {#if group.roomLocation}
      <span class="flex items-center gap-1">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {group.roomLocation}
      </span>
    {/if}
    <span class="flex items-center gap-1">
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      {formatDate(group.datetime ?? group.timeRangeStart)}
    </span>
  </div>

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2 text-sm">
      <span class="text-text-dim">開團者</span>
      <span class="font-medium text-text">{group.hostName}</span>
      <span class="rounded-full bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{group.hostCredit}</span
      >
    </div>
    <div class="flex items-center gap-1 text-sm">
      <svg class="h-4 w-4 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <span
        class:text-success={group.currentMembers < group.maxMembers}
        class:text-danger={group.currentMembers >= group.maxMembers}
      >
        {group.currentMembers}/{group.maxMembers}
      </span>
    </div>
  </div>

  {#if group.minCredit > 0}
    <div class="mt-2 text-xs text-warning">
      最低信用要求: {group.minCredit}
    </div>
  {/if}
</a>
