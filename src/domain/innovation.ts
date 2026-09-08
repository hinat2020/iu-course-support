import type { ConflictCourse, ScheduledCourse } from "./coursePlanning";
import { detectTimetableConflicts } from "./coursePlanning";
import type { RegistrationConfirmationStatus } from "./lottery";
import type { RegistrationMethod, TimeSlot } from "./timetable";

export type SpecialLotteryApplicationStatus = "not_applied" | "applied";
export type SpecialLotteryResultStatus = "pending" | "won" | "lost";
export type InnovationCreditLabel = "a" | "b" | "completed";

export type InnovationLecturePreference = {
  classId: string;
  rank: number;
};

export type InnovationLectureState = {
  previousEarnedCount: 0 | 1 | 2;
  applicationStatus: SpecialLotteryApplicationStatus;
  preferences: InnovationLecturePreference[];
  resultStatus: SpecialLotteryResultStatus | null;
  wonClassId: string | null;
  registrationConfirmation: RegistrationConfirmationStatus;
};

export type InnovationMiniCourseStatus =
  | "planned"
  | "registered"
  | "passed"
  | "failed";

export type InnovationMiniCourseProgress = {
  academicYear: number;
  miniCourseId: string;
  status: InnovationMiniCourseStatus;
  alreadyUsedForCredit: "a" | "b" | null;
};

export type InnovationMethodState = {
  previousEarnedCount: 0 | 1 | 2;
  newLectureApplication: {
    applicationStatus: SpecialLotteryApplicationStatus;
    resultStatus: SpecialLotteryResultStatus | null;
    registrationConfirmation: RegistrationConfirmationStatus;
  };
  lectureModule: {
    miniCourses: InnovationMiniCourseProgress[];
  };
  eventModule: {
    eventId: string | null;
    estimatedHours?: number;
  };
};

export type SpecialLotterySchedule = {
  timezone: "Asia/Tokyo";
  applicationStartsAt: string;
  applicationDeadline: string;
  resultPublishedAt: string;
};

export type SpecialCourseCorrectionPeriod = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type InnovationLectureClass = {
  id: string;
  instructor: string;
  label: string;
  schedule: null;
};

export type InnovationMethodMiniCourse = {
  id: string;
  academicYear: 2026;
  semester: "second";
  name: string;
  instructor: string;
  slots: TimeSlot[];
  sessionCount: number;
  dates: string[] | null;
  scheduleNote?: string;
};

export type InnovationMethodEvent = {
  id: string;
  name: string;
};

export type SpecialCoursesData = {
  academicYear: 2026;
  semester: "second";
  specialLottery: {
    registrationMethod: Extract<RegistrationMethod, "special_lottery">;
    schedule: SpecialLotterySchedule;
    correctionPeriods: SpecialCourseCorrectionPeriod[];
  };
  innovationLecture: {
    courseIds: string[];
    registrationMethod: Extract<RegistrationMethod, "special_lottery">;
    classes: InnovationLectureClass[];
  };
  innovationMethod: {
    courseIds: string[];
    registrationMethod: Extract<RegistrationMethod, "special_lottery">;
    lecture: {
      newSecondSemesterAvailable: true;
      requiredPassedSessionCount: number;
      miniCourses: InnovationMethodMiniCourse[];
    };
    event: {
      newSecondSemesterAvailable: false;
      requiredEstimatedHours: number;
      events: InnovationMethodEvent[];
    };
  };
};

export type SpecialLotteryPhase =
  | "before_application"
  | "application_open"
  | "waiting_for_result"
  | "result_available";

export type InnovationMethodEnrollmentMode =
  | "continuation"
  | "new_second_semester"
  | "needs_confirmation";

export type InnovationMethodLectureProgress = {
  passedSessionCount: number;
  requiredSessionCount: number;
  remainingSessionCount: number;
  completed: boolean;
};

export function createInitialInnovationLectureState(): InnovationLectureState {
  return {
    previousEarnedCount: 0,
    applicationStatus: "not_applied",
    preferences: [],
    resultStatus: null,
    wonClassId: null,
    registrationConfirmation: "unconfirmed",
  };
}

