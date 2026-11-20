import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { describeNoteDraft, type NoteDraft } from "~/modules/lesson-notes";

// Laid out like the Questions & Discussion card further down the page, so
// the two read as one family: same heading, same form footer.
export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;
  const draft = describeNoteDraft(body, note?.body ?? null);

  return (
    <Card className="mb-8 py-0">
      <CardContent className="p-6">
        <NoteHeading />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="resize-y"
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !draft.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus
              error={error}
              draft={draft}
              updatedAt={note?.updatedAt ?? null}
            />
            <NoteCounter draft={draft} />
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteStatus({
  error,
  draft,
  updatedAt,
}: {
  error: string | undefined;
  draft: NoteDraft;
  updatedAt: string | null;
}) {
  if (error) return <span className="text-xs text-destructive">{error}</span>;
  // Save is disabled for an empty box, so say why rather than leave the
  // learner pressing a dead button after clearing a saved Note.
  if (draft.empty && updatedAt) {
    return (
      <span className="text-xs text-muted-foreground">
        A note can't be empty
      </span>
    );
  }
  if (draft.unsaved && updatedAt) {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (!updatedAt) return null;
  return (
    <span suppressHydrationWarning className="text-xs text-muted-foreground">
      Saved · last edited {formatRelativeTime(updatedAt)}
    </span>
  );
}

function NoteHeading() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteCounter({ draft }: { draft: NoteDraft }) {
  return (
    <span
      className={cn(
        "ml-auto text-xs",
        draft.tooLong ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {draft.length} / {draft.limit}
    </span>
  );
}
