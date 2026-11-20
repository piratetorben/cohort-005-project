import { useState, useEffect, useCallback } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { formatDuration } from "~/lib/utils";
import { Clock, Bookmark, BookmarkCheck, Github } from "lucide-react";
import type { Route } from "../routes/+types/courses.$slug.lessons.$lessonId";
import { YouTubePlayer } from "~/components/youtube-player";
import { CommentThread } from "~/components/comment-thread";
import { LessonNote } from "~/components/lesson-note";
import { CurriculumSidebar } from "~/components/lesson-curriculum-sidebar";
import { LessonBreadcrumb } from "~/components/lesson-breadcrumb";
import { QuizSection } from "~/components/lesson-quiz";
import { LessonCompletion } from "~/components/lesson-completion";
import { LessonPager } from "~/components/lesson-pager";

type FullLessonData = Extract<
  Route.ComponentProps["loaderData"],
  { view: "full" }
>;

const AUTOPLAY_KEY = "cadence-autoplay";

function useAutoplay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTOPLAY_KEY) === "true");
    } catch {
      /* silently fail */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTOPLAY_KEY, String(next));
      } catch {
        /* silently fail */
      }
      return next;
    });
  }, []);

  return [enabled, toggle] as const;
}

export function FullLesson({ data }: { data: FullLessonData }) {
  const { course, module: mod, lesson, enrolled, currentUserId } = data;
  const canTake = enrolled && currentUserId !== null;

  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={data.curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={data.lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">
          <LessonHeader data={data} />
          <LessonVideo data={data} />

          {/* Note — under the video, so the Student can write while they watch */}
          {currentUserId && <LessonNote key={lesson.id} note={data.note} />}

          <LessonContent
            contentHtml={data.contentHtml}
            hasVideo={!!lesson.videoUrl}
          />

          {data.quiz && canTake && <LessonQuiz data={data} quiz={data.quiz} />}

          {canTake && (
            <LessonCompletion
              courseSlug={course.slug}
              lessonId={lesson.id}
              lessonStatus={data.lessonStatus}
              nextLesson={data.nextLesson}
            />
          )}

          <LessonFooter data={data} />
        </div>
      </div>
    </div>
  );
}

function LessonFooter({ data }: { data: FullLessonData }) {
  return (
    <>
      {/* Questions & Discussion — confidential to people with access */}
      <CommentThread
        comments={data.comments}
        currentUserId={data.currentUserId}
        canModerate={data.canModerate}
        canPost
        instructorName={data.instructorName}
      />

      <LessonPager
        course={data.course}
        prevLesson={data.prevLesson}
        nextLesson={data.nextLesson}
      />
    </>
  );
}

function LessonHeader({ data }: { data: FullLessonData }) {
  const { lesson, currentUserId, bookmarked } = data;
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {currentUserId && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

function LessonVideo({ data }: { data: FullLessonData }) {
  const { lesson } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();
  if (!lesson.videoUrl) return null;
  return (
    <YouTubePlayer
      videoUrl={lesson.videoUrl}
      lessonId={lesson.id}
      title={lesson.title}
      startPosition={data.lastWatchPosition}
      durationMinutes={lesson.durationMinutes}
      watchProgress={data.watchProgress}
      trackingEnabled={data.enrolled && !!data.currentUserId}
      autoplay={autoplay}
      onToggleAutoplay={toggleAutoplay}
    />
  );
}

function LessonContent({
  contentHtml,
  hasVideo,
}: {
  contentHtml: string | null;
  hasVideo: boolean;
}) {
  if (contentHtml) {
    return (
      <div
        className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
        // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    );
  }
  if (hasVideo) return null;
  return (
    <Card className="mb-8">
      <CardContent className="py-12 text-center text-muted-foreground">
        No content has been added to this lesson yet.
      </CardContent>
    </Card>
  );
}

function LessonQuiz({
  data,
  quiz,
}: {
  data: FullLessonData;
  quiz: NonNullable<FullLessonData["quiz"]>;
}) {
  const quizFetcher = useFetcher({ key: `quiz-${data.lesson.id}` });
  return (
    <QuizSection
      quiz={quiz}
      bestAttempt={data.bestAttempt}
      quizResult={quizFetcher.data?.quizResult ?? null}
      quizFetcher={quizFetcher}
      isSubmitting={quizFetcher.state !== "idle"}
    />
  );
}

function BookmarkToggle({ bookmarked }: { bookmarked: boolean }) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const isSaving = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-bookmark" />
      <Button type="submit" variant="outline" size="sm" disabled={isSaving}>
        {bookmarked ? (
          <BookmarkCheck className="mr-1.5 size-4" />
        ) : (
          <Bookmark className="mr-1.5 size-4" />
        )}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    </fetcher.Form>
  );
}