export function createInitialInnovationMethodState(): InnovationMethodState {
  return {
    previousEarnedCount: 0,
    newLectureApplication: {
      applicationStatus: "not_applied",
      resultStatus: null,
      registrationConfirmation: "unconfirmed",
    },
    lectureModule: { miniCourses: [] },
    eventModule: { eventId: null },
  };
}

export function getInnovationCreditLabel(
  previouslyEarnedCount: number,
): InnovationCreditLabel {
  if (previouslyEarnedCount <= 0) return "a";
  if (previouslyEarnedCount === 1) return "b";
  return "completed";
}

export const getInnovationLectureCreditLabel = getInnovationCreditLabel;

export function normalizeInnovationLecturePreferences(
  preferences: readonly InnovationLecturePreference[],
): InnovationLecturePreference[] {
  const classIds = new Set<string>();
  const ranks = new Set<number>();

  return [...preferences]
    .filter((preference) => {
      if (!Number.isInteger(preference.rank) || preference.rank < 1) return false;
      if (classIds.has(preference.classId) || ranks.has(preference.rank)) {
        return false;
      }
      classIds.add(preference.classId);
      ranks.add(preference.rank);
      return true;
    })
    .sort((left, right) => left.rank - right.rank)
    .map((preference) => ({ ...preference }));
}

export function getInnovationMethodEnrollmentMode(
  registeredInFirstSemester: true | false | "unknown",
): InnovationMethodEnrollmentMode {
  if (registeredInFirstSemester === true) return "continuation";
  if (registeredInFirstSemester === false) return "new_second_semester";
  return "needs_confirmation";
}

export function canStartInnovationMethodModuleInSecondSemester(
  moduleType: "lecture" | "event",
): boolean {
  return moduleType === "lecture";
}

export function isInnovationMethodEventContinuation(
  registeredInFirstSemester: true | false | "unknown",
  moduleType: "lecture" | "event" | "unknown" | null,
): boolean {
  return registeredInFirstSemester === true && moduleType === "event";
}

export function calculateInnovationMethodLectureProgress({
  academicYear,
  targetCredit,
  records,
  miniCourses,
  requiredSessionCount,
}: {
  academicYear: number;
  targetCredit: Exclude<InnovationCreditLabel, "completed">;
  records: readonly InnovationMiniCourseProgress[];
  miniCourses: readonly InnovationMethodMiniCourse[];
  requiredSessionCount: number;
}): InnovationMethodLectureProgress {
  const courseById = new Map(
    miniCourses
      .filter((course) => course.academicYear === academicYear)
      .map((course) => [course.id, course]),
  );
  const passedSessionCount = records
    .filter(
      (record) =>
        record.academicYear === academicYear &&
        record.status === "passed" &&
        (record.alreadyUsedForCredit === null ||
          record.alreadyUsedForCredit === targetCredit),
    )
    .reduce(
      (total, record) =>
        total + (courseById.get(record.miniCourseId)?.sessionCount ?? 0),
      0,
    );

  return {
    passedSessionCount,
    requiredSessionCount,
    remainingSessionCount: Math.max(0, requiredSessionCount - passedSessionCount),
    completed: passedSessionCount >= requiredSessionCount,
  };
}

export function evaluateInnovationMiniCourseConflicts(
  miniCourse: InnovationMethodMiniCourse,
  existingCourses: readonly ScheduledCourse[],
): ConflictCourse[] {
  return detectTimetableConflicts(existingCourses, miniCourse.slots);
}

function toTimestamp(value: Date | string): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error("Invalid special lottery date: " + String(value));
  }
  return timestamp;
}

export function getSpecialLotteryPhase(
  now: Date | string,
  schedule: SpecialLotterySchedule,
): SpecialLotteryPhase {
  const current = toTimestamp(now);
  if (current < toTimestamp(schedule.applicationStartsAt)) return "before_application";
  if (current <= toTimestamp(schedule.applicationDeadline)) return "application_open";
  if (current < toTimestamp(schedule.resultPublishedAt)) return "waiting_for_result";
  return "result_available";
}

export function getSpecialLotteryPhaseLabel(
  phase: SpecialLotteryPhase,
): string {
  const labels: Record<SpecialLotteryPhase, string> = {
    before_application: "申込開始前",
    application_open: "特殊抽選申込期間中",
    waiting_for_result: "抽選結果待ち",
    result_available: "結果公開済み",
  };
  return labels[phase];
}
