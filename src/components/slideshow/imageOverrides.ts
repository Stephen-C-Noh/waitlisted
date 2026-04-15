/**
 * Curated image overrides keyed by `menu_items.name` from the POS database.
 *
 * The POS seed data leaves `image_url` null, so rather than mutating the
 * shared schema we layer a lookup here. Keys must match the exact `name`
 * column in `menu_items` (case-sensitive).
 *
 * An entry can be a plain URL string (for default center-35% framing) or
 * an object with `{ url, objectPosition }` when a specific photo's subject
 * isn't centered — for example a landscape shot where the dish is in the
 * right third of the frame.
 */
type Override = string | { url: string; objectPosition: string };

const DEFAULT_OBJECT_POSITION = "center 35%";

const OVERRIDES: Record<string, Override> = {
  "Grilled Ribeye Steak":
    "https://plus.unsplash.com/premium_photo-1723478557023-1f739ec06671?q=80&w=1600&auto=format&fit=crop",
  "Shrimp Scampi":
    "https://images.unsplash.com/photo-1659951226926-a75791782250?q=80&w=1600&auto=format&fit=crop",
  "Fettuccine Alfredo": "/menu/Fettuccine.png",
  "Margherita Pizza": "/menu/MargheritaPizza.png",
  "Crispy Chicken Wings": "/menu/Wings.png",
  "Classic Burger": {
    url: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?q=80&w=1600&auto=format&fit=crop",
    objectPosition: "right 35%",
  },
};

export interface ResolvedImage {
  url: string | null;
  objectPosition: string;
}

export function resolveMenuImage(
  name: string,
  dbImageUrl: string | null,
): ResolvedImage {
  const override = OVERRIDES[name];
  if (!override) {
    return { url: dbImageUrl, objectPosition: DEFAULT_OBJECT_POSITION };
  }
  if (typeof override === "string") {
    return { url: override, objectPosition: DEFAULT_OBJECT_POSITION };
  }
  return { url: override.url, objectPosition: override.objectPosition };
}
