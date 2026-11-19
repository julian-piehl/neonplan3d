import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "./model.ts";
import { searchIndex, searchItems } from "./search.ts";
import type { HomeAssistant } from "./types.ts";

test("search finds rooms and placed devices by name, room and without accents", () => {
  const hass = {
    language: "de",
    states: {
      "light.decke": { entity_id: "light.decke", state: "on", attributes: { friendly_name: "Deckenlicht Küche" } },
      "sensor.t": { entity_id: "sensor.t", state: "21", attributes: { friendly_name: "Temperatur" } },
    },
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("eg", "EG", 0);
  floor.rooms = [{ id: "k", name: "Küche", area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" }];
  floor.placements = [{ entity_id: "sensor.t", x: 1, z: 1, y: null, mount: null }];
  floor.furniture = [{ id: "l", type: "lamp_ceiling", x: 2, z: 2, rotation: 0, w: 0.4, d: 0.4, h: 0.1, variant: null, entity: "light.decke", power: null }];
  b.floors = [floor];
  const index = searchIndex(hass, b);
  assert.equal(index.length, 3);
  // the room comes first, then its devices; "kuche" matches "Küche"
  const hits = searchItems(index, "kuche");
  assert.equal(hits[0].kind, "room");
  assert.ok(hits.some((h) => h.entity === "light.decke"));
  // devices know their room
  const temp = searchItems(index, "temp")[0];
  assert.equal(temp.entity, "sensor.t");
  assert.equal(temp.where, "Küche");
  assert.deepEqual(searchItems(index, "  "), []);
});

test("search leaves out decorative floors and their rooms", () => {
  const hass = { language: "de", states: {} } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const room = (id: string, name: string) => ({ id, name, area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]] as [number, number][], floor_material: "wood" });
  const eg = { ...newFloor("eg", "EG", 0), rooms: [room("nachbar", "Wohnzimmer Nachbar")], decorative: true };
  const og = { ...newFloor("og", "OG", 2.8), rooms: [room("wz", "Wohnzimmer")] };
  b.floors = [eg, og];
  const index = searchIndex(hass, b);
  assert.deepEqual(
    index.map((i) => i.roomId),
    ["wz"],
  );
  // with a single floor left to find, the hits name no floor
  assert.equal(index[0].where, "");
});

test("search leaves out decorative rooms and the devices in them", () => {
  const hass = {
    language: "de",
    states: {
      "light.flur": { entity_id: "light.flur", state: "on", attributes: { friendly_name: "Licht Treppenhaus" } },
      "light.wz": { entity_id: "light.wz", state: "on", attributes: { friendly_name: "Licht Wohnzimmer" } },
    },
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("og", "OG", 2.8);
  floor.rooms = [
    { id: "wz", name: "Wohnzimmer", area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" },
    { id: "th", name: "Treppenhaus", area_id: null, points: [[4, 0], [6, 0], [6, 3], [4, 3]], floor_material: "tiles", decorative: true },
  ];
  floor.placements = [
    { entity_id: "light.wz", x: 1, z: 1, y: null, mount: null },
    { entity_id: "light.flur", x: 5, z: 1, y: null, mount: null },
  ];
  b.floors = [floor];
  assert.deepEqual(
    searchIndex(hass, b).map((i) => i.roomId + ":" + (i.entity ?? "")),
    ["wz:", "wz:light.wz"],
  );
});
