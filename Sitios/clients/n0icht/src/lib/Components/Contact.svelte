<script>
  /**
   * Contacto: un formulario con pinta de terminal dentro de un panel.
   *
   * - Todo está prerenderizado: sin JavaScript se ve el formulario (deshabilitado hasta que
   *   hidrata, como la terminal) y los canales directos de abajo.
   * - Validación en `contact/form.ts` (pura): errores por campo con `aria-describedby` +
   *   `aria-invalid`, foco en el primero que falla, y una trampa (`n0_hp`) fuera de pantalla:
   *   si se completa se muestra "enviado" y no se manda nada.
   * - Si hay endpoint (`PUBLIC_CONTACT_ENDPOINT` en `.env`, o `contact.endpoint`), POST del
   *   payload JSON con timeout de 10 s; cualquier respuesta mala muestra el link de mailto de
   *   respaldo. Sin endpoint, `location.href` a un `mailto:` con el mensaje ya armado.
   * - La línea de estado (`role="status"`) vive siempre en el DOM: tag + mensaje, vacía al inicio.
   */
  import * as env from "$env/static/public";
  import { onMount, tick } from "svelte";
  import { contact, contactSection as copy } from "$lib/content/contact.js";
  import { ui } from "$lib/content/site.js";
  import { buildMailto, buildPayload, isTrapped, resolveEndpoint, validateFields } from "$lib/contact/form.ts";
  import { fill } from "$lib/terminal/commands.ts";
  import Button from "./Button.svelte";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import StatusDot from "./StatusDot.svelte";
  import Tag from "./Tag.svelte";

  /** Número de la micro-etiqueta de la sección (`01`). */
  export let index = "";

  /** `$env/static/public` tipa solo las variables conocidas; se lee como registro. */
  const envPublic = /** @type {Record<string, string | undefined>} */ (env);
  const endpoint = resolveEndpoint(envPublic.PUBLIC_CONTACT_ENDPOINT, contact.endpoint);

  const FIELDS = /** @type {const} */ (["name", "email", "message"]);
  const TIMEOUT_MS = 10_000;

  let fields = { name: "", email: "", message: "", trap: "" };
  /** @type {Partial<Record<import("$lib/contact/form.ts").FieldName, import("$lib/contact/form.ts").FieldError>>} */
  let errors = {};
  /** @type {"" | "invalid" | "sending" | "sent" | "opened" | "failed"} */
  let status = "";
  let ready = false;
  let sending = false;

  /** @type {HTMLInputElement} */
  let inputName;
  /** @type {HTMLInputElement} */
  let inputEmail;
  /** @type {HTMLTextAreaElement} */
  let inputMessage;

  /** El tag que acompaña el estado actual. */
  $: statusTag = status === "sent" || status === "opened" ? copy.statusTags.ok : status === "sending" ? copy.statusTags.busy : status ? copy.statusTags.error : "";
  $: statusText = status ? fill(copy.status[status], { email: contact.email }) : "";

  /** Texto del error de un campo, con la plantilla del contenido. */
  /** @param {import("$lib/contact/form.ts").FieldName} field */
  function errorText(field) {
    const kind = errors[field];
    if (!kind) return "";
    return fill(copy.errors[kind], { field: copy.fields[field].label, max: String(copy.limits[field]) });
  }

  /** Limpia el error de un campo al editarlo. */
  /** @param {import("$lib/contact/form.ts").FieldName} field */
  function clearError(field) {
    if (!errors[field]) return;
    const next = { ...errors };
    delete next[field];
    errors = next;
  }

  async function onSubmit() {
    if (!ready || sending) return;

    // La trampa se completó: es un bot. Se simula el éxito y no se manda nada
    if (isTrapped(fields)) {
      status = "sent";
      return;
    }

    errors = validateFields(fields, copy.limits);
    if (Object.keys(errors).length > 0) {
      status = "invalid";
      await tick();
      const first = FIELDS.find((field) => errors[field]);
      if (first === "name") inputName.focus();
      else if (first === "email") inputEmail.focus();
      else if (first === "message") inputMessage.focus();
      return;
    }

    if (!endpoint) {
      location.href = buildMailto(contact.email, fields, { subject: copy.mailSubject, body: copy.mailBody });
      status = "opened";
      return;
    }

    sending = true;
    status = "sending";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(buildPayload(fields)),
        signal: controller.signal,
      });
      if (response.ok) {
        fields = { name: "", email: "", message: "", trap: "" };
        errors = {};
        status = "sent";
      } else {
        status = "failed";
      }
    } catch {
      status = "failed";
    } finally {
      clearTimeout(timer);
      sending = false;
    }
  }

  onMount(() => {
    ready = true;
  });
