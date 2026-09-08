import {
  candidateCourses,
  candidateOfferings,
  graduationRequirements,
} from "../data/2026/coursePlanning";
import { courseCatalog } from "../data/2026/requiredTimetable";
import type { Course } from "../domain/course";
import { resolveCandidateOffering } from "../domain/coursePlanning";
import { getLotteryStatusLabel } from "../domain/lottery";
import type { CourseOffering, RegistrationMethod, TimeSlot } from "../domain/timetable";
import type { AppState } from "./initialState";
import { selectDashboardSummary } from "./dashboardSelectors";

export type CourseDetail = {
  course: Course;
  offering: CourseOffering | null;
  requirementLabels: string[];
  slots: TimeSlot[];
  registrationMethod: RegistrationMethod | null;
  currentStatus: string;
  lotteryStatus: string | null;
  warnings: string[];
  cap: { creditsAfterAdding: number | null; limit: number } | null;
  syllabus: null;
};

const previousStatusLabels = {
  earned: "前期・修得済み",
  failed: "前期・履修したが未修得",
  not_taken: "前期・未履修",
  unknown: "前期・未確認",
} as const;

export function selectCourseDetail(state: AppState, courseId: string): CourseDetail | null {
  const course = courseCatalog.find((item) => item.id === courseId);
  if (!course) return null;

  const summary = selectDashboardSummary(state);
  const model = state.user.timetableModel;
  const track = state.user.englishTrack;
  let offering: CourseOffering | null = null;

  if (model && track) {
    offering = summary.requiredTimetable?.courses.find(({ course: requiredCourse }) => requiredCourse.id === courseId)?.offering ?? null;
    if (!offering && candidateCourses.some((candidate) => candidate.id === courseId)) {
      offering = resolveCandidateOffering({
        courseId,
        timetableModel: model,
        academicYear: state.user.academicYear,
        semester: state.user.semester,
        offerings: candidateOfferings,
      });
    }
  }

  const previousRecord = state.firstSemester.courses[courseId];
  const isCandidate = candidateCourses.some((candidate) => candidate.id === courseId);
  const selected = state.plannedCourses[courseId]?.selected === true;
  const lotteryStatus = isCandidate && selected
    ? getLotteryStatusLabel(state.lotteries[courseId])
    : null;
  let currentStatus = "未設定";
  if (previousRecord) currentStatus = previousStatusLabels[previousRecord.status];
  else if (isCandidate) currentStatus = selected ? "履修候補として検討中" : "履修候補に未追加";
  else if (course.specialCourseType === "innovation_lecture") currentStatus = summary.special.lecture;
  else if (course.specialCourseType === "innovation_method") currentStatus = summary.special.method;
  else if (summary.requiredTimetable?.courses.some(({ course: item }) => item.id === courseId)) currentStatus = "後期必修";

  const requirementLabels = course.requirementGroups.map((groupId) => {
    const requirement = graduationRequirements.requirements.find((item) => item.id === groupId);
    return requirement ? `${requirement.symbol} ${requirement.label}` : groupId;
  });
  const candidateDecision = summary.candidateDecisions[courseId];
  const warnings = [...(candidateDecision?.warnings ?? [])];
  if (offering?.scheduleExceptions?.length) warnings.push("特殊日程があります。詳細は必修時間割で確認してください。");
  if (course.id.includes("english") && course.semester === "second") warnings.push("実際のクラス詳細はUNIPAで確認してください。");

  const cap = isCandidate && summary.cap
    ? {
        creditsAfterAdding:
          summary.cap.maximumAnnualCredits === null
            ? null
            : selected
              ? summary.cap.maximumAnnualCredits
              : summary.cap.maximumAnnualCredits + course.credits,
        limit: summary.cap.limit,
      }
    : null;

  return {
    course,
    offering,
    requirementLabels,
    slots: offering?.slots ?? [],
    registrationMethod: offering?.registrationMethod ?? (course.specialCourseType ? "special_lottery" : null),
    currentStatus,
    lotteryStatus,
    warnings,
    cap,
    syllabus: null,
  };
}
