import type { UserCourseRecord } from "../domain/user";
import type { AppState } from "../state/initialState";

type UnknownRecord = Record<string, unknown>;

export type LegacyLotteryApplication = {
  courseId: string;
  status: "candidate" | "not_applied" | "applied" | "won" | "lost";
  preferences: {
    offeringId: string;
    rank: number;
  }[];
  wonOfferingId: string | null;
  confirmedByUser: boolean;
};

export type LegacyInnovationLectureStateV3 = {
  lotteryStatus: "candidate" | "not_applied" | "applied" | "won" | "lost";
  preferences: {
    offeringId: string;
    scheduleOptionId?: string | null;
    rank: number;
  }[];
  wonClassId: string | null;
  previousEarnedCount: 0 | 1 | 2;
};

export type LegacyInnovationMethodStateV3 = {
  moduleType: "lecture" | "event" | null;
  enrollmentSource:
    | "continued_from_first_semester"
    | "new_second_semester"
    | null;
  lotteryStatus:
    | "candidate"
    | "not_applied"
    | "applied"
    | "won"
    | "lost"
    | null;
  targetCredit: "a" | "b" | null;
  lectureModule?: {
    miniCourses: {
      miniCourseId: string;
      status: "planned" | "registered" | "passed" | "failed";
      sessionCount: number;
    }[];
  };
  eventModule?: {
    eventId: string | null;
    estimatedHours?: number;
  };
};

export type AppStateV3 = Omit<
  AppState,
  "schemaVersion" | "innovationLecture" | "innovationMethod"
> & {
  schemaVersion: 3;
  innovationLecture: LegacyInnovationLectureStateV3;
  innovationMethod: LegacyInnovationMethodStateV3;
};

export type AppStateV2 = Omit<
  AppStateV3,
  "schemaVersion" | "lotteries"
> & {
  schemaVersion: 2;
  lotteries: Record<string, LegacyLotteryApplication>;
};

export type AppStateV1 = Omit<
  AppStateV2,
  "schemaVersion" | "firstSemester"
> & {
  schemaVersion: 1;
  firstSemester: {
    requiredCoursesConfirmed: boolean;
    courses: Record<string, UserCourseRecord>;
    innovationMethod: {
      registeredInFirstSemester: true | false | "unknown";
      moduleType: "lecture" | "event" | "unknown" | null;
    };
  };
};

const timetableModels = ["A", "B", "C", "D", "E"] as const;
const englishTracks = ["normal", "advanced"] as const;
const previousStatuses = ["earned", "failed", "not_taken", "unknown"] as const;
const legacyLotteryStatuses = [
  "candidate",
  "not_applied",
  "applied",
  "won",
  "lost",
] as const;
const lotteryApplicationStatuses = ["not_applied", "applied"] as const;
const lotteryResultStatuses = ["pending", "won", "lost"] as const;
const registrationConfirmationStatuses = [
  "unconfirmed",
  "confirmed",
] as const;
const miniCourseStatuses = [
  "planned",
  "registered",
  "passed",
  "failed",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly unknown[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return values.includes(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isLegacyLotteryPreference(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.offeringId === "string" &&
    Number.isInteger(value.rank) &&
    (value.rank as number) > 0
  );
}

function isLotteryPreference(value: unknown): boolean {
  return (
    isLegacyLotteryPreference(value) &&
    isRecord(value) &&
    (value.scheduleOptionId === undefined ||
      isNullableString(value.scheduleOptionId))
  );
}

function isLotteryPreferences(
  value: unknown,
  version: "legacy" | "current",
): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      version === "legacy"
        ? isLegacyLotteryPreference
        : isLotteryPreference,
    )
  );
}

function isUser(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    value.academicYear === 2026 &&
    value.admissionYear === 2026 &&
    value.grade === 1 &&
    value.semester === "second" &&
    (value.timetableModel === null ||
      isOneOf(value.timetableModel, timetableModels)) &&
    (value.englishTrack === null || isOneOf(value.englishTrack, englishTracks)) &&
    (value.normalEnglishSection === undefined ||
      isNullableString(value.normalEnglishSection))
  );
}

