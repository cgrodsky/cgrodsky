import { BinaryModuleImpl } from "./BinaryModule-DMhzYB6c.js";
// ../../harper-wasm/pkg/harper_wasm_slim_bg.wasm?no-inline
var harper_wasm_slim_bg_default = new URL("harper_wasm_slim_bg.wasm", import.meta.url).href;
// src/binaries/slimBinary.ts
/** A version of the slimmed-down Harper WebAssembly binary stored as its own module. */
var slimBinary = /*@__PURE__*/ BinaryModuleImpl.create(harper_wasm_slim_bg_default, "slim");
export { slimBinary };
