import { describe, it, expect } from "vitest";
import {
  REFUND_WINDOW_DAYS,
  lastDayOfRefundWindow,
  isWithinRefundWindow,
  buildRefundRequestedEmail,
} from "./refunds";

describe("refund window", () => {
  it("is fourteen days", () => {
    expect(REFUND_WINDOW_DAYS).toBe(14);
  });

  it("ends fourteen calendar days after the purchase", () => {
    expect(
      lastDayOfRefundWindow(new Date(2026, 10, 1, 23, 0).toISOString())
    ).toBe("2026-11-15");
  });

  it("includes the whole of the last day, whatever time the purchase was made", () => {
    const purchasedAt = new Date(2026, 10, 1, 23, 0).toISOString();
    expect(
      isWithinRefundWindow(purchasedAt, new Date(2026, 10, 15, 23, 59))
    ).toBe(true);
  });

  it("is closed the day after the last day", () => {
    const purchasedAt = new Date(2026, 10, 1, 9, 0).toISOString();
    expect(
      isWithinRefundWindow(purchasedAt, new Date(2026, 10, 16, 0, 1))
    ).toBe(false);
  });

  it("is open on the day of purchase", () => {
    const purchasedAt = new Date(2026, 10, 1, 9, 0).toISOString();
    expect(
      isWithinRefundWindow(purchasedAt, new Date(2026, 10, 1, 10, 0))
    ).toBe(true);
  });
});

describe("buildRefundRequestedEmail", () => {
  const email = buildRefundRequestedEmail({
    learnerName: "Liam",
    learnerEmail: "liam@example.com",
    courseTitle: "Introduction to TypeScript",
    amount: 7900,
  });

  it("goes to the learner", () => {
    expect(email.to).toBe("liam@example.com");
  });

  it("says a refund was requested for the course", () => {
    expect(email.subject).toBe("Refund requested: Introduction to TypeScript");
  });

  it("only ever talks about a refund", () => {
    const text = `${email.subject}\n${email.body}`;
    expect(text).toMatch(/refund/i);
    expect(text).not.toMatch(/reversal|chargeback|cancel/i);
  });

  it("names the amount and says we will follow up when it is approved or declined", () => {
    expect(email.body).toContain("$79.00");
    expect(email.body).toMatch(/approved or declined/);
  });
});
