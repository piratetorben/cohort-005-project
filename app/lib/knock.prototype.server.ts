// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?" (#19).
// Lives on the `prototype/knock-spike` branch only. Not production code:
// no error handling, no retries, no tests.
import { Knock, signUserToken } from "@knocklabs/node";
import { UserRole } from "~/db/schema";

export const PREFERENCE_SET = "default";
export const ENROLLMENT_CATEGORY = "enrollment";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`PROTOTYPE: missing ${name} in .env`);
  return value;
}

let client: Knock | null = null;
export function knock() {
  client ??= new Knock({ apiKey: env("KNOCK_SECRET_API_KEY") });
  return client;
}

export function publicConfig() {
  return {
    publicKey: env("KNOCK_PUBLIC_API_KEY"),
    feedChannelId: env("KNOCK_FEED_CHANNEL_ID"),
  };
}

// Check 1: RS256 user token for whichever user the DevUI selected.
export function signTokenFor(userId: number) {
  return signUserToken(String(userId), {
    signingKey: env("KNOCK_SIGNING_KEY"),
    expiresInSeconds: 60 * 60,
  });
}

type CadenceUser = { id: number; name: string; email: string; role: UserRole };

// Identify the user in Knock. Instructors get "new Enrollment" switched off
// in the in-app feed unless they already have an explicit choice — Cadence,
// not a Knock dashboard setting, owns the "off by default" rule (check 4).
export async function syncUser(user: CadenceUser) {
  const id = String(user.id);
  await knock().users.update(id, { name: user.name, email: user.email });
  if (user.role !== UserRole.Instructor) return;

  const existing = await knock()
    .users.getPreferences(id, PREFERENCE_SET)
    .catch(() => null);
  if (existing?.categories?.[ENROLLMENT_CATEGORY] !== undefined) return;

  await setEnrollmentOptIn(user.id, false);
}

export function setEnrollmentOptIn(userId: number, optedIn: boolean) {
  return knock().users.setPreferences(String(userId), PREFERENCE_SET, {
    // Without "merge" this call replaces the whole preference set.
    __persistence_strategy__: "merge",
    categories: {
      [ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: optedIn } },
    },
  });
}

export async function getPreferences(userId: number) {
  return knock()
    .users.getPreferences(String(userId), PREFERENCE_SET)
    .catch((err: unknown) => ({ error: String(err) }));
}

export async function trigger(
  workflow: "discussion-reply" | "new-enrollment",
  actorId: number,
  recipientId: number,
  data: Record<string, unknown>
) {
  try {
    const res = await knock().workflows.trigger(workflow, {
      actor: String(actorId),
      recipients: [String(recipientId)],
      data,
    });
    return { ok: true as const, workflow, recipientId, ...res };
  } catch (err) {
    return { ok: false as const, workflow, recipientId, error: String(err) };
  }
}
