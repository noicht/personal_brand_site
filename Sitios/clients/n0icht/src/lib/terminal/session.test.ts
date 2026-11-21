import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { terminalContent as content } from "../content/index.js";
import { MAX_HISTORY, MAX_LINES, createSession, historyNext, historyPrev, submit } from "./session.ts";
import type { Session } from "./session.ts";

const run = (session: Session, ...inputs: string[]) =>
  inputs.reduce((current, input) => submit(current, input, content).session, session);

describe("submit", () => {
  it("suma la línea escrita y su salida", () => {
    const { session } = submit(createSession(), "whoami", content);
    assert.deepEqual(session.lines[0], { kind: "input", text: "whoami" });
    assert.equal(session.lines[1].text, content.site.identity);
  });

  it("no modifica la sesión que recibe", () => {
    const before = createSession([{ kind: "boot", text: "boot" }]);
    const snapshot = structuredClone(before);
    submit(before, "help", content);
    assert.deepEqual(before, snapshot);
  });

  it("una línea vacía repite el prompt y no entra al historial", () => {
    const { session, effects } = submit(createSession(), "   ", content);
    assert.deepEqual(session.lines, [{ kind: "input", text: "" }]);
    assert.deepEqual(session.history, []);
    assert.deepEqual(effects, []);
  });

  it("clear vacía la pantalla, conserva el historial y no devuelve el efecto", () => {
    const { session, effects } = submit(run(createSession([{ kind: "boot", text: "boot" }]), "help"), "clear", content);
    assert.deepEqual(session.lines, []);
    assert.deepEqual(session.history, ["help", "clear"]);
    assert.deepEqual(effects, []);
  });

  it("devuelve los demás efectos", () => {
    assert.deepEqual(submit(createSession(), "deploy --prod", content).effects, [{ type: "pulse" }]);
  });

  it("no guarda dos veces seguidas el mismo comando", () => {
    assert.deepEqual(run(createSession(), "help", "help", "whoami", "help").history, ["help", "whoami", "help"]);
  });

  it("limita las líneas en pantalla y el historial", () => {
    const inputs = Array.from({ length: MAX_HISTORY + 20 }, (_, index) => `cmd${index}`);
    const session = run(createSession(), ...inputs);
    assert.equal(session.history.length, MAX_HISTORY);
    assert.equal(session.history.at(-1), `cmd${MAX_HISTORY + 19}`);
    assert.ok(session.lines.length <= MAX_LINES);
    assert.equal(run(session, ...inputs, ...inputs).lines.length, MAX_LINES);
  });
});

describe("historial", () => {
  const session = run(createSession(), "help", "whoami", "ls projects");

  it("flecha arriba recorre hacia atrás y se queda en el más viejo", () => {
    let step = historyPrev(session, "");
    assert.equal(step.value, "ls projects");
    step = historyPrev(step.session, step.value);
    assert.equal(step.value, "whoami");
    step = historyPrev(step.session, step.value);
    assert.equal(step.value, "help");
    step = historyPrev(step.session, step.value);
    assert.equal(step.value, "help");
  });

  it("flecha abajo vuelve hacia adelante y al final recupera lo que se estaba escribiendo", () => {
    let step = historyPrev(session, "cat st");
    step = historyPrev(step.session, step.value);
    assert.equal(step.value, "whoami");
    step = historyNext(step.session, step.value);
    assert.equal(step.value, "ls projects");
    step = historyNext(step.session, step.value);
    assert.equal(step.value, "cat st");
    step = historyNext(step.session, step.value);
    assert.equal(step.value, "cat st");
  });

  it("sin historial las flechas no cambian nada", () => {
    const empty = createSession();
    assert.deepEqual(historyPrev(empty, "abc"), { session: empty, value: "abc" });
    assert.deepEqual(historyNext(empty, "abc"), { session: empty, value: "abc" });
  });

  it("después de correr un comando, flecha arriba trae ese comando", () => {
    const step = historyPrev(session, "");
    const after = submit(historyPrev(step.session, step.value).session, "contact", content).session;
    assert.equal(historyPrev(after, "").value, "contact");
  });
});
