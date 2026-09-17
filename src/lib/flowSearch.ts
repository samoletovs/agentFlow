import type { BlueprintFlow } from "./blueprint";

export function filterFlows<T extends Pick<BlueprintFlow, "id" | "label" | "trigger">>(
  flows: readonly T[],
  tags: readonly string[] | undefined,
  query: string,
): readonly T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return flows;

  return flows.filter((flow) =>
    [flow.label, flow.id, flow.trigger, ...(tags ?? [])].some((value) =>
      value?.toLowerCase().includes(normalizedQuery),
    ),
  );
}

export function queryForSelectedFlow(
  flow: Pick<BlueprintFlow, "id" | "label" | "trigger">,
  tags: readonly string[] | undefined,
  query: string,
): string {
  return filterFlows([flow], tags, query).length ? query : "";
}
