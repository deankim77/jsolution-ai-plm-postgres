import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const installed = Symbol.for("jsolution.srvx-body-compat");

// srvx lazily constructs its native Request when vinext reads redirect/signal.
// A preceding Connect middleware may already have drained the IncomingMessage.
// Recover only a retained raw body or a provably bodyless HTTP/1 request.
export function installNodeRequestCompatibility({ NodeRequest, patchGlobalRequest }) {
  const prototype = NodeRequest.prototype;
  if (prototype[installed]) return;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "body");
  if (!descriptor?.get || !descriptor.configurable) {
    throw new Error("Unsupported srvx NodeRequest body accessor");
  }
  const recovered = new WeakMap();
  Object.defineProperty(prototype, "body", {
    ...descriptor,
    get() {
      const body = descriptor.get.call(this);
      if (!body) return body;
      const incoming = this.runtime?.node?.req;
      if (!incoming || (!body.locked && !Readable.isDisturbed(body))) {
        return body;
      }
      if (recovered.has(this)) return recovered.get(this);
      // An active reader must retain ownership; never replay while it is reading.
      if (!body.locked && incoming.rawBody instanceof Uint8Array) {
        const replacement = new Response(incoming.rawBody).body;
        recovered.set(this, replacement);
        return replacement;
      }
      const length = incoming.headers["content-length"];
      const bodyless = incoming.httpVersionMajor === 1
        && incoming.headers["transfer-encoding"] === undefined
        && (length === undefined || length === "0");
      if (!body.locked && bodyless) return null;
      const error = new Error("Request body was consumed before application handling");
      error.code = "PLM_REQUEST_BODY_CONSUMED";
      throw error;
    },
  });
  // Official srvx adapter: unwrap its lazy Request before Undici clones it.
  patchGlobalRequest();
  Object.defineProperty(prototype, installed, { value: true });
}

export function requestBodyErrorHandler(error, request, response, next) {
  const bodyError = error?.code === "PLM_REQUEST_BODY_CONSUMED"
    || error?.message === "Response body object should not be disturbed or locked";
  if (!bodyError || response.headersSent) return next(error);
  const pathname = (request.url || "/").split(/[?#]/, 1)[0].replace(/[\r\n\t]/g, "").slice(0, 300);
  console.warn(`[plm:request] ${request.method} ${pathname} -> 400 (request body unavailable)`);
  response.statusCode = 400;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({
    error: "요청 본문을 읽을 수 없습니다. 요청을 다시 시도해 주세요.",
    code: "REQUEST_BODY_UNAVAILABLE",
  }));
}

/** @returns {import("vite").Plugin} */
export function nodeRequestCompatibilityPlugin() {
  return {
    name: "plm:node-request-compat",
    apply: "serve",
    enforce: "post",
    async configureServer(server) {
      // Resolve the adapter used by plugin-rsc, including nested npm installs.
      const require = createRequire(import.meta.url);
      const rscRequire = createRequire(require.resolve("@vitejs/plugin-rsc"));
      const adapter = await import(pathToFileURL(rscRequire.resolve("srvx/node")).href);
      installNodeRequestCompatibility(adapter);
      // Runs after the RSC handler, before Vite's error/overlay middleware.
      return () => server.middlewares.use(requestBodyErrorHandler);
    },
  };
}
