import { describe, expect, it, vi } from "vitest";
import { loadViewerAuth, parseViewerAuth, PUBLIC_VIEWER } from "./auth";

const allowlist = ["viewer@example.com"];

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