function isFirstSemester(value: unknown, version: 1 | 2 | 3 | 4): boolean {
  if (
    !isRecord(value) ||
    typeof value.requiredCoursesConfirmed !== "boolean" ||
    !isRecord(value.courses) ||
    !isRecord(value.innovationMethod)
  ) {
    return false;
  }

  const coursesAreValid = Object.entries(value.courses).every(
    ([courseId, record]) =>
      isRecord(record) &&
      record.courseId === courseId &&
      isOneOf(record.status, previousStatuses) &&
      typeof record.confirmedByUser === "boolean",
  );
  const registrationValue = value.innovationMethod.registeredInFirstSemester;
  const moduleType = value.innovationMethod.moduleType;
  const confirmationIsValid =
    version === 1 || typeof value.innovationMethod.confirmedByUser === "boolean";

  return (
    coursesAreValid &&
    (registrationValue === true ||
      registrationValue === false ||
      registrationValue === "unknown") &&
    (moduleType === "lecture" ||
      moduleType === "event" ||
      moduleType === "unknown" ||
      moduleType === null) &&
    confirmationIsValid
  );
}

function isPlannedCourses(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (course) => isRecord(course) && typeof course.selected === "boolean",
    )
  );
}

function isLegacyLotteries(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([courseId, application]) =>
        isRecord(application) &&
        application.courseId === courseId &&
        isOneOf(application.status, legacyLotteryStatuses) &&
        isLotteryPreferences(application.preferences, "legacy") &&
        isNullableString(application.wonOfferingId) &&
        typeof application.confirmedByUser === "boolean",
    )
  );
}

function isLotteries(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([courseId, application]) =>
        isRecord(application) &&
        application.courseId === courseId &&
        isOneOf(
          application.applicationStatus,
          lotteryApplicationStatuses,
        ) &&
        isLotteryPreferences(application.preferences, "current") &&
        (application.resultStatus === null ||
          isOneOf(application.resultStatus, lotteryResultStatuses)) &&
        isNullableString(application.wonOfferingId) &&
        isNullableString(application.wonScheduleOptionId) &&
        isOneOf(
          application.registrationConfirmation,
          registrationConfirmationStatuses,
        ),
    )
  );
}

function isLegacyInnovationLecture(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOneOf(value.lotteryStatus, legacyLotteryStatuses) &&
    isLotteryPreferences(value.preferences, "current") &&
    isNullableString(value.wonClassId) &&
    (value.previousEarnedCount === 0 ||
      value.previousEarnedCount === 1 ||
      value.previousEarnedCount === 2)
  );
}

function isInnovationLecturePreference(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.classId === "string" &&
    Number.isInteger(value.rank) &&
    (value.rank as number) > 0
  );
}

function isInnovationLecture(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.previousEarnedCount === 0 ||
      value.previousEarnedCount === 1 ||
      value.previousEarnedCount === 2) &&
    isOneOf(value.applicationStatus, lotteryApplicationStatuses) &&
    Array.isArray(value.preferences) &&
    value.preferences.every(isInnovationLecturePreference) &&
    (value.resultStatus === null ||
      isOneOf(value.resultStatus, lotteryResultStatuses)) &&
    isNullableString(value.wonClassId) &&
    isOneOf(
      value.registrationConfirmation,
      registrationConfirmationStatuses,
    )
  );
}

function isLegacyLectureModule(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !Array.isArray(value.miniCourses)) return false;

  return value.miniCourses.every(
    (course) =>
      isRecord(course) &&
      typeof course.miniCourseId === "string" &&
      isOneOf(course.status, miniCourseStatuses) &&
      Number.isInteger(course.sessionCount) &&
      (course.sessionCount as number) > 0,
  );
}

function isLegacyEventModule(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !isNullableString(value.eventId)) return false;

  return (
    value.estimatedHours === undefined ||
    (typeof value.estimatedHours === "number" && value.estimatedHours >= 0)
  );
}

