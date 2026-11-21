<script>
  /**
   * Botón. Con `href` es un link con forma de botón; sin `href`, un `<button>` que reenvía el
   * click. Los estilos están en site.css (`.site-btn`).
   */

  /** Si está, se renderiza como `<a>`. */
  export let href = "";

  /** `primary` (ámbar, la acción principal) o `ghost` (solo borde). */
  export let variant = "primary";

  /** Solo para `<button>`. */
  export let type = "button";
</script>

{#if href}
  <a class="site-btn" class:is-ghost={variant === "ghost"} {href} {...$$restProps}><slot /></a>
{:else}
  <button class="site-btn" class:is-ghost={variant === "ghost"} {type} on:click {...$$restProps}><slot /></button>
{/if}
