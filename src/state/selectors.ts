import type { Course } from "../domain/course";
import type { LotteryApplication } from "../domain/lottery";
import type { UserCourseRecord } from "../domain/user";
import type { AppState } from "./initialState";

export type FirstSemesterStatusCounts = {
  earned: number;
  failed: number;
  notTaken: number;
  unknown: number;
};

export type InnovationMethodSetupSummary = {
  isComplete: boolean;
  registrationLabel: string;
  moduleLabel: string;
};

export function selectSelectedCourseIds(state: AppState): string[] {
  return Object.entries(state.plannedCourses)
    .filter(([, value]) => value.selected)
    .map(([courseId]) => courseId);
}

export function selectPlannedCredits(
  state: AppState,
  courses: readonly Course[],
): number {
  const selectedIds = new Set(selectSelectedCourseIds(state));
  return courses.reduce(
    (total, course) => total + (selectedIds.has(course.id) ? course.credits : 0),
    0,
  );
}

export function selectPreviousCourse(
  state: AppState,
  courseId: string,
): UserCourseRecord | undefined {
  return state.firstSemester.courses[courseId];
}

export function selectLottery(
  state: AppState,
  courseId: string,
): LotteryApplication | undefined {
  return state.lotteries[courseId];
}

export function selectFirstSemesterStatusCounts(
  state: AppState,
  courseIds: readonly string[],
): FirstSemesterStatusCounts {
  return courseIds.reduce<FirstSemesterStatusCounts>(
    (counts, courseId) => {
      const status = state.firstSemester.courses[courseId]?.status ?? "unknown";

      if (status === "not_taken") counts.notTaken += 1;
      else counts[status] += 1;

      return counts;
    },
    { earned: 0, failed: 0, notTaken: 0, unknown: 0 },
  );
}

export function selectIsBasicSetupComplete(state: AppState): boolean {
  return (
    state.user.timetableModel !== null && state.user.englishTrack !== null
  );
}

export function selectAreFirstSemesterCoursesComplete(
  state: AppState,
  courseIds: readonly string[],
): boolean {
  return courseIds.every(
    (courseId) =>
      state.firstSemester.courses[courseId]?.confirmedByUser === true,
  );
}

export function selectIsFirstSemesterRequiredComplete(
  state: AppState,
  requiredCourseIds: readonly string[],
): boolean {
  return selectAreFirstSemesterCoursesComplete(state, requiredCourseIds);
}

export function selectInnovationMethodSetupSummary(
  state: AppState,
): InnovationMethodSetupSummary {
  const value = state.firstSemester.innovationMethod;
  const registrationLabel = !value.confirmedByUser
    ? "未回答"
    : value.registeredInFirstSemester === true
      ? "前期履修あり"
      : value.registeredInFirstSemester === false
        ? "前期履修なし"
        : "不明";
  const moduleLabel = !value.confirmedByUser
    ? "未回答"
    : value.registeredInFirstSemester !== true
      ? value.registeredInFirstSemester === false
        ? "該当なし"
        : "不明"
      : value.moduleType === "lecture"
        ? "講座系"
        : value.moduleType === "event"
          ? "イベント系"
          : value.moduleType === "unknown"
            ? "不明"
            : "未回答";

  return {
    isComplete:
      value.confirmedByUser &&
      (value.registeredInFirstSemester !== true || value.moduleType !== null),
    registrationLabel,
    moduleLabel,
  };
}
