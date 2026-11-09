import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  lessonProgress,
  lessons,
  modules,
  purchases,
  refunds,
  videoWatchEvents,
  LessonProgressStatus,
  RefundStatus,
} from "~/db/schema";
import { isWithinRefundWindow, lastDayOfRefundWindow } from "~/lib/refunds";

const WATCH_LIMIT_SECONDS = 2 * 60 * 60;
const COMPLETION_LIMIT = 0.5;

type Purchase = typeof purchases.$inferSelect;

export type RefundEligibility =
  | {
      eligible: true;
      purchase: Purchase;
      /** A Refund is always the amount paid on the Purchase. */
      amount: number;
      lastDayInWindow: string;
    }
  | { eligible: false; reason: string; status: 403 | 409 };

function refuse(reason: string, status: 403 | 409 = 403): RefundEligibility {
  return { eligible: false, reason, status };
}

/**
 * Whether the learner may make a Refund request on their latest Purchase of
 * the course. The course page and the refund action both ask this, so the
 * button is only ever shown when the request would be accepted.
 */
export function checkRefundEligibility(
  userId: number,
  courseId: number
): RefundEligibility {
  const purchase = db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.courseId, courseId)))
    .orderBy(sql`${purchases.createdAt} desc`)
    .get();

  if (!purchase) return refuse("You have not bought this course.");

  const openRequest = db
    .select({ id: refunds.id })
    .from(refunds)
    .where(
      and(
        eq(refunds.purchaseId, purchase.id),
        eq(refunds.status, RefundStatus.Requested)
      )
    )
    .get();

  if (openRequest) {
    return refuse("You already have a refund request for this purchase.", 409);
  }

  // A seat that came out of a team licence, and has been claimed, belongs to
  // the team — the learner cannot hand it back on their own.
  const claimedSeat = db
    .select({ id: coupons.id })
    .from(coupons)
    .where(
      and(eq(coupons.purchaseId, purchase.id), isNotNull(coupons.redeemedAt))
    )
    .get();

  if (claimedSeat) {
    return refuse("A team seat that has been claimed can't be refunded.");
  }

  const lastDayInWindow = lastDayOfRefundWindow(purchase.createdAt);

  if (!isWithinRefundWindow(purchase.createdAt)) {
    return refuse(`Your refund window closed on ${lastDayInWindow}.`);
  }

  const lessonIds = db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);

  if (lessonIds.length > 0) {
    const completed =
      db
        .select({ count: sql<number>`count(*)` })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            eq(lessonProgress.status, LessonProgressStatus.Completed),
            inArray(lessonProgress.lessonId, lessonIds)
          )
        )
        .get()?.count ?? 0;

    if (completed / lessonIds.length >= COMPLETION_LIMIT) {
      return refuse(
        "You have completed too much of this course for it to be refunded."
      );
    }

    const watchedSeconds = db
      .select({
        furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
      })
      .from(videoWatchEvents)
      .where(
        and(
          eq(videoWatchEvents.userId, userId),
          inArray(videoWatchEvents.lessonId, lessonIds)
        )
      )
      .groupBy(videoWatchEvents.lessonId)
      .all()
      .reduce((total, row) => total + row.furthest, 0);

    if (watchedSeconds >= WATCH_LIMIT_SECONDS) {
      return refuse(
        "You have watched too much of this course for it to be refunded."
      );
    }
  }

  return {
    eligible: true,
    purchase,
    amount: purchase.amountPaid,
    lastDayInWindow,
  };
}
