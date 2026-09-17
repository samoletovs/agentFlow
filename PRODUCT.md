# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public visitors who want to understand how NauroLabs agents work, and
maintainers who need to investigate components and declared information flows.
The public experience should invite exploration without requiring prior
knowledge of architecture diagrams.

## Product Purpose

agentFlow makes declarative agent blueprints understandable through an
interactive illustration, precise component information, and flow walkthroughs.
The blueprint describes a system's structure; it is not a live execution trace.

## Operating Context

Visitors choose an agent, find a flow, follow its declared handoffs, and inspect
the participating components. Repeated visits to a component remain distinct
step occurrences. Branches and returns must not be disguised as a single
continuous execution.

## Capabilities and Constraints

- The versioned blueprint schema and bundled JSON are the source of truth.
- Preserve agent selection, flow search, an all-flows overview, and component
  information.
- Public presentation follows the existing node and flow `private` flags.
  Allowlisted viewers use the existing SWA/Entra sign-in path.
- Blueprint JSON is shipped to the browser. Redaction and the client-side
  allowlist are presentation controls, not a security boundary.
- Blueprints must not contain secrets or real telemetry. Runtime inspection
  belongs in the existing, authorized observability tools.
- No third-party trackers, analytics SDKs, remote fonts, or remote runtime
  assets. Keep the existing self-hosted CSP.

## Brand Commitments

Keep the agentFlow name and two-colour wordmark. The user selected Dispatch Lab
as the presentation direction after reviewing interactive prototypes.
PortaBaltica is historical context, not a visual reference for this product.

## Product Principles

- Make the system interesting to explore, then make its details precise.
- Give animation an explanatory purpose and ordinary playback controls.
- Preserve actual relationships and every declared step occurrence.
- Never imply that an illustrative walkthrough is an observed agent run.
- Apply visibility rules consistently to illustrations, captions and details.

## Accessibility & Inclusion

Essential actions must work with keyboard and touch without requiring dragging.
Reduced-motion preferences retain the same information and navigation through
static states. Mobile must provide readable focused relationships and details,
not only a miniature version of the complete graph.

## Evidence on Hand

The repository contains the schema, six agent blueprints, existing flow-search
and validation tests, and the current renderer. A user-approved Dispatch Lab
prototype supplies the visual reference; the implementation must generalize it
to every supported blueprint rather than hard-code its sample agent.
