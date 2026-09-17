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

export async function loadViewerAuth(
  allowlist: readonly string[],
  { signal, fetcher = fetch }: AuthOptions = {},
): Promise<ViewerAuth> {
  const response = await fetcher("/.auth/me", {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Sign-in status is unavailable (HTTP ${response.status}).`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The sign-in service returned unreadable data.", { cause: error });
  }
  return parseViewerAuth(payload, allowlist);
}
