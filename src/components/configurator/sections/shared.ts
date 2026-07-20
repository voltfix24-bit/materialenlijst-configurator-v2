import type { MaterialenConfig } from "@/lib/configurator/types";

/** Gedeelde callback-signatuur waarmee elke sectie een deel van de config bijwerkt. */
export type UpdateFn = (patch: Partial<MaterialenConfig>) => void;
