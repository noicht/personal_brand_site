import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMailto, buildPayload, isTrapped, resolveEndpoint, validateFields } from "./form.ts";

const limits = { name: 10, email: 254, message: 20 };
const valid = { name: "Ada", email: "ada@example.com", message: "hola", trap: "" };

describe("validateFields", () => {
  it("un campo vacío o solo espacios es requerido", () => {
    assert.equal(validateFields({ ...valid, name: "" }, limits).name, "required");
    assert.equal(validateFields({ ...valid, email: "   " }, limits).email, "required");
    assert.equal(validateFields({ ...valid, message: "\n\t " }, limits).message, "required");
  });

  it("un mail mal formado es inválido", () => {
    for (const email of ["nope", "a@b", "a b@c.com", "@x.com"]) {
      assert.equal(validateFields({ ...valid, email }, limits).email, "invalid", email);
    }
    assert.equal(validateFields(valid, limits).email, undefined);
  });

  it("pasarse del límite es tooLong, con el recorte aplicado", () => {
    assert.equal(validateFields({ ...valid, name: "x".repeat(11) }, limits).name, "tooLong");
    assert.equal(validateFields({ ...valid, name: "x".repeat(10) }, limits).name, undefined);
    // los espacios de las puntas no cuentan
    assert.equal(validateFields({ ...valid, name: `  ${"x".repeat(10)}  ` }, limits).name, undefined);
  });

  it("todo bien da un objeto vacío", () => {
    assert.deepEqual(validateFields(valid, limits), {});
  });
});

describe("isTrapped", () => {
  it("solo se dispara si la trampa tiene contenido", () => {
    assert.equal(isTrapped(valid), false);
    assert.equal(isTrapped({ ...valid, trap: " " }), false);
    assert.equal(isTrapped({ ...valid, trap: "spam" }), true);
  });
});

describe("buildPayload", () => {
  it("recorta los campos y nunca manda la trampa", () => {
    const payload = buildPayload({ name: " Ada ", email: " ada@x.com ", message: " hola ", trap: "bot" });
    assert.deepEqual(payload, { name: "Ada", email: "ada@x.com", message: "hola" });
    assert.equal("trap" in payload, false);
  });
});

describe("buildMailto", () => {
  const mailto = buildMailto(
    "hello@example.com",
    { name: "Ada Lovelace", email: "ada@example.com", message: "hi & bye?\nline 2 #x", trap: "" },
    { subject: "[n0icht] Message from {name}", body: "{message}\n\n-- \n{name}\n{email}" },
  );

  it("arma la URL con subject y body codificados", () => {
    assert.ok(mailto.startsWith("mailto:hello@example.com?subject="));
    assert.ok(mailto.includes("%5Bn0icht%5D%20Message%20from%20Ada%20Lovelace"));
  });

  it("los saltos de línea van como CRLF y los caracteres especiales escapados", () => {
    assert.ok(mailto.includes("%0D%0A"));
    assert.ok(mailto.includes("%26"));
    assert.ok(mailto.includes("%3F"));
    assert.ok(mailto.includes("%23"));
    assert.ok(!mailto.includes("&bye"), "el & del mensaje queda codificado, no como separador");
  });
});

describe("resolveEndpoint", () => {
  it("el valor de entorno gana sobre el del contenido", () => {
    assert.equal(resolveEndpoint("https://a.example.com/x", "https://b.example.com/y"), "https://a.example.com/x");
    assert.equal(resolveEndpoint("  ", "https://b.example.com/y"), "https://b.example.com/y");
    assert.equal(resolveEndpoint(undefined, "https://b.example.com/y"), "https://b.example.com/y");
  });

  it("acepta https y localhost en http; rechaza el resto", () => {
    assert.equal(resolveEndpoint(undefined, "http://localhost:3000/contact"), "http://localhost:3000/contact");
    assert.equal(resolveEndpoint(undefined, "http://127.0.0.1:3000/contact"), "http://127.0.0.1:3000/contact");
    assert.equal(resolveEndpoint(undefined, "http://example.com/x"), "");
    assert.equal(resolveEndpoint(undefined, "javascript:alert(1)"), "");
    assert.equal(resolveEndpoint("javascript:alert(1)", "https://b.example.com/y"), "");
    assert.equal(resolveEndpoint(undefined, "not a url"), "");
    assert.equal(resolveEndpoint(undefined, ""), "");
  });
});
