// Legacy compatibility entry point.
//
// The old worker scanned the entire drawing library on a timer. That polling
// model was retired because it created unnecessary load as the library grew.
// The supported CAD Worker flow is upload-triggered and implemented by
// server.mjs. Keeping this file as a compatibility shim ensures that even a
// manual `node tools/autodwg-converter/worker.mjs` starts the correct mode.

console.log("[cad-worker] legacy polling worker retired; starting upload-triggered converter server");
await import("./server.mjs");
