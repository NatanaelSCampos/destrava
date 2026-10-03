import type { StudyEvent } from "@/domain/study/study-state";

export function projectStudyEvents(
  events: StudyEvent[],
  userId: string,
  courseId: string,
  activityIds: ReadonlySet<string>,
) {
  return events.map((item) => {
    const knownActivity = Boolean(item.activityId && activityIds.has(item.activityId));
    return {
      id: item.id,
      user_id: userId,
      course_id: courseId,
      event_type: item.type,
      activity_id: knownActivity ? item.activityId : null,
      metadata: {
        ...item.metadata,
        ...(item.itemId ? { itemId: item.itemId } : {}),
        ...(item.activityId && !knownActivity ? { unresolvedActivityId: item.activityId } : {}),
      },
      created_at: item.createdAt,
    };
  });
}
