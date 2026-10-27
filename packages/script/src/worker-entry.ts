import { ScriptWorkerCore } from "./worker-core";
import type { ScriptWorkerRequest } from "./worker-protocol";

const core = new ScriptWorkerCore();

self.addEventListener("message", (event: MessageEvent<ScriptWorkerRequest>) => {
  void core.handle(event.data).then((response) => {
    self.postMessage(response);
  });
});
