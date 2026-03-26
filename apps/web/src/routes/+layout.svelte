<script lang="ts">
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";
  import { navigating } from "$app/state";

  let { data, children } = $props();
</script>

<div class="flex min-h-dvh flex-col">
  <!-- Navigation loading bar -->
  {#if navigating.to}
    <div class="fixed top-0 left-0 z-[100] h-0.5 w-full">
      <div class="h-full animate-pulse bg-gold" style="animation: loading-bar 1s ease-in-out infinite;"></div>
    </div>
  {/if}

  <Navbar user={data.user} />
  <main class="flex-1">
    {@render children()}
  </main>
  <footer class="border-t border-border py-6 text-center text-xs text-text-dim">
    &copy; {new Date().getFullYear()} Escape Group. All rights reserved.
  </footer>
</div>

<style>
  @keyframes loading-bar {
    0% { width: 0; }
    50% { width: 70%; }
    100% { width: 100%; }
  }
</style>
