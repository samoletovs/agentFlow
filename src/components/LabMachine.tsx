import { memo, type ReactElement } from "react";
import {
  dispatchNodeLabel,
  type DispatchMechanism,
  type DispatchPlacement,
} from "../lib/dispatchLayout";

interface LabMachineProps {
  readonly placement: DispatchPlacement;
  readonly selected: boolean;
  readonly source: boolean;
  readonly destination: boolean;
  readonly senderPose: number;
  readonly receiverPose: number;
  readonly onSelectNode: (nodeId: string) => void;
}

const MACHINE_ART: Record<DispatchMechanism, ReactElement> = {
  trigger: (
    <g>
      <path d="M-67-82H46l35 24v111L52 82H-66l-23-25V-57Z" className="dl-carbon dl-ink" />
      <path d="M-66-82H46l17 14v118L42 67H-65l-18-18V-55Z" className="dl-alloy dl-ink" />
      <path d="m46-81 34 24v110L53 79l-12-12 22-17V-68Z" className="dl-cel" />
      <path d="m-89-28-13 0v47h13m154-51 27 0v37H65" className="dl-steel dl-ink" />
      <circle cx="-10" cy="-13" r="51" className="dl-paper dl-ink" />
      <path d="M-10-56v10m-43 31h10m34 44v-9m37-30H17m-50-37 6 7m48-9-7 7" className="dl-line" />
      <path d="m-10-14-15 23m15-23 1 29" className="dl-line dl-heavy" />
      <circle cx="-10" cy="-14" r="5" className="dl-carbon" />
      <path d="m-54-72 28 0m-36 111 2 8m94-114 0 11" className="dl-light-line" />
      <path d="m-57 79-7 16h94l-8-15" className="dl-cel dl-ink" />
    </g>
  ),
  compute: (
    <g>
      <path d="m-81 113-11 38h33l17-38m92 0 21 39h35l-17-47" className="dl-carbon dl-ink" />
      <path d="M-95-94-61-135H82l33 35v206L78 132H-96Z" className="dl-carbon dl-ink" />
      <path d="M-95-94H68l22 29v169l-26 25H-96Z" className="dl-signal dl-ink" />
      <path d="m69-92 44-9v207l-35 26-14-3 26-25V-64Z" className="dl-cel dl-ink" />
      <path d="m-90-102 32-28H78l23 26Z" className="dl-steel dl-ink" />
      <path d="m-95-73-24 21v91l24 13m197-91 37-21 23 18-24 22-27 1" className="dl-alloy dl-ink" />
      <path d="m126-47 19-18 10 8-19 19" className="dl-carbon" />
      <path d="M-52-127v-47H35l18 20v27" className="dl-carbon dl-ink" />
      <path d="M-42-132v-52H25l16 17v35Z" className="dl-paper dl-ink" />
      <path d="m-31-171 37 0m-37 10h49m-49 10h31" className="dl-line dl-fine" />
      <path d="M-69-72h116l13 16v62H-69Z" className="dl-carbon dl-ink" />
      <path d="M-56-58h87v43H-56Z" className="dl-paper" />
      <path d="m-47-48 51 0m-51 10 24 0m-24 10 51 0" className="dl-line dl-fine" />
      <path d="M-65 12H62v10H-65Z" className="dl-carbon" />
      <path d="m-81 78 65 0m-65 8h65m-65 8h65" className="dl-line" />
      <path d="m-86-84 47 0m-50 43 0 20m189 21 0 77" className="dl-light-line" />
      <path d="M-78 104H54v17H-78Z" className="dl-paper" />
    </g>
  ),
  agent: (
    <g>
      <path d="m-35 61 37 1-18 106-13 26-25-4 13-41Zm45-2 35-1 3 101 18 32-29 5-16-35Z" className="dl-cel dl-ink" />
      <path d="m-27 84-8 84m72-73 5 64" className="dl-light-line" />
      <path d="m-56 180 29 3 2 14-53 7-1-13Zm91 3 26-4 20 14-2 10-44 0Z" className="dl-carbon dl-ink" />
      <path d="M-28-90 26-91l33 35-11 89 13 40-43 3-16-29-15 32-43-8 14-50-16-72Z" className="dl-paper dl-ink" />
      <path d="m26-90 31 31-10 92 13 39-32 4-12-36 16-22-6-53Z" className="dl-alloy" />
      <path d="m-24-76 23 18 25-20-6 56-21 57-21-58Z" className="dl-carbon" />
      <path d="m-25-92 50-3 5 15-31 18-28-15Z" className="dl-signal dl-ink" />
      <path d="m-13-94 1-25 27 0 7 28-23 13Z" className="dl-carbon dl-ink" />
      <path d="m-29-157 48-5 25 22-4 38-22 19-42-14-13-29Z" className="dl-paper dl-ink" />
      <path d="m20-161 24 20-4 39-22 19-4-19 10-24Z" className="dl-steel" />
      <path d="m-34-137 67-5-6 25-56 1Z" className="dl-carbon dl-ink" />
      <path d="m-22-131 42-4-3 5-37 2Z" className="dl-paper" />
      <path d="m-31-152 44-3m-32 43 24 3m-30 7 25 5" className="dl-line dl-fine" />
      <path d="m-34-62-26 12-13 66 22 12 22-60" className="dl-alloy dl-ink" />
      <path d="m-65 9 22 3 15-27 14 10-17 35-30 2Z" className="dl-cel dl-ink" />
      <path d="m-36-26 46 10-17 79-51-12Z" className="dl-carbon dl-ink" />
      <path d="m-32-17 32 7-13 54-34-7Z" className="dl-paper" />
      <path d="m-32-3 23 5m-26 5 20 5m-21 7 19 4" className="dl-line dl-fine" />
    </g>
  ),
  tool: (
    <g>
      <path d="m-101 53 180 0 29 21-13 18h-194Z" className="dl-carbon dl-ink" />
      <path d="m-102-66 28-22h137l33 23V60H73V-50H-78V61h-24Z" className="dl-steel dl-ink" />
      <path d="m-77-87 139 0 31 21H-101Z" className="dl-paper dl-ink" />
      <path d="m73-50 20-15V59H73Zm-169-3h13V47h-13Z" className="dl-cel" />
      <path d="m-56-55 0 72m95-72v72" className="dl-line dl-heavy" />
      <circle cx="-73" cy="-69" r="8" className="dl-carbon" />
      <path d="m-112 10 20-13v42l-20 10Z" className="dl-alloy dl-ink" />
      <path d="m-80 20 53-35 69 16 33 46H-55Z" className="dl-paper dl-ink" />
      <path d="m-28-15 9 54m-45-15 38-26m-32 35 32-22m10-12 42 10m-39 1 38 9m-35 1 38 9" className="dl-line dl-fine" />
      <path d="m-80 21 26 26h130l-6 9H-61Z" className="dl-alloy dl-ink dl-fine" />
    </g>
  ),
  weather: (
    <g>
      <path d="m-82 84-8 23h34l9-23m87 0 10 25h37l-9-25" className="dl-carbon dl-ink" />
      <path d="M-91-82-57-115H48l38 35v152L63 96H-62l-28-25Z" className="dl-alloy dl-ink" />
      <path d="m49-112 36 32v152L63 94 52 67V-72Z" className="dl-cel" />
      <path d="M-76-71-51-95H38l24 25v77H-77Z" className="dl-carbon dl-ink" />
      <path d="M-62-63-43-80h70l19 20v51H-62Z" className="dl-steel" />
      <path d="m-61-19 17-16 18 3 8-16 24 2 13 16 25 0v21h-105Z" className="dl-paper" />
      <path d="m-49-57 66-1m-44 49-8 16m29-16L-7 7m29-16-8 16" className="dl-light-line" />
      <path d="M-92 22H83v56l-19 16H-72l-20-20Z" className="dl-carbon dl-ink" />
      <circle cx="3" cy="55" r="29" className="dl-steel dl-ink" />
      <path d="m-86-6-29 1-6 39 31 2m176-92 23-13 13 13-5 57-30 2" className="dl-steel dl-ink" />
      <path d="m-105 3-2 23m206-75-1 34" className="dl-light-line" />
    </g>
  ),
  channel: (
    <g>
      <path d="M-73-81-48-99H52l24 24V79H-73Z" className="dl-carbon dl-ink" />
      <path d="M-59-70-40-86H43l17 18v132H-59Z" className="dl-alloy dl-ink" />
      <path d="M-47-58h94V5h-94Z" className="dl-cel" />
      <path d="M-47-48 47-58v18l-94 9Z" className="dl-steel" />
      <path d="m-47-18 94-10v17L-47 1Z" className="dl-paper" />
      <path d="m-38-47 58-5m-60 43 71-9" className="dl-light-line" />
      <path d="m-68 38 126 0 27 32-6 15H-77l-5-16Z" className="dl-steel dl-ink" />
      <path d="m-69-73 8 0m121 1 7 0m-135 85 7 0m121 0 7 0" className="dl-light-line" />
    </g>
  ),
  observatory: (
    <g>
      <path d="m-24 9 0 34-30 51h20l33-40 31 42h23L18 37V13Z" className="dl-carbon dl-ink" />
      <path d="m-19 42 38 0-6-24h-26Z" className="dl-steel dl-ink" />
      <path d="m-62-65 109 35 4 37-23 17-107-35Z" className="dl-alloy dl-ink" />
      <path d="m-69-35 119 37-20 19-110-35Z" className="dl-cel" />
      <path d="m-78-79 30 8 4 19-18 49-23 4-18-18 4-40Z" className="dl-carbon dl-ink" />
      <path d="m-79-66 19 6-3 19-15 29-13-7 1-29Z" className="dl-steel dl-ink" />
      <path d="m-81-59 7 2-6 34-6-4Z" className="dl-paper" />
      <path d="m-36-55-9 49m36-41-7 49m37-39-5 48" className="dl-line" />
      <path d="m45-31 15 5 7 26-12 16-22-9Z" className="dl-steel dl-ink" />
      <path d="M19 32H89v45l-15 17H18Z" className="dl-carbon dl-ink" />
    </g>
  ),
  restricted: (
    <g>
      <path d="M-77-82-56-102H56l21 20V87H-77Z" className="dl-carbon dl-ink" />
      <path d="M-63-73-45-88H45l18 16V73H-63Z" className="dl-cel dl-ink" />
      <path d="M-48-60H-5V60h-43Zm50 0h44V60H2Z" className="dl-steel" />
      <path d="m-44-59 39 0V60h-13Z" className="dl-alloy" />
      <path d="M-59-4H60v24H-59Z" className="dl-carbon dl-ink" />
      <path d="m-28-4 13-16h28l15 16v26H-28Z" className="dl-paper dl-ink" />
      <path d="m-8-3 0-7H7v7m-5 10v7" className="dl-line dl-heavy" />
      <path d="m-70-57 7 0m-7 81h7m63-78 7 0m-7 80h7" className="dl-light-line" />
    </g>
  ),
  secret: (
    <g>
      <path d="M-58-67-39-83H38l22 19v134H-58Z" className="dl-carbon dl-ink" />
      <path d="M-44-59-31-69H29l16 13V55H-44Z" className="dl-alloy dl-ink" />
      <path d="m24-67 19 12V55H24Z" className="dl-steel" />
      <path d="M-33-37H23v64h-56Z" className="dl-cel dl-ink" />
      <path d="m-29-36 17 0-21 23v-18Zm33 0 17 0-54 59V6Z" className="dl-steel" />
      <path d="m-51-33 7 0m-7 72h7m47-73h8m-8 73h8" className="dl-light-line" />
    </g>
  ),
  data: (
    <g>
      <path d="M-94-83-70-103H69l26 25V99l-20 11H-95Z" className="dl-carbon dl-ink" />
      <path d="M-79-75H58v170H-79Z" className="dl-alloy dl-ink" />
      <path d="m59-76 35-2v176l-19 10-16-13Z" className="dl-cel" />
      <path d="M-62-60H38v34H-62Zm0 55H38v35H-62Zm0 55H38v33H-62Z" className="dl-paper dl-ink" />
      <path d="m-47-47 68 0m-67 10 39 0m-41 43 68 0m-67 10 34 0m-35 45 69 0m-68 10 40 0" className="dl-line dl-fine" />
      <path d="m-95-34-17 10v84l17 13m160-133 15 0m-15 16h15m-15 16h15" className="dl-line dl-heavy" />
    </g>
  ),
  job: (
    <g>
      <path d="M-109 68H104v30l-24 12H-93Z" className="dl-carbon dl-ink" />
      <path d="M-89-61-68-83H55l28 26V56H-91Z" className="dl-alloy dl-ink" />
      <path d="m55-82 28 25v113H59V-48Z" className="dl-cel" />
      <path d="M-103 40h212v25h-212Z" className="dl-steel dl-ink" />
      <path d="M-88-62H48v15H-88Z" className="dl-signal" />
      <path d="m-104 65 15 18H91l18-18" className="dl-line" />
      <circle cx="-67" cy="78" r="11" className="dl-steel dl-ink" />
      <circle cx="-24" cy="78" r="11" className="dl-steel dl-ink" />
      <circle cx="19" cy="78" r="11" className="dl-steel dl-ink" />
      <circle cx="63" cy="78" r="11" className="dl-steel dl-ink" />
      <path d="m-54-47 0 56m70-56 0 55M-75 9h114v12H-75Z" className="dl-carbon dl-ink" />
      <path d="m-69-72 59 0m56 41 0 42" className="dl-light-line" />
    </g>
  ),
  repo: (
    <g>
      <path d="M-109-17-83-43H83l26 22V92l-20 18H-107Z" className="dl-carbon dl-ink" />
      <path d="M-94-9H79v99H-94Z" className="dl-steel dl-ink" />
      <path d="m79-9 28-12v113l-19 17-9-19Z" className="dl-cel" />
      <path d="m-83-8 5-91 42 0 5 91m10 0 0-104 42 0 6 104m10 0 4-85 39 0 0 85" className="dl-paper dl-ink" />
      <path d="m-69-80 19 0m-16 11 16 0m38-27 20 0m-20 10 20 0m44 3 15 0m-15 10 15 0" className="dl-line dl-fine" />
      <path d="m-83 9 49 0v12h-49m88-12 14 0v12H5" className="dl-signal" />
      <path d="m-63 34-17 16 17 16m90-32 17 16-17 16" className="dl-light-line dl-heavy" />
    </g>
  ),
  pwa: (
    <g>
      <path d="M-73-108H49l24 25V54H-73Z" className="dl-carbon dl-ink" />
      <path d="M-59-92H40l17 19V35H-59Z" className="dl-alloy dl-ink" />
      <path d="M-47-78H29l15 15V14H-47Z" className="dl-paper" />
      <path d="M-47-78H29l15 15H-47Z" className="dl-signal" />
      <path d="m-33-40 47 0m-47 13h57m-57 13h34" className="dl-line" />
      <path d="M-22 54H25v32l31 10v14H-55V95l33-9Z" className="dl-cel dl-ink" />
      <path d="m-61 41 87 0m-59 53 40 0" className="dl-light-line" />
      <path d="m73-72 18 12v116H73Z" className="dl-steel dl-ink" />
    </g>
  ),
};

