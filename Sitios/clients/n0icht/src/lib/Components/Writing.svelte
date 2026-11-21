<script>
  /**
   * Notas: la lista de posts, de más nuevo a más viejo. La sección solo aparece cuando el flag
   * `features.writing` está prendido (en `sections`), pero el componente y el contenido ya
   * quedan listos y validados.
   *
   * El título es un link salvo que el post sea placeholder (`todo: true`): entonces es texto
   * plano con el tag de placeholder, nunca un `<a>` a una URL que no existe. La fecha se muestra
   * en ISO tal como está en el contenido, sin formateo regional.
   */
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { ui } from "$lib/content/site.js";
  import { writing as copy } from "$lib/content/writing.js";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import Tag from "./Tag.svelte";

  /** Número de la micro-etiqueta de la sección (`01`). */
  export let index = "";

  /** @param {string} href */
  const isExternal = (href) => href.startsWith("https://");
</script>

<Section id={copy.id} {index} title={copy.title} lead={copy.lead} class="n0-writing">
  <ol class="n0-writing-list">
    {#each copy.posts as post (post.href)}
      <li>
        <div class="fx-reveal" use:reveal>
          <Panel class="n0-post">
            <article>
              <time class="n0-micro" datetime={post.date}>{post.date}</time>
              <h3>
                {#if post.todo}
                  {post.title}
                {:else}
                  <a href={post.href} target={isExternal(post.href) ? "_blank" : undefined} rel={isExternal(post.href) ? "noopener noreferrer" : undefined}>
                    {post.title}<span class="n0-sr"> · {copy.readLabel}</span>
                  </a>
                {/if}
              </h3>
              <p class="n0-post-summary">{post.summary}</p>
              <ul class="n0-post-tags">
                {#each post.tags as tag}
                  <li><Tag>{tag}</Tag></li>
                {/each}
                {#if post.todo}
                  <li><Tag tone="amber">{ui.placeholderTag}</Tag></li>
                {/if}
              </ul>
            </article>
          </Panel>
        </div>
      </li>
    {/each}
  </ol>
</Section>
