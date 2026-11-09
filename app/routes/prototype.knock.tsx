// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?" (#19).
// Lives on the `prototype/knock-spike` branch only. It answers "does Knock
// behave right?", not "what should the Feed look like?" — so it is ugly on
// purpose: buttons on the left, raw state on the right.
import { useCallback, useEffect, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { and, eq, isNull } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { db } from "~/db";
import {
  comments,
  courses,
  CourseStatus,
  lessons,
  modules,
  users,
} from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import {
  getPreferences,
  publicConfig,
  setEnrollmentOptIn,
  signTokenFor,
  syncUser,
  trigger,
} from "~/lib/knock.prototype.server";
import { Button } from "~/components/ui/button";

function getUser(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

function getQuestions() {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: users.id,
      authorName: users.name,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt)))
    .all();
}

function getCourses() {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: users.id,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(courses.status, CourseStatus.Published))
    .all();
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  const user = userId ? getUser(userId) : undefined;
  if (!user) return { user: null } as const;

  await syncUser(user);
  return {
    user: { id: user.id, name: user.name, role: user.role },
    token: await signTokenFor(user.id),
    ...publicConfig(),
    questions: getQuestions(),
    courses: getCourses(),
    preferences: await getPreferences(user.id),
  } as const;
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  const actor = userId ? getUser(userId) : undefined;
  if (!actor) throw new Response("Pick a user in the DevUI", { status: 401 });
  await syncUser(actor);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "reply") {
    const question = getQuestions().find(
      (q) => q.id === Number(form.get("questionId"))
    );
    if (!question) return { error: "question not found" };
    const author = getUser(question.authorId)!;
    await syncUser(author);
    return trigger("discussion-reply", actor.id, author.id, {
      replierName: actor.name,
      lessonTitle: question.lessonTitle,
      questionId: question.id,
    });
  }

  if (intent === "enroll") {
    const course = getCourses().find(
      (c) => c.id === Number(form.get("courseId"))
    );
    if (!course) return { error: "course not found" };
    const instructor = getUser(course.instructorId)!;
    await syncUser(instructor);
    return trigger("new-enrollment", actor.id, instructor.id, {
      studentName: actor.name,
      courseTitle: course.title,
      courseId: course.id,
    });
  }

  if (intent === "enrollment-pref") {
    const optedIn = form.get("value") === "on";
    const prefs = await setEnrollmentOptIn(actor.id, optedIn);
    return { ok: true, intent, optedIn, categories: prefs.categories };
  }

  return { error: `unknown intent ${String(intent)}` };
}

