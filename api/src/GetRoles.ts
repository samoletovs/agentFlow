// SWA rolesSource endpoint. Called by Azure Static Web Apps after a successful
// sign-in. Returns the roles to attach to the user. We grant the `allowed`
// role iff the signed-in email matches the ALLOWED_EMAILS app setting
// (comma-separated, case-insensitive).
//
// Reference: https://learn.microsoft.com/azure/static-web-apps/assign-roles-microsoft-graph

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface RolesRequest {
  identityProvider?: string;
  userId?: string;
  userDetails?: string;
  claims?: { typ: string; val: string }[];
  accessToken?: string;
}

function extractEmail(body: RolesRequest): string | null {
  if (!body) return null;
  if (body.userDetails && body.userDetails.includes("@")) {
    return body.userDetails.toLowerCase();
  }
  const claim = (body.claims ?? []).find(
    (c) => c.typ === "emails" || c.typ === "preferred_username" || c.typ === "email",
  );
  const v = claim?.val ?? null;
  return v ? v.toLowerCase() : null;
}

async function getRoles(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  let body: RolesRequest = {};
  try {
    body = (await request.json()) as RolesRequest;
  } catch {
    body = {};
  }

  const email = extractEmail(body);
  const allowedRaw = process.env.ALLOWED_EMAILS ?? "";
  const allowList = allowedRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const roles: string[] = [];
  if (email && allowList.includes(email)) {
    roles.push("allowed");
  }

  // Never log the email itself — just whether it matched. Mirrors the
  // no-personal-content policy enforced on the agent harnesses.
  context.log(
    `roles_source signedIn=${Boolean(email)} matched=${roles.includes("allowed")}`,
  );

  return {
    status: 200,
    jsonBody: { roles },
  };
}

app.http("GetRoles", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: getRoles,
});
