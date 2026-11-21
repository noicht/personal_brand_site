import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { terminalContent as content } from "../content/index.js";
import { commandNames, distance, execute, fill, suggest } from "./commands.ts";

const texts = (input: string) => execute(input, content).lines.map((line) => line.text);
const kinds = (input: string) => execute(input, content).lines.map((line) => line.kind);

describe("execute", () => {
  it("no hace nada con una línea vacía", () => {
    assert.deepEqual(execute("   ", content), { lines: [], effects: [] });
  });

  it("help lista todos los comandos del contenido, y todos existen", () => {
    const { lines } = execute("help", content);
    const usages = lines.filter((line) => line.tag).map((line) => line.tag?.trim());
    assert.deepEqual(
      usages,
      content.terminal.commands.map((command) => command.usage),
    );
    for (const command of content.terminal.commands) assert.ok(commandNames.includes(command.name), command.name);
    assert.deepEqual([...commandNames].sort(), content.terminal.commands.map((command) => command.name).sort());
  });

  it("cada comando que lista help corre sin error", () => {
    for (const command of content.terminal.commands) {
      const result = execute(command.usage, content);
      assert.ok(!result.lines.some((line) => line.kind === "error"), command.usage);
    }
  });

  it("help alinea las descripciones en una columna", () => {
    const widths = execute("help", content)
      .lines.filter((line) => line.tag)
      .map((line) => line.tag?.length);
    assert.equal(new Set(widths).size, 1);
  });

  it("whoami muestra la identidad completa y el rol", () => {
    const lines = texts("whoami");
    assert.equal(lines[0], "Martín Cabrera · n0icht");
    assert.equal(lines[1], content.site.role);
  });

  it("ls sin argumentos lista la raíz", () => {
    assert.deepEqual(texts("ls"), [content.terminal.lsRoot.join("  ")]);
  });

  it("ls projects lista los proyectos, con o sin barra y en cualquier caja", () => {
    for (const input of ["ls projects", "ls projects/", "ls ./Projects/", "LS PROJECTS"]) {
      const { lines } = execute(input, content);
      assert.deepEqual(
        lines.slice(1).map((line) => line.tag),
        content.projects.map((project) => project.name),
        input,
      );
    }
  });

  it("ls de algo que no existe da el error de archivo", () => {
    assert.deepEqual(kinds("ls nope"), ["error"]);
    assert.deepEqual(texts("ls nope"), ["ls: nope: No such file or directory"]);
  });

  it("cat stack imprime un grupo por línea", () => {
    const { lines } = execute("cat stack", content);
    assert.equal(lines.length, content.stack.length);
    assert.equal(lines[0].text, content.stack[0].items.map((item) => item.name).join(" · "));
    assert.equal(lines[0].tag?.trim(), content.stack[0].label);
  });

  it("cat sin argumento explica el uso, y con otro archivo da error", () => {
    assert.deepEqual(texts("cat"), [content.terminal.messages.catUsage]);
    assert.deepEqual(texts("cat secrets.env"), ["cat: secrets.env: No such file or directory"]);
    assert.deepEqual(kinds("cat secrets.env"), ["error"]);
  });

  it("contact da el mail y los links, todos navegables", () => {
    const { lines } = execute("contact", content);
    const rows = lines.filter((line) => line.href);
    assert.equal(rows.length, 1 + content.contact.links.length);
    assert.equal(rows[0].href, `mailto:${content.contact.email}`);
    assert.equal(rows[0].text, content.contact.email);
    for (const row of rows.slice(1)) assert.match(row.href ?? "", /^https:\/\//);
  });

  it("deploy --prod corre el pipeline y pide un pulso", () => {
    const result = execute("deploy --prod", content);
    assert.deepEqual(result.effects, [{ type: "pulse" }]);
    assert.equal(result.lines.at(-1)?.text, content.terminal.deployDone);
    assert.equal(result.lines.length, content.terminal.deploy.length + 1);
  });

  it("deploy sin --prod no despliega nada", () => {
    assert.deepEqual(texts("deploy"), [content.terminal.messages.deployUsage]);
    assert.deepEqual(execute("deploy", content).effects, []);
    assert.deepEqual(texts("deploy --staging"), ["deploy: unknown target '--staging'. Only --prod is wired here."]);
    assert.deepEqual(execute("deploy prod", content).effects, []);
  });

  it("clear pide limpiar y no imprime nada", () => {
    assert.deepEqual(execute("clear", content), { lines: [], effects: [{ type: "clear" }] });
  });

  it("un comando desconocido avisa y dice cómo seguir", () => {
    const { lines, effects } = execute("frobnicate now", content);
    assert.deepEqual(effects, []);
    assert.equal(lines[0].kind, "error");
    assert.equal(lines[0].text, "command not found: frobnicate");
    assert.equal(lines[1].text, content.terminal.messages.notFoundHint);
  });

  it("si se parece a un comando, lo sugiere", () => {
    assert.equal(texts("hlep")[1], "Did you mean 'help'?");
    assert.equal(texts("whoam")[1], "Did you mean 'whoami'?");
    assert.equal(texts("deplyo --prod")[1], "Did you mean 'deploy'?");
  });

  it("los nombres heredados de Object no son comandos", () => {
    for (const input of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      assert.equal(execute(input, content).lines[0].kind, "error", input);
    }
  });

  it("devuelve lo escrito como texto, sin interpretarlo", () => {
    const { lines } = execute("<img src=x onerror=alert(1)>", content);
    assert.equal(lines[0].text, "command not found: <img");
    assert.equal(lines[0].href, undefined);
  });
});

describe("ayudas", () => {
  it("fill reemplaza las claves y deja las que no conoce", () => {
    assert.equal(fill("{cmd}: {arg} / {other}", { cmd: "ls", arg: "x" }), "ls: x / {other}");
  });

  it("distance cuenta ediciones", () => {
    assert.equal(distance("help", "help"), 0);
    assert.equal(distance("hlep", "help"), 2);
    assert.equal(distance("", "abc"), 3);
    assert.equal(distance("kitten", "sitting"), 3);
  });

  it("suggest no propone nada si está lejos o si la palabra es muy corta", () => {
    assert.equal(suggest("frobnicate", commandNames), null);
    assert.equal(suggest("x", commandNames), null);
    assert.equal(suggest("la", commandNames), "ls");
  });
});
