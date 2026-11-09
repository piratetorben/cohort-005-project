import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { checkRefundEligibility } from "./refunds.server";

let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

function buy(overrides: Partial<typeof schema.purchases.$inferInsert> = {}) {
  return testDb
    .insert(schema.purchases)
    .values({
      userId: base.user.id,
      courseId: base.course.id,
      amountPaid: 7900,
      ...overrides,
    })
    .returning()
    .get();
}

function complete(count: number) {
  for (const lessonId of lessonIds.slice(0, count)) {
    testDb
      .insert(schema.lessonProgress)
      .values({
        userId: base.user.id,
        lessonId,
        status: schema.LessonProgressStatus.Completed,
      })
      .run();
  }
}

function check() {
  return checkRefundEligibility(base.user.id, base.course.id);
}

beforeEach(() => {
  testDb = createTestDb();
  base = seedBaseData(testDb);
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Module", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2, 3, 4].map(
    (position) =>
      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("checkRefundEligibility", () => {
  it("offers the amount paid on a fresh Purchase", () => {
    const purchase = buy({ amountPaid: 4900 });
    const result = check();
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.purchase.id).toBe(purchase.id);
      expect(result.amount).toBe(4900);
    }
  });

  it("refuses a learner who has not bought the course", () => {
    expect(check()).toMatchObject({ eligible: false, status: 403 });
  });

  it("refuses a second Refund request on the same Purchase", () => {
    const purchase = buy();
    testDb
      .insert(schema.refunds)
      .values({ purchaseId: purchase.id, reason: "Not for me, sorry." })
      .run();
    expect(check()).toMatchObject({ eligible: false, status: 409 });
  });

  it("refuses once the refund window has closed", () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 20);
    buy({ createdAt: longAgo.toISOString() });
    const result = check();
    expect(result).toMatchObject({ eligible: false, status: 403 });
    if (!result.eligible) expect(result.reason).toMatch(/refund window/);
  });

  it("still allows a learner who has completed under half the lessons", () => {
    buy();
    complete(1);
    expect(check().eligible).toBe(true);
  });

  it("refuses a learner who has completed half the lessons", () => {
    buy();
    complete(2);
    const result = check();
    expect(result).toMatchObject({ eligible: false, status: 403 });
    if (!result.eligible) expect(result.reason).toMatch(/completed/);
  });

  it("refuses a learner who has watched two hours", () => {
    buy();
    testDb
      .insert(schema.videoWatchEvents)
      .values({
        userId: base.user.id,
        lessonId: lessonIds[0],
        eventType: "progress",
        positionSeconds: 2 * 60 * 60,
      })
      .run();
    const result = check();
    expect(result).toMatchObject({ eligible: false, status: 403 });
    if (!result.eligible) expect(result.reason).toMatch(/watched/);
  });

  it("never mentions cancelling, reversals or chargebacks", () => {
    buy();
    complete(4);
    const result = check();
    if (!result.eligible) {
      expect(result.reason).not.toMatch(/cancel|reversal|chargeback/i);
    }
  });
});