const MECHANISM_ART: Record<DispatchMechanism, ReactElement> = {
  trigger: <g><path d="M-8 25h42v25H-8Z" className="dl-signal dl-ink" /><path d="m-2 33 22 0" className="dl-light-line" /></g>,
  compute: <g><path d="M-48 19h90l15 16-10 38h-93Z" className="dl-paper dl-ink" /><path d="m-40 25 40 22 42-20m-83 36 23-20m53 24-24-26" className="dl-line" /><path d="M29 27h12v12H29Z" className="dl-signal" /></g>,
  agent: <g><path d="m46-58 26 12-3 22 29-19 12 13-47 38-24-27Z" className="dl-paper dl-ink" /><path d="m45-11 18 4 42-27-7-9-29 19 3-20-14-6Z" className="dl-alloy" /><path d="m97-48 17 4 7 19-15 7-12-14Z" className="dl-cel dl-ink" /><path d="m109-35 12-44" className="dl-line dl-heavy" /><path d="m119-78 4-13 2 15Z" className="dl-signal" /></g>,
  tool: <g><path d="M-69-33H61l13 15-11 18H-70Z" className="dl-carbon dl-ink" /><path d="m-59-21 113 0v10H-59Z" className="dl-signal" /><path d="m-58-18 83 0" className="dl-light-line" /></g>,
  weather: <g><path d="M3 55 1 31l16 7-8 16 19 15-16 9-11-17-19 10-2-18Z" className="dl-paper dl-ink dl-fine" /><circle cx="3" cy="55" r="6" className="dl-carbon" /></g>,
  channel: <g><path d="M-40 13H42l8 34h-100Z" className="dl-paper dl-ink" /><path d="m-34 20 31 17 35-18" className="dl-line dl-fine" /><path d="M26 23h8v8h-8Z" className="dl-signal" /></g>,
  observatory: <g><path d="m29 42 48 0v29L64 83H28Z" className="dl-paper dl-ink dl-fine" /><path d="m36 52 30 0m-30 9h19m-19 9h27" className="dl-line dl-fine" /><path d="m67 43 8 0v15h-8Z" className="dl-signal" /></g>,
  restricted: <g><path d="M-17-47H15v12h-32Z" className="dl-signal" /><path d="m-11-41 20 0" className="dl-light-line" /></g>,
  secret: <g><path d="m-9-27 20 0 13 13V8L9 22H-9L-22 8v-22Z" className="dl-paper dl-ink" /><circle cx="0" cy="-7" r="7" className="dl-carbon" /><path d="m-3-2-3 14H6L3-2Z" className="dl-carbon" /></g>,
  data: <g><path d="M-18-17H26v22h-44Z" className="dl-signal dl-ink" /><path d="m-9-8 24 0" className="dl-light-line" /></g>,
  job: <g><path d="m-33-32 60 0 17 18-4 25h-74Z" className="dl-paper dl-ink" /><path d="m-25-19 38 0m-38 10h20" className="dl-line dl-fine" /></g>,
  repo: <g><path d="M-28 29H14v41h-42Z" className="dl-paper dl-ink" /><path d="m-12 39-6 10 7 10m8-20 6 10-7 10" className="dl-line" /></g>,
  pwa: <g><path d="M-12-50H27v21h-39Z" className="dl-steel dl-ink" /><path d="m-4-41 15 0" className="dl-light-line" /></g>,
};

