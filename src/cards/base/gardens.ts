import { defineEffect, done, noMemory } from "../program";

export const gardens = defineEffect(noMemory, () => done());
