<script lang="ts">
  const appName = "やることだけ";
  const tagline = "思いついた瞬間に、やることだけ。";
</script>

<main>
  <header>
    <h1>{appName}</h1>
    <p class="tagline">{tagline}</p>
  </header>
</main>

<style>
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    font-family: "Zen Kaku Gothic New", sans-serif;
  }

  h1 {
    font-family: "Shippori Mincho", serif;
  }

  .tagline {
    color: var(--color-muted, #666);
  }
</style>
