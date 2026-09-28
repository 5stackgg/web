export type BackblazeWorkerHealth =
  | { answering: false }
  | { answering: true; current: false }
  | {
      answering: true;
      current: true;
      bucket: "ok" | "rejected" | "misconfigured" | "unreachable";
      code: string | null;
    };

// /demo/_health is answered by the worker in 5stack-panel's
// cloudflare-workers/backblaze-proxy, which signs a read against the bucket to
// report whether Backblaze accepts its keys. A worker deployed before that
// existed still answers a CORS preflight, which is how it is told apart from
// one that is not there at all.
export async function checkBackblazeWorker(
  workerUrl: string,
): Promise<BackblazeWorkerHealth> {
  const healthUrl = `${workerUrl.replace(/\/+$/, "")}/demo/_health`;

  try {
    const response = await fetch(healthUrl, { cache: "no-store" });
    const health = await response.json().catch(() => null);
    if (health?.worker !== "5stack-backblaze-proxy") {
      return { answering: true, current: false };
    }
    return {
      answering: true,
      current: true,
      bucket: health.bucket,
      code: health.code ?? null,
    };
  } catch {
    try {
      const preflight = await fetch(healthUrl, {
        method: "OPTIONS",
        cache: "no-store",
      });
      return preflight.ok
        ? { answering: true, current: false }
        : { answering: false };
    } catch {
      return { answering: false };
    }
  }
}
