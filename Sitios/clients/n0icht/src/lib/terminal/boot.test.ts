import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { terminal } from "../content/terminal.js";
import { bootSequence, lineLength } from "./boot.ts";

describe("bootSequence", () => {
  it("cuenta el tag, el espacio y el texto", () => {
    assert.equal(lineLength({ text: "abc" }), 3);
    assert.equal(lineLength({ tag: "[ ok ]", text: "abc" }), 10);
  });

  it("tipea una línea después de la otra, sin superponerlas", () => {
    const { lines, total } = bootSequence(terminal.boot);
    assert.equal(lines.length, terminal.boot.length);
    let end = 0;
    for (const line of lines) {
      assert.equal(line.kind, "boot");
      assert.ok(line.typing);
      assert.ok(line.typing.delay >= end);
      assert.ok(line.typing.duration > 0);
      end = line.typing.delay + line.typing.duration;
    }
    assert.equal(total, end);
  });

  it("respeta la velocidad y las pausas", () => {
    const source = [{ text: "ab" }, { tag: "[x]", text: "cd" }];
    const { lines, total } = bootSequence(source, { cps: 10, gap: 50, start: 100 });
    assert.deepEqual(lines[0].typing, { chars: 2, delay: 100, duration: 200 });
    assert.deepEqual(lines[1].typing, { chars: 6, delay: 350, duration: 600 });
    assert.equal(lines[1].tag, "[x]");
    assert.equal("tag" in lines[0], false);
    assert.equal(total, 950);
  });

  it("el arranque del sitio dura menos de cinco segundos", () => {
    assert.ok(bootSequence(terminal.boot).total < 5000);
  });

  it("sin líneas no dura nada", () => {
    assert.deepEqual(bootSequence([]), { lines: [], total: 0 });
  });
});
