/**
 * The isometric kit's server half: draw a composition with an Iso, its
 * objects, links and floating cards, then hand the compositions to
 * IsoStage.astro. A scene animates them with live.ts.
 */
export { type Composition, Iso, markDefs, type Pt } from "./iso";
export { agent, chassis, database, DESK_TILE, deskTile, gate, room, server, sleepBadge, type Tile, tile } from "./objects";
export { label, link, markDef, modeOnly, packetLayer, stem } from "./links";
export { type Bar, type Block, browserWindow, checklist, docHTML, fo, storedCard } from "./cards";
