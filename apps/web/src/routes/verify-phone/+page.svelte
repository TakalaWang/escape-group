<script lang="ts">
  let phone = $state("");
  let code = $state("");
  let step = $state<"phone" | "code">("phone");
  let loading = $state(false);
  let errorMsg = $state("");

  async function sendCode() {
    loading = true;
    errorMsg = "";
    const res = await fetch("/auth/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (res.ok) {
      step = "code";
    } else {
      const err = await res.json();
      errorMsg = err.message || "發送失敗";
    }
    loading = false;
  }

  async function verifyCode() {
    loading = true;
    errorMsg = "";
    const res = await fetch("/auth/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (res.ok) {
      window.location.href = "/profile";
    } else {
      const err = await res.json();
      errorMsg = err.message || "驗證失敗";
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>手機驗證 | Escape Group</title>
</svelte:head>

<div class="mx-auto max-w-md px-4 py-16">
  <div class="rounded-xl border border-border bg-surface p-8">
    <div class="mb-6 text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold"
      >
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h1 class="font-display text-2xl font-bold">手機驗證</h1>
      <p class="mt-2 text-sm text-text-dim">綁定手機號碼以啟用開團與報名功能</p>
    </div>

    {#if errorMsg}
      <div
        class="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger"
      >
        {errorMsg}
      </div>
    {/if}

    {#if step === "phone"}
      <div class="space-y-4">
        <div>
          <label for="phone" class="mb-1 block text-sm text-text-dim">手機號碼</label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            placeholder="0912345678"
            class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-dim/50 focus:border-gold focus:outline-none"
          />
          <p class="mt-1 text-xs text-text-dim">請輸入台灣手機號碼（09 開頭）</p>
        </div>
        <button
          onclick={sendCode}
          disabled={loading || !phone}
          class="w-full rounded-lg bg-gold py-2.5 font-semibold text-bg transition-all hover:bg-gold-dim disabled:opacity-50"
        >
          {loading ? "傳送中..." : "發送驗證碼"}
        </button>
      </div>
    {:else}
      <div class="space-y-4">
        <p class="text-sm text-text-dim">
          驗證碼已發送至 <span class="font-medium text-text">{phone}</span>
        </p>
        <div>
          <label for="code" class="mb-1 block text-sm text-text-dim">驗證碼</label>
          <input
            id="code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            bind:value={code}
            placeholder="六位數驗證碼"
            class="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-center text-lg tracking-[0.5em] text-text placeholder:text-text-dim/50 placeholder:tracking-normal focus:border-gold focus:outline-none"
          />
        </div>
        <button
          onclick={verifyCode}
          disabled={loading || code.length !== 6}
          class="w-full rounded-lg bg-gold py-2.5 font-semibold text-bg transition-all hover:bg-gold-dim disabled:opacity-50"
        >
          {loading ? "驗證中..." : "確認驗證"}
        </button>
        <button
          onclick={() => (step = "phone")}
          class="w-full text-center text-sm text-text-dim hover:text-text"
        >
          重新輸入手機號碼
        </button>
      </div>
    {/if}
  </div>
</div>