</script>

<Section id={copy.id} {index} title={copy.title} lead={copy.lead} class="n0-contact-section">
  <Panel flush class="n0-contact">
    <div class="n0-term-bar">
      <StatusDot state="online" />
      <span class="n0-term-title">{copy.panelTitle}</span>
    </div>

    <form class="n0-contact-form" novalidate on:submit|preventDefault={onSubmit}>
      <div class="n0-field">
        <label for="n0-contact-name">{copy.fields.name.label}<span aria-hidden="true">{copy.promptChar}</span></label>
        <input
          id="n0-contact-name"
          name="name"
          bind:this={inputName}
          bind:value={fields.name}
          on:input={() => clearError("name")}
          type="text"
          autocomplete="name"
          required
          maxlength={copy.limits.name}
          placeholder={copy.fields.name.placeholder}
          aria-invalid={errors.name ? "true" : undefined}
          aria-describedby={errors.name ? "n0-contact-name-err" : undefined}
        />
        {#if errors.name}<p class="n0-field-err" id="n0-contact-name-err">{errorText("name")}</p>{/if}
      </div>

      <div class="n0-field">
        <label for="n0-contact-email">{copy.fields.email.label}<span aria-hidden="true">{copy.promptChar}</span></label>
        <input
          id="n0-contact-email"
          name="email"
          bind:this={inputEmail}
          bind:value={fields.email}
          on:input={() => clearError("email")}
          type="email"
          autocomplete="email"
          inputmode="email"
          autocapitalize="none"
          spellcheck="false"
          required
          maxlength={copy.limits.email}
          placeholder={copy.fields.email.placeholder}
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "n0-contact-email-err" : undefined}
        />
        {#if errors.email}<p class="n0-field-err" id="n0-contact-email-err">{errorText("email")}</p>{/if}
      </div>

      <div class="n0-field">
        <label for="n0-contact-message">{copy.fields.message.label}<span aria-hidden="true">{copy.promptChar}</span></label>
        <textarea
          id="n0-contact-message"
          name="message"
          bind:this={inputMessage}
          bind:value={fields.message}
          on:input={() => clearError("message")}
          rows="5"
          required
          maxlength={copy.limits.message}
          placeholder={copy.fields.message.placeholder}
          aria-invalid={errors.message ? "true" : undefined}
          aria-describedby={errors.message ? "n0-contact-message-err" : undefined}
        ></textarea>
        {#if errors.message}<p class="n0-field-err" id="n0-contact-message-err">{errorText("message")}</p>{/if}
      </div>

      <!-- Trampa para bots: fuera de pantalla (no display:none, que los bots detectan), sin foco -->
      <div class="n0-hp" aria-hidden="true">
        <label for="n0-contact-hp">{copy.honeypotLabel}</label>
        <input id="n0-contact-hp" name="n0_hp" bind:value={fields.trap} type="text" tabindex="-1" autocomplete="off" />
      </div>

      <div class="n0-contact-actions">
        <Button type="submit" disabled={!ready || sending}>{copy.submit}</Button>
        <p class="n0-contact-status" role="status">
          {#if status}
            <Tag tone={status === "sent" || status === "opened" ? "green" : status === "sending" ? "cyan" : "amber"}>{statusTag}</Tag>
            <span>{statusText}</span>
            {#if status === "failed"}
              <a class="n0-contact-fallback" href={buildMailto(contact.email, fields, { subject: copy.mailSubject, body: copy.mailBody })}>
                {copy.fallbackLabel}
              </a>
            {/if}
          {/if}
        </p>
      </div>
    </form>

    <div class="n0-contact-direct">
      <p class="n0-micro">{copy.directLabel}</p>
      <ul class="n0-contact-links">
        <li>
          <a class="n0-contact-link" href="mailto:{contact.email}">{contact.email}</a>
          {#if contact.emailTodo}<Tag tone="amber">{ui.placeholderTag}</Tag>{/if}
        </li>
        {#each contact.links as link}
          <li>
            <a class="n0-contact-link" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
            {#if link.todo}<Tag tone="amber">{ui.placeholderTag}</Tag>{/if}
          </li>
        {/each}
      </ul>
    </div>
  </Panel>
</Section>
