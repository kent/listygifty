// Entry point for the Pulumi program. All resource construction happens in
// src/stack.ts so this file stays a thin shim.
import { buildStack } from "./src/stack";

export = buildStack();
