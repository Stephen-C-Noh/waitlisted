"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Select, Textarea, Button } from "@/components/ui";
import type { CreateWaitlistEntryBody } from "@/lib/validations";

const PARTY_OPTIONS = [
  { value: 2, label: "2 Guests" },
  { value: 3, label: "3 Guests" },
  { value: 4, label: "4 Guests" },
  { value: 6, label: "5–6 Guests" },
  { value: 8, label: "7+ Guests" },
];

const COUNTRY_CODES = ["+1", "+44", "+33"];

const ZONE_OPTIONS = [
  { value: "", label: "No Preference" },
  { value: "Main Dining", label: "Main Dining" },
  { value: "Patio", label: "Patio" },
  { value: "Bar", label: "Bar" },
];

interface WaitEstimate {
  minutes: number;
  low: number;
  high: number;
}

export default function WaitlistPage() {
  const router = useRouter();

  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredZone, setPreferredZone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live wait-time indicator — re-fetches when party size changes
  const { data: estimate } = useQuery<WaitEstimate>({
    queryKey: ["wait-estimate", partySize],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/wait-estimate?partySize=${partySize}`);
      if (!res.ok) throw new Error("Failed to fetch estimate");
      return res.json();
    },
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setSubmitting(true);

      const phoneNumber = `${countryCode}${phone.replace(/\D/g, "")}`;

      const body: CreateWaitlistEntryBody = {
        guestName: guestName.trim(),
        partySize,
        phoneNumber,
        notes: notes.trim() || undefined,
        preferredZone: preferredZone
          ? (preferredZone as "Main Dining" | "Patio" | "Bar")
          : undefined,
      };

      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.issues) {
            const fieldErrors: Record<string, string> = {};
            for (const [key, msgs] of Object.entries(data.issues)) {
              fieldErrors[key] = (msgs as string[])[0];
            }
            setErrors(fieldErrors);
          } else {
            setErrors({ form: data?.error ?? "Something went wrong" });
          }
          return;
        }

        const data = await res.json();
        router.push(`/waitlist/${data.accessToken}/confirmation`);
      } catch {
        setErrors({ form: "Network error — please try again" });
      } finally {
        setSubmitting(false);
      }
    },
    [guestName, partySize, countryCode, phone, notes, preferredZone, router],
  );

  return (
    <main className="flex-grow flex items-center justify-center px-6 py-12 md:py-24 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-headline text-4xl md:text-6xl text-on-surface mb-4 tracking-tight">
            The Evening Awaits
          </h1>
          <p className="font-body text-on-surface-variant text-lg max-w-md mx-auto leading-relaxed">
            Secure your place in our dining room. We will notify you via SMS the
            moment your table is prepared.
          </p>
        </div>

        {/* Live wait-time indicator */}
        <div className="bg-surface-container-low rounded-xl p-6 mb-8 flex items-center justify-between ghost-border">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-tertiary rounded-full animate-pulse shadow-[0_0_15px_rgba(184,204,184,0.4)]" />
            <span className="font-label text-sm uppercase tracking-[0.2em] text-on-surface-variant">
              Live Status
            </span>
          </div>
          <div className="text-right">
            <p className="font-label text-[10px] uppercase tracking-[0.15em] text-on-surface-variant mb-1">
              Current Wait
            </p>
            <p className="font-headline text-2xl text-primary">
              {estimate
                ? `${estimate.low}–${estimate.high} minutes`
                : "—"}
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-surface-container-high rounded-xl p-8 md:p-12 shadow-2xl relative ghost-border">
          {errors.form && (
            <div className="mb-6 rounded-lg bg-error-container/20 p-4 text-error text-sm font-label">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input
                id="guestName"
                label="Guest Name"
                placeholder="e.g. Julian Vane"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                error={errors.guestName}
                required
              />
              <Select
                id="partySize"
                label="Party Size"
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                error={errors.partySize}
              >
                {PARTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="phone"
                className="font-label text-xs uppercase tracking-[0.18em] text-on-surface-variant"
              >
                Phone Number (SMS Notifications)
              </label>
              <div className="flex gap-4">
                <div className="w-24 shrink-0">
                  <Select
                    id="countryCode"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={errors.phoneNumber}
                  required
                />
              </div>
            </div>

            {/* Preferred Zone */}
            <Select
              id="preferredZone"
              label="Preferred Seating"
              value={preferredZone}
              onChange={(e) => setPreferredZone(e.target.value)}
            >
              {ZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>

            {/* Notes */}
            <Textarea
              id="notes"
              label="Special Occasion or Preferences"
              placeholder="Allergies, seating preferences, or special requests..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={errors.notes}
            />

            {/* Submit */}
            <div className="pt-4">
              <Button
                type="submit"
                size="lg"
                className="w-full py-5 text-sm tracking-[0.2em] uppercase"
                disabled={submitting}
              >
                {submitting ? "Joining…" : "Confirm Position"}
              </Button>
              <p className="text-center mt-6 font-label text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
                By joining, you agree to receive automated SMS updates regarding
                your table.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
