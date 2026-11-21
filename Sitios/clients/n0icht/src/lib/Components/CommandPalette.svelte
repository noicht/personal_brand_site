<script>
  /**
   * Paleta de comandos (Cmd/Ctrl+K, o el botón del header). En pantallas chicas es también el
   * menú: desde acá se va a cada sección.
   *
   * Es un `<dialog>` modal: el navegador atrapa el foco adentro, deja el resto de la página
   * inerte, cierra con Esc y al cerrar devuelve el foco a donde estaba.
   *
   * Adentro sigue el patrón combobox + listbox: el foco se queda en el campo y las flechas mueven
   * la opción activa (`aria-activedescendant`). Enter la ejecuta.
   *
   * La lista y el filtro están en `src/lib/terminal/palette.ts`; cada opción lleva un efecto (ir a
   * una sección, correr un comando en la terminal, abrir un link) que aplica `runEffects`.
   *
   * El layout la carga la primera vez que se abre. Se abre con `openPalette` y sigue al store
   * `paletteOpen`.
   * Los estilos están en terminal.css.
   */
  import { tick } from "svelte";
  import { terminalContent } from "$lib/content/index.js";
  import { palette as copy } from "$lib/content/site.js";
  import { paletteOpen, paletteOpenedByTouch, runEffects } from "$lib/stores/ui.js";
  import { buildPaletteItems, filterPaletteItems } from "$lib/terminal/palette.ts";
  import Panel from "./Panel.svelte";

  const items = buildPaletteItems(terminalContent, { ...copy.groups, email: copy.emailLabel });

  let dialog;
  let list;
  let closeButton;
  let query = "";
  let active = 0;

  $: results = filterPaletteItems(items, query);
  $: activeId = results[active] ? `n0-palette-${results[active].id}` : undefined;

  // El store manda: cuando cambia, se abre o se cierra el <dialog>
  $: if (dialog) {
    if ($paletteOpen && !dialog.open) open();
    else if (!$paletteOpen && dialog.open) dialog.close();
  }

  function open() {
    query = "";
    active = 0;
    dialog.showModal(); // el foco va al campo, que es lo primero enfocable
    // Si se abrió con el dedo, el foco va al botón de cerrar: así no salta el teclado encima de la lista
    if (paletteOpenedByTouch()) closeButton.focus();
  }

  function close() {
    paletteOpen.set(false);
  }

  async function move(to) {
    if (results.length === 0) return;
    active = (to + results.length) % results.length;
    await tick();
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }

  async function choose(item) {
    if (!item) return;
    close();
    await tick(); // el <dialog> ya cerró y devolvió el foco: el efecto puede moverlo
    runEffects([item.effect]);
  }

  function onKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(active - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  }

  // Un click en el <dialog> mismo es un click en el fondo: el panel lo cubre entero
  function onDialogClick(event) {
    if (event.target === dialog) close();
  }
</script>

<!-- El click en el fondo es un atajo para el mouse: con teclado se cierra con Esc o con el botón. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="n0-palette" bind:this={dialog} aria-label={copy.title} on:close={close} on:click={onDialogClick}>
  <Panel flush class="n0-palette-box">
    <div class="n0-palette-search">
      <span aria-hidden="true">&gt;</span>
      <label class="n0-sr" for="n0-palette-input">{copy.inputLabel}</label>
      <input
        id="n0-palette-input"
        class="n0-palette-input"
        bind:value={query}
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="n0-palette-list"
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="go"
        placeholder={copy.placeholder}
        on:input={() => (active = 0)}
        on:keydown={onKeydown}
      />
      <button type="button" class="n0-palette-close" bind:this={closeButton} on:click={close}>{copy.close}</button>
    </div>

    <ul
      id="n0-palette-list"
      class="n0-palette-list"
      role="listbox"
      aria-label={copy.listLabel}
      hidden={results.length === 0}
      bind:this={list}
      tabindex="-1"
    >
      {#each results as item, index (item.id)}
        <!-- El teclado lo maneja el campo (aria-activedescendant): las opciones no reciben foco. -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
        <li
          id="n0-palette-{item.id}"
          class="n0-palette-option"
          role="option"
          aria-selected={index === active}
          on:click={() => choose(item)}
          on:pointermove={() => (active = index)}
        >
          <span class="n0-micro">{item.group}</span>
          <span>{item.label}</span>
          <span class="n0-palette-hint">{item.hint}</span>
        </li>
      {/each}
    </ul>

    {#if results.length === 0}
      <p class="n0-palette-empty" role="status">{copy.empty}</p>
    {/if}

    <p class="n0-palette-foot">{copy.hint}</p>
  </Panel>
</dialog>
