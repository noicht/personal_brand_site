import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_INPUT, parse, tokenize } from "./parser.ts";

describe("tokenize", () => {
  it("separa por espacios y colapsa los repetidos", () => {
    assert.deepEqual(
      tokenize("  ls \t  projects  ").map((token) => token.value),
      ["ls", "projects"],
    );
  });

  it("agrupa con comillas simples y dobles", () => {
    assert.deepEqual(
      tokenize(`cat "my file" 'other one'`).map((token) => token.value),
      ["cat", "my file", "other one"],
    );
  });

  it("une comillas pegadas a texto en una sola palabra", () => {
    assert.deepEqual(
      tokenize(`a"b c"d`).map((token) => token.value),
      ["ab cd"],
    );
  });

  it("conserva una palabra vacía entre comillas", () => {
    assert.deepEqual(tokenize(`cat ""`), [
      { value: "cat", quoted: false },
      { value: "", quoted: true },
    ]);
  });

  it("una comilla sin cerrar llega hasta el final", () => {
    assert.deepEqual(
      tokenize(`cat "stack and more`).map((token) => token.value),
      ["cat", "stack and more"],
    );
  });

  it("descarta lo que pasa del largo máximo", () => {
    const tokens = tokenize("x".repeat(MAX_INPUT + 50));
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value.length, MAX_INPUT);
  });
});

describe("parse", () => {
  it("devuelve null con una línea vacía o de espacios", () => {
    assert.equal(parse(""), null);
    assert.equal(parse("   \t "), null);
  });

  it("separa nombre, argumentos y flags", () => {
    assert.deepEqual(parse("deploy --prod now"), {
      raw: "deploy --prod now",
      name: "deploy",
      args: ["now"],
      flags: ["prod"],
      rest: ["--prod", "now"],
    });
  });

  it("pasa el nombre y los flags a minúsculas, y deja los argumentos como vienen", () => {
    const command = parse("LS Projects --ALL");
    assert.equal(command?.name, "ls");
    assert.deepEqual(command?.args, ["Projects"]);
    assert.deepEqual(command?.flags, ["all"]);
  });

  it("acepta flags con un guion o con dos", () => {
    assert.deepEqual(parse("deploy -p --dry-run")?.flags, ["p", "dry-run"]);
  });

  it("no toma como flag una palabra entre comillas, un guion suelto ni un número negativo", () => {
    const command = parse(`cat "--prod" - -- -1`);
    assert.deepEqual(command?.flags, []);
    assert.deepEqual(command?.args, ["--prod", "-", "--", "-1"]);
  });

  it("guarda la línea original sin espacios en las puntas", () => {
    assert.equal(parse("   whoami   ")?.raw, "whoami");
  });
});
