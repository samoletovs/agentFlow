import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadViewerAuth, parseViewerAuth, PUBLIC_VIEWER } from "./auth";

const allowlist = ["viewer@example.com"];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function observe<T>(promise: Promise<T>) {
  const fulfilled = vi.fn<(value: T) => void>();
  const rejected = vi.fn<(reason: unknown) => void>();
  void promise.then(fulfilled, rejected);
  return { fulfilled, rejected };
}

function allowedResponse() {
  return new Response(JSON.stringify({
    clientPrincipal: { userDetails: allowlist[0] },
  }));
}

describe("viewer presentation access", () => {
  it("uses the public view for an anonymous principal", () => {
    expect(parseViewerAuth({ clientPrincipal: null }, allowlist)).toEqual(
      PUBLIC_VIEWER,
    );
  });

  it("matches an allowlisted email claim without case sensitivity", () => {
    expect(
      parseViewerAuth(
        {
          clientPrincipal: {
            userDetails: "display name",
            claims: [{ typ: "preferred_username", val: "VIEWER@example.com" }],
          },
        },
        allowlist,
      ),
    ).toEqual({
      status: "signed-in",
      email: "VIEWER@example.com",
      allowed: true,
    });
  });

  describe("viewer access request deadline", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("rejects an abort-ignoring request at 10 seconds without aborting the caller", async () => {
      const pending = deferred<Response>();
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const fetcher = vi.fn((_input: string, _init?: RequestInit) => pending.promise);
      const outcome = observe(loadViewerAuth(allowlist, { signal: controller.signal, fetcher }));

      await vi.advanceTimersByTimeAsync(9_999);
      expect(outcome.fulfilled).not.toHaveBeenCalled();
      expect(outcome.rejected).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(outcome.rejected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        name: "Error",
        message: expect.stringMatching(/timed out.*10 seconds.*retry/i),
      }));
      const childSignal = fetcher.mock.calls[0][1]?.signal;
      expect(childSignal).toBeInstanceOf(AbortSignal);
      expect(childSignal).not.toBe(controller.signal);
      expect(childSignal?.aborted).toBe(true);
      expect(childSignal?.reason).toBe(outcome.rejected.mock.calls[0][0]);
      expect(controller.signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));

      const lateResponse = allowedResponse();
      const readBody = vi.spyOn(lateResponse, "json");
      pending.resolve(lateResponse);
      await vi.advanceTimersByTimeAsync(0);
      expect(readBody).not.toHaveBeenCalled();
      expect(outcome.fulfilled).not.toHaveBeenCalled();
      expect(outcome.rejected).toHaveBeenCalledTimes(1);
    });

    it("includes the body read in the original deadline and permits an independent retry", async () => {
      const request = deferred<Response>();
      const body = deferred<unknown>();
      const response = new Response();
      const readBody = vi.spyOn(response, "json").mockReturnValue(body.promise);
      const outcome = observe(loadViewerAuth(allowlist, { fetcher: () => request.promise }));

      await vi.advanceTimersByTimeAsync(4_000);
      request.resolve(response);
      await vi.advanceTimersByTimeAsync(5_999);
      expect(readBody).toHaveBeenCalledOnce();
      expect(outcome.rejected).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(outcome.rejected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        name: "Error",
        message: expect.stringMatching(/timed out.*10 seconds.*retry/i),
      }));
      expect(vi.getTimerCount()).toBe(0);

      await expect(loadViewerAuth(allowlist, { fetcher: async () => allowedResponse() }))
        .resolves.toMatchObject({ status: "signed-in", allowed: true });
      body.resolve({ clientPrincipal: { userDetails: allowlist[0] } });
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome.fulfilled).not.toHaveBeenCalled();
      expect(outcome.rejected).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("cleans up the deadline and caller listener after early success", async () => {
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => allowedResponse());
      await expect(loadViewerAuth(allowlist, { signal: controller.signal, fetcher }))
        .resolves.toMatchObject({ status: "signed-in", allowed: true });
      expect(vi.getTimerCount()).toBe(0);
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));

      controller.abort();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    });

    it("honors an already-aborted caller without starting a request or timer", async () => {
      const controller = new AbortController();
      const reason = new DOMException("Caller cancelled", "AbortError");
      controller.abort(reason);
      const fetcher = vi.fn(async () => allowedResponse());
      await expect(loadViewerAuth(allowlist, { signal: controller.signal, fetcher }))
        .rejects.toBe(reason);
      expect(fetcher).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["request", "body"] as const)(
      "preserves caller cancellation during an abort-ignoring %s",
      async (phase) => {
        const controller = new AbortController();
        const reason = new Error("Caller stopped this check");
        const removeListener = vi.spyOn(controller.signal, "removeEventListener");
        const request = deferred<Response>();
        const body = deferred<unknown>();
        const response = new Response();
        vi.spyOn(response, "json").mockReturnValue(body.promise);
        const fetcher = vi.fn((_input: string, _init?: RequestInit) =>
          phase === "request" ? request.promise : Promise.resolve(response),
        );
        const outcome = observe(loadViewerAuth(allowlist, { signal: controller.signal, fetcher }));
        await vi.advanceTimersByTimeAsync(0);
        controller.abort(reason);
        await vi.advanceTimersByTimeAsync(0);
        expect(outcome.rejected).toHaveBeenCalledExactlyOnceWith(reason);
        expect(fetcher.mock.calls[0][1]?.signal?.reason).toBe(reason);
        expect(vi.getTimerCount()).toBe(0);
        expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));

        request.resolve(allowedResponse());
        body.resolve({ clientPrincipal: { userDetails: allowlist[0] } });
        await vi.advanceTimersByTimeAsync(10_000);
        expect(outcome.fulfilled).not.toHaveBeenCalled();
        expect(outcome.rejected).toHaveBeenCalledTimes(1);
      },
    );

    it.each(["request", "body"] as const)(
      "handles a late %s rejection after timeout without another outcome or unhandled rejection",
      async (phase) => {
        const request = deferred<Response>();
        const body = deferred<unknown>();
        const response = new Response();
        vi.spyOn(response, "json").mockReturnValue(body.promise);
        const outcome = observe(loadViewerAuth(allowlist, {
          fetcher: () => phase === "request" ? request.promise : Promise.resolve(response),
        }));
        await vi.advanceTimersByTimeAsync(10_000);
        expect(outcome.rejected).toHaveBeenCalledOnce();
        if (phase === "request") request.reject(new Error("Late request failure"));
        else body.reject(new Error("Late body failure"));
        await vi.advanceTimersByTimeAsync(0);
        expect(outcome.rejected).toHaveBeenCalledTimes(1);
        expect(outcome.fulfilled).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it.each(["request", "body"] as const)(
      "preserves the original %s failure and removes cancellation resources",
      async (phase) => {
        const controller = new AbortController();
        const removeListener = vi.spyOn(controller.signal, "removeEventListener");
        const cause = new Error("Original failure");
        const response = new Response();
        vi.spyOn(response, "json").mockRejectedValue(cause);
        const request = loadViewerAuth(allowlist, {
          signal: controller.signal,
          fetcher: async () => {
            if (phase === "request") throw cause;
            return response;
          },
        });
        if (phase === "request") await expect(request).rejects.toBe(cause);
        else await expect(request).rejects.toMatchObject({
          message: "The sign-in service returned unreadable data.",
          cause,
        });
        expect(vi.getTimerCount()).toBe(0);
        expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      },
    );

    it.each([
      { name: "HTTP error", response: () => new Response(null, { status: 503 }), message: "HTTP 503" },
      { name: "invalid identity", response: () => new Response("{}"), message: "invalid response" },
    ])("cleans up after $name", async ({ response, message }) => {
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      await expect(loadViewerAuth(allowlist, { signal: controller.signal, fetcher: async () => response() }))
        .rejects.toThrow(message);
      expect(vi.getTimerCount()).toBe(0);
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });

  it("keeps non-allowlisted viewers restricted even with an admin role", () => {
    expect(
      parseViewerAuth(
        {
          clientPrincipal: {
            userDetails: "another@example.com",
            userRoles: ["authenticated", "admin"],
          },
        },
        allowlist,
      ).allowed,
    ).toBe(false);
  });

  it("supports a signed-in principal without an email, without granting access", () => {
    expect(
      parseViewerAuth({ clientPrincipal: { userId: "synthetic-user" } }, allowlist),
    ).toEqual({ status: "signed-in", email: null, allowed: false });
  });

  it.each([null, {}, { clientPrincipal: [] }, { clientPrincipal: {} }])(
    "rejects malformed identity data rather than reporting success",
    (payload) => {
      expect(() => parseViewerAuth(payload, allowlist)).toThrow();
    },
  );

  it("does not use non-string claims as an identity", () => {
    expect(
      parseViewerAuth(
        {
          clientPrincipal: {
            userId: "synthetic-user",
            claims: [{ typ: "email", val: ["viewer@example.com"] }],
          },
        },
        allowlist,
      ).allowed,
    ).toBe(false);
  });

  it("reports HTTP and unreadable-response failures", async () => {
    await expect(
      loadViewerAuth(allowlist, {
        fetcher: async () => new Response("unavailable", { status: 503 }),
      }),
    ).rejects.toThrow("HTTP 503");
    await expect(
      loadViewerAuth(allowlist, {
        fetcher: async () => new Response("<html>not an auth response</html>"),
      }),
    ).rejects.toThrow("unreadable data");
  });

  it("requests only the same-origin SWA principal endpoint", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ clientPrincipal: null })),
    );
    await expect(loadViewerAuth(allowlist, { fetcher })).resolves.toEqual(
      PUBLIC_VIEWER,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/.auth/me",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("preserves cancellation for the caller to distinguish from an error", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadViewerAuth(allowlist, {
        signal: controller.signal,
        fetcher: async () => {
          throw new DOMException("Aborted", "AbortError");
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