export default function KnockPrototype({ loaderData }: Route.ComponentProps) {
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";

  if (!loaderData.user) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold">Knock prototype</h1>
        <p>Pick a user in the DevUI panel (bottom right).</p>
      </div>
    );
  }
  const { user, questions, courses } = loaderData;

  return (
    <div className="space-y-4 p-6">
      <div className="rounded border border-dashed border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <strong>PROTOTYPE</strong> (#19, branch <code>prototype/knock-spike</code>
        ). Signed in as <strong>{user.name}</strong> (#{user.id}, {user.role}).
        Switch users in the DevUI; the feed on the right re-authenticates with a
        freshly signed token.
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section>
            <h2 className="font-semibold">
              Check 2 · Discussion Reply → question author
            </h2>
            <p className="text-xs text-muted-foreground">
              Replies as {user.name}. Nothing is written to the database; only
              the Knock workflow fires. Then switch to the author to see it.
            </p>
            <ul className="mt-2 space-y-1">
              {questions.map((q) => (
                <li key={q.id}>
                  <Form method="post" className="flex items-center gap-2">
                    <input type="hidden" name="intent" value="reply" />
                    <input type="hidden" name="questionId" value={q.id} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || q.authorId === user.id}
                    >
                      Reply → notify {q.authorName}
                    </Button>
                    <span className="truncate text-xs text-muted-foreground">
                      “{q.body.slice(0, 40)}” · {q.lessonTitle} (
                      {q.courseTitle})
                    </span>
                  </Form>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">
              Check 4 · new Enrollment → Instructor (off by default)
            </h2>
            <p className="text-xs text-muted-foreground">
              Enrolls as {user.name} (Knock trigger only). The Instructor gets
              nothing until they opt in below.
            </p>
            <ul className="mt-2 space-y-1">
              {courses.map((c) => (
                <li key={c.id}>
                  <Form method="post" className="flex items-center gap-2">
                    <input type="hidden" name="intent" value="enroll" />
                    <input type="hidden" name="courseId" value={c.id} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || c.instructorId === user.id}
                    >
                      Enroll → notify {c.instructorName}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {c.title}
                    </span>
                  </Form>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              {(["on", "off"] as const).map((value) => (
                <Form method="post" key={value}>
                  <input type="hidden" name="intent" value="enrollment-pref" />
                  <input type="hidden" name="value" value={value} />
                  <Button size="sm" disabled={busy}>
                    {value === "on" ? "Opt in" : "Opt out"}: Enrollment
                    Notifications ({user.name})
                  </Button>
                </Form>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-semibold">Last action result</h2>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
              {result ? JSON.stringify(result, null, 2) : "—"}
            </pre>
            <h2 className="mt-3 font-semibold">
              {user.name}'s Knock preferences (set "default")
            </h2>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(loaderData.preferences, null, 2)}
            </pre>
          </section>
        </div>

        <HeadlessFeed
          key={user.id}
          userId={user.id}
          token={loaderData.token}
          publicKey={loaderData.publicKey}
          channelId={loaderData.feedChannelId}
        />
      </div>
    </div>
  );
}

type FeedItem = {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  source: { key: string };
  blocks: { name: string; rendered: string }[];
};
type FeedResponse = {
  entries: FeedItem[];
  meta: { unread_count: number; unseen_count: number; total_count: number };
};

function toPlainText(html: string) {
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
  );
}

// Check 3: talks to Knock straight from the browser with only the public
// key and the signed user token — no secret key, no Knock React components.
function HeadlessFeed(props: {
  userId: number;
  token: string;
  publicKey: string;
  channelId: string;
}) {
  const { userId, token, publicKey, channelId } = props;
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`https://api.knock.app${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${publicKey}`,
          "X-Knock-User-Token": token,
          "Content-Type": "application/json",
        },
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
    [publicKey, token]
  );

  const refresh = useCallback(async () => {
    const { status, body } = await api(
      `/v1/users/${userId}/feeds/${channelId}?page_size=25`
    );
    if (status === 200) setFeed(body);
    else setLog((l) => [`GET feed → ${status}`, ...l].slice(0, 20));
  }, [api, userId, channelId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function mark(ids: string[], status: string) {
    const r = await api(`/v1/messages/batch/${status}`, {
      method: "POST",
      body: JSON.stringify({ message_ids: ids }),
    });
    setLog((l) => [`batch/${status} → ${r.status}`, ...l].slice(0, 20));
    refresh();
  }

  async function markAll(status: string) {
    // Bulk ops are async jobs in Knock; the feed catches up on a later poll.
    const r = await api(`/v1/channels/${channelId}/messages/bulk/${status}`, {
      method: "POST",
      body: JSON.stringify({ user_ids: [String(userId)] }),
    });
    setLog((l) => [`bulk/${status} → ${r.status}`, ...l].slice(0, 20));
    refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        Check 1 + 3 · Headless feed for user #{userId} (polls every 3s)
      </h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded bg-muted px-2 py-1">
          unread: <strong>{feed?.meta.unread_count ?? "…"}</strong>
        </span>
        <span className="rounded bg-muted px-2 py-1">
          unseen: <strong>{feed?.meta.unseen_count ?? "…"}</strong>
        </span>
        <span className="rounded bg-muted px-2 py-1">
          total: <strong>{feed?.meta.total_count ?? "…"}</strong>
        </span>
        <Button size="sm" variant="outline" onClick={refresh}>
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => markAll("seen")}>
          Mark all seen
        </Button>
        <Button size="sm" variant="outline" onClick={() => markAll("read")}>
          Mark all read
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Only <em>read</em> items are dimmed. Seen ≠ read in Knock.
      </p>

      <ul className="space-y-2">
        {feed?.entries.length === 0 && (
          <li className="text-sm text-muted-foreground">No items yet.</li>
        )}
        {feed?.entries.map((item) => (
          <li
            key={item.id}
            className={`rounded border p-2 text-sm ${item.read_at ? "opacity-50" : ""}`}
          >
            {/* Plain text only: template data (user names etc.) is untrusted,
                so never inject Knock's rendered HTML. DOMParser runs no scripts. */}
            <div>{toPlainText(item.blocks[0]?.rendered ?? "(no body)")}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.source.key} · {new Date(item.inserted_at).toLocaleTimeString()}{" "}
              · seen: {item.seen_at ? "yes" : "no"} · read:{" "}
              {item.read_at ? "yes" : "no"}
            </div>
            <div className="mt-1 flex gap-1">
              {["read", "unread", "seen", "unseen"].map((s) => (
                <Button
                  key={s}
                  size="xs"
                  variant="ghost"
                  onClick={() => mark([item.id], s)}
                >
                  mark {s}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <h3 className="text-sm font-semibold">Request log</h3>
      <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
        {log.join("\n") || "—"}
      </pre>
    </section>
  );
}
