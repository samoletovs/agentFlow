---
name: Dispatch Lab
description: An illustrated, explorable view of declared agent architecture.
colors:
  ink: "#24343d"
  paper: "#f2f0e5"
  steel: "#7d969d"
  accent: "#b43e2e"
  accent-hover: "#933124"
  on-accent: "#fffaf1"
  control-bg: "#fbfaf3"
  muted: "#4f656b"
  line: "#8ca09f"
  room: "#d1dad3"
  wall: "#e7e8df"
  alloy: "#c6d2c9"
  cel: "#45636e"
  machine-signal: "#c9513c"
  shadow-fill: "#acbab2"
typography:
  display:
    fontFamily: "Impact, Arial Narrow, Segoe UI, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    letterSpacing: "0.01em"
  title:
    fontFamily: "Bahnschrift, Arial Narrow, Segoe UI, sans-serif"
    fontSize: "28px"
    lineHeight: 1.16
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  caption:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.55
  control:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "12px"
rounded:
  square: "0px"
  cue: "2px"
  control: "3px"
spacing:
  tight: "8px"
  compact: "12px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.control-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  input-search:
    backgroundColor: "{colors.control-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  view-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
  destination-cue:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cue}"
    padding: "8px 12px"
  component-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "20px 22px 26px"
---

# Design System: Dispatch Lab

## Overview

**Creative North Star: "The illustrated technical lab"**

Dispatch Lab gives software components a recognizable mechanical vocabulary:
angular machines, a lean agent figure, sealed mechanisms and precise labels.
Graphite outlines, steel surfaces, paper highlights and vermilion signals carry
the identity. This is the user-selected graphic-novel direction, not a borrowed
PortaBaltica theme or a generic dashboard.

The illustration invites investigation; the information remains literal.
Component names, handoff labels and relationships come from the blueprint.
Room bays adapt to the actual content rather than preserving one sample's
coordinates or inventing a decorative agent.

**Key Characteristics:** original cel illustration, restrained signal colour,
readable technical information, controllable motion and explicit uncertainty.

## Colors

Use ink and the neutral material colours for the room and application chrome.
The main accent identifies the current relationship, primary playback action
and focus. Machine-signal is the brighter illustrated surface treatment;
it is not a separate operational status colour.

The technical Diagram view may use distinct, accessible flow colours to
separate relationships. Those colours do not replace the lab's material palette.
Never use colour alone to identify a flow or an access state.

## Typography

The compressed display face belongs to the SVG room masthead. Its size is in
the scene's coordinate system; do not apply the same oversized treatment to
ordinary controls.

Application headings use the narrow UI title stack. Body and controls use
local system faces, with exact technical names preserved. The prominent
handoff caption combines endpoint names and the declared action; on mobile its
text becomes 18px rather than being relegated to small metadata. Resource
identifiers may use code typography in the inspector.
Illustrated labels are wrapped to a measured width, not just a character count.
Elision may bound a long caption, but its complete accessible name and inspector
text must remain available.

All fonts are local/system fonts. No remote font service is part of the design.

## Layout

The lab is the primary workspace. Agent selection, flow search, access state
and view switching stay compact around it. The illustration uses variable-size
role bays, not a fixed sample composition. Only arrows declare relationships;
position is not execution order.

The first visible flow is selected on entry. All flows is an explicit overview.
The technical map is a separate, on-demand view, not a permanent competing
sidebar.

At the 760px application breakpoint, controls reflow and the lab defaults to a
focused relationship. If its destination is outside the viewport, a labelled
directional cue makes the continuation explicit and opens that component.
Whole-lab overview remains a deliberate zoomed-out option.

Keyboard focus reveals the focused mechanism without selecting a different
handoff or opening its inspector. Logical component focus survives inspector
dismissal even when the original directional cue no longer exists.

Component inspection sits beside the stage on wide screens and below it on
narrow screens. Preserve useful world space and a visible primary playback
action; do not shrink the whole graph into the only mobile experience.
Compact header and access-note contents may wrap when text is enlarged; keep
their actions available rather than hiding overflow.

## Elevation & Depth

Depth in the lab comes from cel-shaded geometry, side panels, hatching and
drawn cast shadows. Do not replace the illustrated mechanisms with generic
soft-shadowed rectangles.

Application chrome is mostly flat. Popovers use the restrained offset shadow
defined in the sidecar; directional cues use a short offset edge. Focus uses a
clear outline rather than a decorative glow.

## Shapes

Mechanisms use angular silhouettes and hard-edged material changes. Controls
have nearly square corners. The primary wordmark retains its two-colour
construction, without inserting space into lowerCamelCase project names.

Restricted nodes always use a sealed generic mechanism. Their shape, caption,
tooltip and inspector must not recover private details through a visual alias.

## Components

**Playback controls.** Full-flow Play, Pause/Resume, individual handoff
navigation and Stop/reset must be visibly distinct. The same progress value
drives sender preparation, envelope travel and receiver acknowledgement.
Animation explains declared occurrences; it is not a live execution.
Reading panels pause the walkthrough. Returning to the lab never resumes it
without an explicit action, and an outline selection reveals the lab before
starting the selected handoff.

**Handoff caption.** Give the relationship and its declared action the reading
weight of a graphic-novel caption. Preserve exact names; do not invent a
decision, result, latency or processing claim.

**Destination cue.** Identify an offscreen destination at the appropriate
viewport edge. Keep the label within the view, clear of controls, and usable
with a keyboard or pointer.

**Component inspector.** Show responsibility, declared resources/references
and incoming/outgoing relationships. Inspection pauses the walkthrough.
Public projection removes restricted detail, resource and URL fields before
they reach either visual renderer.

**Navigation and fields.** Use familiar buttons, selects and search fields.
Keep a selected flow represented in the dropdown: an explicit selection from
another surface clears an incompatible search.

## Do's and Don'ts

- **Do** reuse the mechanism vocabulary for every supported node kind.
- **Do** preserve repeated handoffs, loops and explicit source changes.
- **Do** maintain keyboard, touch and reduced-motion equivalents.
- **Do** keep labels and actionable information readable outside the illustration.
- **Don't** present presentation timing as agent latency or throughput.
- **Don't** infer relationships from room placement.
- **Don't** copy real execution traces or secrets into the public blueprint.
- **Don't** introduce trackers, remote runtime assets or remote fonts.
