import type { Instrumentation } from "next";

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
