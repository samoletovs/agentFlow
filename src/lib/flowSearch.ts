import type { BlueprintFlow } from "./blueprint";

export function filterFlows(
  flows: BlueprintFlow[],
  tags: string[] | undefined,
  query: string,
): BlueprintFlow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return flows;

  return flows.filter((flow) =>
    [flow.label, flow.id, flow.trigger, ...(tags ?? [])].some((value) =>
      value?.toLowerCase().includes(normalizedQuery),
    ),
  );
}
