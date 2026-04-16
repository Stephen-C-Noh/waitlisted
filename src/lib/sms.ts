/**
 * SMS provider stub — logs messages to the console.
 * Replace the implementation once a real provider is wired up.
 * Controlled by env var SMS_PROVIDER (only "console" is supported).
 */

export interface SmsMessage {
  to: string;
  body: string;
}

export async function sendSms(message: SmsMessage): Promise<void> {
  const provider = process.env.SMS_PROVIDER ?? "console";

  if (provider === "console") {
    console.log(
      `[SMS → ${message.to}] ${message.body}`,
    );
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

export function buildReadyNotification(guestName: string, baseUrl: string, token: string): SmsMessage["body"] {
  return (
    `Hi ${guestName}! Your table at Waitlisted is almost ready. ` +
    `Check your status: ${baseUrl}/waitlist/${token}/status`
  );
}
