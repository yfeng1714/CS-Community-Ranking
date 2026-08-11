export interface ReadinessDependencies {
  checkDatabase(): Promise<void>;
  onFailure?(error: unknown): void;
}

export function createReadinessHandler(dependencies: ReadinessDependencies) {
  return async function readinessHandler(): Promise<Response> {
    try {
      await dependencies.checkDatabase();

      return Response.json(
        { status: "ready" },
        {
          status: 200,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    } catch (error) {
      dependencies.onFailure?.(error);

      return Response.json(
        { status: "not_ready" },
        {
          status: 503,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }
  };
}
