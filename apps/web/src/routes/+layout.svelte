<script lang="ts">
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";

  let { data, children } = $props();
</script>

<div class="flex min-h-dvh flex-col">
  <Navbar user={data.user} />
  <main class="flex-1">
    {@render children()}
  </main>
  <footer class="border-t border-border py-6 text-center text-xs text-text-dim">
    &copy; {new Date().getFullYear()} Escape Group. All rights reserved.
  </footer>
</div>
