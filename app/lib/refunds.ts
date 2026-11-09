import { formatPrice } from "~/lib/utils";

/** How many calendar days after a Purchase a learner may request a Refund. */
export const REFUND_WINDOW_DAYS = 14;

// The refund window is counted in whole calendar days, not hours — someone who
// buys at 23:00 still gets the whole of their fourteenth day.
function calendarDay(when: Date): string {
  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The last calendar day (YYYY-MM-DD) on which a Refund can be requested. */
export function lastDayOfRefundWindow(purchasedAtIso: string): string {
  const deadline = new Date(purchasedAtIso);
  deadline.setDate(deadline.getDate() + REFUND_WINDOW_DAYS);
  return calendarDay(deadline);
}

export function isWithinRefundWindow(
  purchasedAtIso: string,
  now: Date = new Date()
): boolean {
  const today = calendarDay(now);
  return (
    today >= calendarDay(new Date(purchasedAtIso)) &&
    today <= lastDayOfRefundWindow(purchasedAtIso)
  );
}

/**
 * The confirmation the learner gets when they make a Refund request. There is
 * no mail transport wired up yet, so the caller logs it.
 */
export function buildRefundRequestedEmail(input: {
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  amount: number;
}) {
  return {
    to: input.learnerEmail,
    subject: `Refund requested: ${input.courseTitle}`,
    body: [
      `Hi ${input.learnerName},`,
      "",
      `We have your refund request for "${input.courseTitle}".`,
      `If it is approved, we will refund ${formatPrice(input.amount)}, the amount you paid.`,
      "",
      "Someone on our team reads every refund request. You do not need to do anything else — we will email you again once your refund is approved or declined.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}
