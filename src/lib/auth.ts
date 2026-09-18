export interface ViewerAuth {
  status: "loading" | "anonymous" | "signed-in" | "error";
  email: string | null;
  allowed: boolean;
  error?: string;
}

export const PUBLIC_VIEWER: ViewerAuth = {
  status: "anonymous",
  email: null,
  allowed: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseViewerAuth(
  payload: unknown,
  allowlist: readonly string[],
): ViewerAuth {
  if (!isRecord(payload) || !("clientPrincipal" in payload)) {
    throw new Error("The sign-in service returned an invalid response.");
  }
  const principal = payload.clientPrincipal;
  if (principal === null) return { ...PUBLIC_VIEWER };
  if (!isRecord(principal)) {
    throw new Error("The sign-in service returned an invalid principal.");
  }
  if (principal.claims !== undefined && !Array.isArray(principal.claims)) {
    throw new Error("The sign-in service returned invalid claims.");
  }
  const claims: unknown[] = Array.isArray(principal.claims) ? principal.claims : [];
  const emailClaim = claims.find(
    (claim) =>
      isRecord(claim) &&
      typeof claim.typ === "string" &&
      ["emails", "preferred_username", "email"].includes(claim.typ) &&
      typeof claim.val === "string" &&
      claim.val.length > 0,
  );
  const claimValue =
    isRecord(emailClaim) && typeof emailClaim.val === "string"
      ? emailClaim.val
      : null;
  const email =
    claimValue ??
    (typeof principal.userDetails === "string" && principal.userDetails.length > 0
      ? principal.userDetails
      : null);
  if (
    email === null &&
    !(typeof principal.userId === "string" && principal.userId.length > 0)
  ) {
    throw new Error("The sign-in service returned no principal identity.");
  }
  return {
    status: "signed-in",
    email,
    allowed:
      email !== null &&
      allowlist.some((entry) => entry.toLowerCase() === email.toLowerCase()),
  };
}

interface AuthOptions {
  signal?: AbortSignal;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
}

const AUTH_TIMEOUT_MS = 10_000;

export async function loadViewerAuth(
  allowlist: readonly string[],
  { signal, fetcher = fetch }: AuthOptions = {},
): Promise<ViewerAuth> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortFromCaller: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    const interrupt = (reason: unknown) => {
      reject(reason);
      controller.abort(reason);
    };
    abortFromCaller = () => interrupt(signal?.reason);
    signal?.addEventListener("abort", abortFromCaller, { once: true });
    timer = setTimeout(() => interrupt(new Error(
      `Sign-in status check timed out after ${AUTH_TIMEOUT_MS / 1000} seconds. Please retry.`,
    )), AUTH_TIMEOUT_MS);
  });

  async function readAuth(): Promise<ViewerAuth> {
    const response = await fetcher("/.auth/me", {
      signal: controller.signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    controller.signal.throwIfAborted();
    if (!response.ok) {
      throw new Error(`Sign-in status is unavailable (HTTP ${response.status}).`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error("The sign-in service returned unreadable data.", { cause: error });
    }
    controller.signal.throwIfAborted();
    return parseViewerAuth(payload, allowlist);
  }

  try {
    return await Promise.race([readAuth(), interrupted]);
  } finally {
    clearTimeout(timer);
    if (abortFromCaller) signal?.removeEventListener("abort", abortFromCaller);
  }
}
