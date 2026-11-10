import type { Instrumentation } from "next";
import { registerOTel } from "@vercel/otel";

/** Tracing: one span tree per request and per worker command. */
export function register() {
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "indian-food-recommends" });
}

// One JSON line per failed request: Vercel log search can filter on `"level":"error"` and the route.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      message: e.message,
      digest: e.digest,
      method: request.method,
      path: request.path,
      route: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    }),
  );
};
