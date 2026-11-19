<script>
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import Container from "$lib/Components/Container.svelte";
  import Hero from "$lib/Components/Hero.svelte";
  import Panel from "$lib/Components/Panel.svelte";
  import SectionHeader from "$lib/Components/SectionHeader.svelte";
  import StatusDot from "$lib/Components/StatusDot.svelte";
  import Tag from "$lib/Components/Tag.svelte";
  import { pendingSections, ui } from "$lib/content/site.js";
</script>

<!-- Una <section id> por bloque; el menú y la paleta apuntan a esos ids. tabindex="-1" deja que la
     paleta les pase el foco al navegar. -->
<main id="main">
  <Hero />

  <!-- Secciones que todavía no están construidas: reservan el ancla con un panel provisorio -->
  {#each pendingSections as section}
    <section id={section.id} class="site-section n0-pending" tabindex="-1" aria-labelledby="{section.id}-title">
      <Container>
        <!-- El reveal va adentro y no en la <section>: si la sección misma se desplaza, el ancla
             queda corrida al navegar -->
        <div class="fx-reveal" use:reveal>
          <SectionHeader
            label={ui.sectionLabel}
            index={section.index}
            title={section.title}
            headingId="{section.id}-title"
          />
          <Panel label="{ui.pendingLabel}//{section.id}">
            <Tag slot="status" tone="amber">{ui.pendingTag}</Tag>
            <p>{section.summary}</p>
            <div class="n0-pending-status">
              <StatusDot state="pending" label={ui.pendingStatus} />
            </div>
          </Panel>
        </div>
      </Container>
    </section>
  {/each}
</main>