const MachineBody = memo(function MachineBody({ mechanism }: { readonly mechanism: DispatchMechanism }) {
  return MACHINE_ART[mechanism];
});

const MachineMechanism = memo(function MachineMechanism({ mechanism }: { readonly mechanism: DispatchMechanism }) {
  return MECHANISM_ART[mechanism];
});

export const LabMachine = memo(function LabMachine({
  placement,
  selected,
  source,
  destination,
  senderPose,
  receiverPose,
  onSelectNode,
}: LabMachineProps) {
  const { node, mechanism, spec, labelLines } = placement;
  const label = dispatchNodeLabel(node);
  const sealed = mechanism === "restricted" || mechanism === "secret";
  const transform = sealed ? undefined :
    mechanism === "agent" ? `rotate(${5 * senderPose - 7 * receiverPose} 46 -32)` :
    mechanism === "weather" ? `rotate(${28 * receiverPose - 24 * senderPose} 3 55)` :
    `translate(${10 * senderPose} ${7 * receiverPose})`;

  return (
    <g
      className={[
        "dispatch-machine",
        selected && "dispatch-machine--selected",
        source && "dispatch-machine--source",
        destination && "dispatch-machine--destination",
      ].filter(Boolean).join(" ")}
      transform={`translate(${placement.x} ${placement.y})`}
      data-testid="dispatch-machine"
      data-kind={node.restricted ? "restricted" : node.kind}
      data-mechanism={mechanism}
      data-selected={selected}
      role="button"
      tabIndex={0}
      aria-label={`${label}. ${node.restricted ? "Sealed private component" : node.kind}. Inspect component.`}
      aria-pressed={selected}
      onClick={() => onSelectNode(node.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onSelectNode(node.id);
        }
      }}
    >
      <title>{label}</title>
      <g aria-hidden="true">
        <path d="M-125-94v-34h28m194 0h28v34m0 193v30H97m-194 0h-28V99" className="dispatch-machine__focus" />
        <path d="M-99 113H95l28 14H-71Z" className="dl-shadow" />
        <g transform={`translate(0 ${spec.offsetY}) scale(${spec.scale})`}>
          <MachineBody mechanism={mechanism} />
          <g
            className="dispatch-machine__mechanism"
            transform={transform}
            opacity={sealed ? 1 - 0.45 * Math.max(senderPose, receiverPose) : 1}
          >
            <MachineMechanism mechanism={mechanism} />
          </g>
        </g>
        <circle cx={spec.port.x} cy={spec.port.y} r="7" className="dispatch-machine__port" />
        <text className="dispatch-machine__label" textAnchor="middle">
          {labelLines.map((line, index) => <tspan key={index} x="0" y={150 + index * 23}>{line}</tspan>)}
        </text>
      </g>
    </g>
  );
});
