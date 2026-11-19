<script>
  /**
   * Terminal del hero: secuencia de arranque y una línea de comandos que funciona.
   *
   * La lógica está en `src/lib/terminal/` (parser, comandos, sesión, tiempos del arranque) y no
   * toca el DOM; este componente solo dibuja la sesión y aplica los efectos.
   *
   * - Arranque: el HTML prerenderizado ya trae todas las líneas. El tipeo es una animación de CSS
   *   con los tiempos de `boot.ts`, así que no hay cambio de contenido al hidratar. Se saltea con
   *   el botón, o escribiendo o corriendo cualquier comando. Con movimiento reducido no se anima.
   * - La salida es un `role="log"` con `aria-live="polite"`: un lector de pantalla anuncia lo que
   *   imprime cada comando. Se puede enfocar para scrollearla con el teclado.
   * - Flechas arriba y abajo recorren el historial.
   * - El campo queda deshabilitado hasta que hidrata: sin JavaScript no promete algo que no anda.
   * - La paleta de comandos puede pedir que se corra un comando acá (`terminalRequest`).
   *
   * Los estilos están en terminal.css.
   */
  import { onMount, tick } from "svelte";
  import { terminalContent } from "$lib/content/index.js";
  import { terminal as copy } from "$lib/content/terminal.js";
  import { runEffects, terminalRequest } from "$lib/stores/ui.js";
  import { bootSequence } from "$lib/terminal/boot.ts";
  import { MAX_INPUT } from "$lib/terminal/parser.ts";
  import { createSession, historyNext, historyPrev, submit } from "$lib/terminal/session.ts";
  import Panel from "./Panel.svelte";
  import StatusDot from "./StatusDot.svelte";

  /** Cuánto dura el destello de `deploy --prod` (ms). */
  const PULSE_MS = 1400;

  const boot = bootSequence(copy.boot);

  let session = createSession(boot.lines);
  let value = "";
  let ready = false; // hidrató: el campo acepta comandos
  let booting = false; // el arranque se está tipeando (se ve el botón para saltearlo)
  let settled = false; // el arranque terminó o se salteó: ya no hay animación
  let pulsing = false;
  let screen;
  let input;
  let bootTimer;
  let pulseTimer;

  function endBoot() {
    clearTimeout(bootTimer);
    booting = false;
    settled = true;
  }

  /** Variables de CSS de una línea del arranque: caracteres, espera y duración. */
  function typingStyle(line) {
    const typing = line.typing;
    return typing ? `--n:${typing.chars};--d:${typing.delay}ms;--t:${typing.duration}ms` : undefined;
  }

  /** Los links a otros sitios abren en otra pestaña; el mail, no. */
  function linkAttrs(href) {
    return href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};
  }

  async function run(command) {
    endBoot();
    const result = submit(session, command, terminalContent);
    session = result.session;
    value = "";

    if (result.effects.some((effect) => effect.type === "pulse")) {
      pulsing = true;
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => (pulsing = false), PULSE_MS);
    }
    runEffects(result.effects);

    await tick();
    if (screen) screen.scrollTop = screen.scrollHeight;
  }

  async function recall(step) {
    session = step.session;
    value = step.value;
    await tick();
    input.setSelectionRange(value.length, value.length);
  }

  function onKeydown(event) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      recall(historyPrev(session, value));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      recall(historyNext(session, value));
    } else if (booting && event.key.length === 1) {
      endBoot();
    }
  }

  // Click en la salida: lleva el cursor al campo, salvo que se esté seleccionando texto para copiar
  function onScreenClick(event) {
    if (event.target.closest("a") || window.getSelection()?.toString()) return;
    input.focus({ preventScroll: true });
  }

  onMount(() => {
    ready = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settled = true;
    } else {
      booting = true;
      bootTimer = setTimeout(endBoot, boot.total);
    }

    // Un comando pedido desde la paleta: se corre y el foco queda en la salida, para leerla
    const unsubscribe = terminalRequest.subscribe(async (command) => {
      if (command === null) return;
      terminalRequest.set(null);
      await run(command);
      screen.focus();
    });

    return () => {
      unsubscribe();
      clearTimeout(bootTimer);
      clearTimeout(pulseTimer);
    };
  });
</script>

<Panel flush class="n0-term{settled ? ' is-settled' : ''}{pulsing ? ' is-pulse' : ''}">
  <div class="n0-term-bar">
    <StatusDot state="online" />
    <span class="n0-term-title">{copy.title}</span>
    {#if booting}
      <button type="button" class="n0-term-skip" on:click={endBoot}>{copy.skip}</button>
    {/if}
  </div>

  <!-- El click es un atajo para el mouse (el campo se alcanza con Tab) y el tabindex deja scrollear
       la salida con el teclado. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <div
    class="n0-term-screen"
    bind:this={screen}
    role="log"
    aria-live="polite"
    aria-label={copy.outputLabel}
    tabindex="0"
    on:click={onScreenClick}
  >
    {#each session.lines as line}
      <div class="n0-term-line is-{line.kind}" class:is-typed={line.typing} style={typingStyle(line)}>
        {#if line.kind === "input"}<span class="n0-term-ps">{copy.prompt}</span>{/if}
        {#if line.tag}<span class="n0-term-tag">{line.tag}</span>{/if}
        {#if line.href}
          <a class="n0-term-text" href={line.href} {...linkAttrs(line.href)}>{line.text}</a>
        {:else}
          <span class="n0-term-text">{line.text}</span>
        {/if}
      </div>
    {/each}
  </div>

  <form class="n0-term-form" on:submit|preventDefault={() => run(value)}>
    <label for="n0-term-input">
      <span class="n0-sr">{copy.inputLabel}</span>
      <span aria-hidden="true">{copy.prompt}</span>
    </label>
    <input
      id="n0-term-input"
      class="n0-term-input"
      bind:this={input}
      bind:value
      type="text"
      autocomplete="off"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="send"
      maxlength={MAX_INPUT}
      placeholder={copy.placeholder}
      disabled={!ready}
      on:keydown={onKeydown}
    />
  </form>

  <div class="n0-term-try">
    <span class="n0-micro">{copy.tryLabel}</span>
    {#each copy.suggestions as suggestion}
      <button type="button" class="n0-chip" disabled={!ready} on:click={() => run(suggestion)}>{suggestion}</button>
    {/each}
  </div>
</Panel>
