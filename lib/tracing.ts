import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";

const tracer = trace.getTracer("ifr");

/**
 * Wraps one unit of work in a span. The tracer is a no-op until the provider is
 * registered in instrumentation.ts, so calling this is always safe.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    for (const [k, v] of Object.entries(attributes)) span.setAttribute(k, v);
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
