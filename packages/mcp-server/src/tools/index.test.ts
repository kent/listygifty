import assert from "node:assert/strict";
import test from "node:test";
import { allTools, toolGroups, toolHandlerRegistry } from "./index.js";

test("every advertised tool has exactly its owning module handler", () => {
  const advertisedNames = allTools.map((tool) => tool.name);
  assert.equal(new Set(advertisedNames).size, advertisedNames.length);
  assert.equal(toolHandlerRegistry.size, advertisedNames.length);

  for (const [tools, handler] of toolGroups) {
    for (const tool of tools) {
      assert.equal(toolHandlerRegistry.get(tool.name), handler, tool.name);
    }
  }
});
