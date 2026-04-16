import { z } from "zod";

/* ---------- shared primitives ---------- */

export const PIN = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits");

// Relaxed UUID: accepts any 8-4-4-4-12 hex string (the seeded table/user IDs
// from V5/V6 don't comply with RFC 4122 variant bits).
export const UUID = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Expected a UUID",
  );

export const AccessToken = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Invalid access token");

export const Zone = z.enum(["Main Dining", "Patio", "Bar"]);

export const WaitlistStatus = z.enum([
  "WAITING",
  "NOTIFIED",
  "SEATED",
  "CANCELLED",
  "NO_SHOW",
]);
export type WaitlistStatus = z.infer<typeof WaitlistStatus>;

export const PreOrderStatus = z.enum([
  "DRAFT",
  "CONFIRMED",
  "FIRED",
  "CANCELLED",
]);
export type PreOrderStatus = z.infer<typeof PreOrderStatus>;

/* ---------- auth ---------- */

export const LoginBody = z.object({
  pin: PIN,
});
export type LoginBody = z.infer<typeof LoginBody>;

/* ---------- waitlist ---------- */

// Digits only, optional leading +, 8–15 digits (E.164-ish).
const PhoneNumber = z
  .string()
  .trim()
  .regex(/^\+?\d{8,15}$/, "Enter a valid phone number");

const GuestName = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or fewer");

const Notes = z
  .string()
  .trim()
  .max(500, "Notes must be 500 characters or fewer")
  .optional();

// Mockup exposes: 2, 3, 4, 5–6, 7+. Store the numeric party size.
const PartySize = z
  .number({ error: "Party size is required" })
  .int()
  .min(1, "Party size must be at least 1")
  .max(20, "Party size must be 20 or fewer");

export const CreateWaitlistEntryBody = z.object({
  guestName: GuestName,
  partySize: PartySize,
  phoneNumber: PhoneNumber,
  notes: Notes,
  preferredZone: Zone.optional(),
});
export type CreateWaitlistEntryBody = z.infer<typeof CreateWaitlistEntryBody>;

// Staff dashboard: patch whatever subset the UI edited.
export const UpdateWaitlistEntryBody = z
  .object({
    guestName: GuestName,
    partySize: PartySize,
    phoneNumber: PhoneNumber,
    notes: Notes.unwrap().nullable(),
    preferredZone: Zone.nullable(),
    status: WaitlistStatus,
  })
  .partial();
export type UpdateWaitlistEntryBody = z.infer<typeof UpdateWaitlistEntryBody>;

export const SeatGuestBody = z.object({
  tableId: UUID,
  serverUserId: UUID.optional(),
});
export type SeatGuestBody = z.infer<typeof SeatGuestBody>;

export const WaitEstimateQuery = z.object({
  partySize: z.coerce.number().int().min(1).max(20),
});
export type WaitEstimateQuery = z.infer<typeof WaitEstimateQuery>;

/* ---------- pre-order ---------- */

export const PreOrderItemInput = z.object({
  menuItemId: UUID,
  quantity: z.number().int().min(1).max(99),
  specialInstructions: z
    .string()
    .trim()
    .max(300, "Instructions must be 300 characters or fewer")
    .optional(),
});
export type PreOrderItemInput = z.infer<typeof PreOrderItemInput>;

export const UpsertPreOrderBody = z.object({
  items: z.array(PreOrderItemInput).max(50, "Too many items"),
});
export type UpsertPreOrderBody = z.infer<typeof UpsertPreOrderBody>;

// "Fire to kitchen": the second PIN check. The PIN must be re-verified
// server-side against users.pin_hash before Spring Boot is called.
export const FirePreOrderBody = z.object({
  preOrderId: UUID,
  pin: PIN,
});
export type FirePreOrderBody = z.infer<typeof FirePreOrderBody>;
