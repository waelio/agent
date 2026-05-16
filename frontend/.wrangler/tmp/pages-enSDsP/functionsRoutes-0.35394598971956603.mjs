import { onRequestOptions as __apps___catchall___ts_onRequestOptions } from "/Users/waelio/Code/GitHub/waelio/Agent/frontend/functions/apps/[[catchall]].ts"
import { onRequestPost as __apps___catchall___ts_onRequestPost } from "/Users/waelio/Code/GitHub/waelio/Agent/frontend/functions/apps/[[catchall]].ts"
import { onRequestOptions as __run_sse_ts_onRequestOptions } from "/Users/waelio/Code/GitHub/waelio/Agent/frontend/functions/run_sse.ts"
import { onRequestPost as __run_sse_ts_onRequestPost } from "/Users/waelio/Code/GitHub/waelio/Agent/frontend/functions/run_sse.ts"

export const routes = [
    {
      routePath: "/apps/:catchall*",
      mountPath: "/apps",
      method: "OPTIONS",
      middlewares: [],
      modules: [__apps___catchall___ts_onRequestOptions],
    },
  {
      routePath: "/apps/:catchall*",
      mountPath: "/apps",
      method: "POST",
      middlewares: [],
      modules: [__apps___catchall___ts_onRequestPost],
    },
  {
      routePath: "/run_sse",
      mountPath: "/",
      method: "OPTIONS",
      middlewares: [],
      modules: [__run_sse_ts_onRequestOptions],
    },
  {
      routePath: "/run_sse",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__run_sse_ts_onRequestPost],
    },
  ]