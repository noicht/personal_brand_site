<script>
  import Contact from "$lib/Components/Contact.svelte";
  import Experience from "$lib/Components/Experience.svelte";
  import Hero from "$lib/Components/Hero.svelte";
  import PendingSection from "$lib/Components/PendingSection.svelte";
  import Pipeline from "$lib/Components/Pipeline.svelte";
  import PlaygroundSection from "$lib/Components/PlaygroundSection.svelte";
  import Projects from "$lib/Components/Projects.svelte";
  import StackPanel from "$lib/Components/StackPanel.svelte";
  import Writing from "$lib/Components/Writing.svelte";
  import { pendingSections, sections } from "$lib/content/site.js";

  /** Secciones construidas por id; el resto cae en el panel provisorio. */
  const built = {
    pipeline: Pipeline,
    projects: Projects,
    playground: PlaygroundSection,
    stack: StackPanel,
    experience: Experience,
    writing: Writing,
    contact: Contact,
  };

  /** @param {string} id */
  const stubFor = (id) => pendingSections.find((stub) => stub.id === id);
</script>

<!-- Una <section id> por bloque, en el orden de `sections`; el menú y la paleta apuntan a esos
     ids. Las secciones detrás de una flag apagada no llegan a esta lista. -->
<main id="main">
  <Hero />

  {#each sections as section (section.id)}
    {#if built[section.id]}
      <svelte:component this={built[section.id]} index={section.index} />
    {:else}
      <PendingSection stub={stubFor(section.id)} index={section.index} />
    {/if}
  {/each}
</main>