function isLegacyInnovationMethod(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    (value.moduleType === "lecture" ||
      value.moduleType === "event" ||
      value.moduleType === null) &&
    (value.enrollmentSource === "continued_from_first_semester" ||
      value.enrollmentSource === "new_second_semester" ||
      value.enrollmentSource === null) &&
    (value.lotteryStatus === null ||
      isOneOf(value.lotteryStatus, legacyLotteryStatuses)) &&
    (value.targetCredit === "a" ||
      value.targetCredit === "b" ||
      value.targetCredit === null) &&
    isLegacyLectureModule(value.lectureModule) &&
    isLegacyEventModule(value.eventModule)
  );
}

function isInnovationMiniCourseProgress(value: unknown): boolean {
  return (
    isRecord(value) &&
    Number.isInteger(value.academicYear) &&
    (value.academicYear as number) > 0 &&
    typeof value.miniCourseId === "string" &&
    isOneOf(value.status, miniCourseStatuses) &&
    (value.alreadyUsedForCredit === "a" ||
      value.alreadyUsedForCredit === "b" ||
      value.alreadyUsedForCredit === null)
  );
}

function isInnovationMethod(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isRecord(value.newLectureApplication) ||
    !isRecord(value.lectureModule) ||
    !isRecord(value.eventModule)
  ) {
    return false;
  }

  const application = value.newLectureApplication;
  return (
    (value.previousEarnedCount === 0 ||
      value.previousEarnedCount === 1 ||
      value.previousEarnedCount === 2) &&
    isOneOf(application.applicationStatus, lotteryApplicationStatuses) &&
    (application.resultStatus === null ||
      isOneOf(application.resultStatus, lotteryResultStatuses)) &&
    isOneOf(
      application.registrationConfirmation,
      registrationConfirmationStatuses,
    ) &&
    Array.isArray(value.lectureModule.miniCourses) &&
    value.lectureModule.miniCourses.every(isInnovationMiniCourseProgress) &&
    isNullableString(value.eventModule.eventId) &&
    (value.eventModule.estimatedHours === undefined ||
      (typeof value.eventModule.estimatedHours === "number" &&
        Number.isFinite(value.eventModule.estimatedHours) &&
        value.eventModule.estimatedHours >= 0))
  );
}

function isUi(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.lastVisitedPage === undefined ||
      typeof value.lastVisitedPage === "string")
  );
}

function hasValidAppStateBody(
  value: UnknownRecord,
  lotteryVersion: "legacy" | "current",
  innovationVersion: "legacy" | "current",
): boolean {
  return (
    typeof value.setupCompleted === "boolean" &&
    isUser(value.user) &&
    isPlannedCourses(value.plannedCourses) &&
    (lotteryVersion === "legacy"
      ? isLegacyLotteries(value.lotteries)
      : isLotteries(value.lotteries)) &&
    (innovationVersion === "legacy"
      ? isLegacyInnovationLecture(value.innovationLecture) &&
        isLegacyInnovationMethod(value.innovationMethod)
      : isInnovationLecture(value.innovationLecture) &&
        isInnovationMethod(value.innovationMethod)) &&
    isUi(value.ui)
  );
}

export function isAppState(value: unknown): value is AppState {
  return (
    isRecord(value) &&
    value.schemaVersion === 4 &&
    isFirstSemester(value.firstSemester, 4) &&
    hasValidAppStateBody(value, "current", "current")
  );
}

export function isAppStateV3(value: unknown): value is AppStateV3 {
  return (
    isRecord(value) &&
    value.schemaVersion === 3 &&
    isFirstSemester(value.firstSemester, 3) &&
    hasValidAppStateBody(value, "current", "legacy")
  );
}

export function isAppStateV2(value: unknown): value is AppStateV2 {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    isFirstSemester(value.firstSemester, 2) &&
    hasValidAppStateBody(value, "legacy", "legacy")
  );
}

export function isAppStateV1(value: unknown): value is AppStateV1 {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    isFirstSemester(value.firstSemester, 1) &&
    hasValidAppStateBody(value, "legacy", "legacy")
  );
}
