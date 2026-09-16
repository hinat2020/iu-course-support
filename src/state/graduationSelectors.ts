import {
  curriculumCourses,
  curriculumCoursesById,
  plannableCurriculumCourses,
} from "../data/2026/curriculum";
import { candidateCourses } from "../data/2026/coursePlanning";
import { registrationRules } from "../data/2026/coursePlanning";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { officialGraduationRequirements } from "../data/2026/graduationRequirements";
import { courseCatalog } from "../data/2026/requiredTimetable";
import { getInnovationMethodEnrollmentMode } from "../domain/innovation";
import {
  calculateGraduationCapPlan,
  type GraduationSemesterCapInput,
  type GraduationYearCapResult,
} from "../domain/graduationCap";
import {
  checkCoursePrerequisites,
  checkGraduationPlanPrerequisites,
  type PrerequisiteCheckResult,
} from "../domain/graduationPrerequisites";
import {
  getGraduationCreditSummary,
  getSemesterPlannedCredits,
  graduationSemesters,
  type CurriculumRequirementSymbol,
  type CurriculumRequirementType,
  type CurriculumSemester,
  type GraduationBoardCourse,
  type GraduationCreditSummary,
  type GraduationSemesterId,
  type GraduationSemesterBoard,
} from "../domain/graduationPlanning";
import {
  calculateGraduationRequirementProgress,
  getGraduationRequirementShortfalls,
  type GraduationRequirementPlacement,
} from "../domain/graduationRequirements";
import { calculateGraduationPlanChecks } from "../domain/graduationPlanChecks";
import {
  getCandidateConstraintSummary,
  getCandidatesForRequirement,
  previewCandidatePlacement,
  type CandidatePlacementPreview,
  type GraduationCandidateFilters,
} from "../domain/graduationCandidates";
import type { AppState } from "./initialState";

export type CurriculumFilters = {
  query?: string;
  year?: number | null;
  semester?: CurriculumSemester | null;
  requirementGroup?: CurriculumRequirementSymbol | null;
  requirementType?: CurriculumRequirementType | null;
};

export type GraduationCandidateStatus =
  | "considering"
  | "applied"
  | "pending"
  | "lost"
  | "won_unconfirmed"
  | "won_confirmed"
  | "needs_confirmation";

export type GraduationCandidateSituation = {
  courseId: string;
  name: string;
  status: GraduationCandidateStatus;
};

export function selectGraduationCandidateSituations(
  state: AppState,
): GraduationCandidateSituation[] {
  return candidateCourses.flatMap((masterCourse) => {
    const selected = state.plannedCourses[masterCourse.id]?.selected === true;
    const lottery = state.lotteries[masterCourse.id];
    if (!selected && lottery?.applicationStatus !== "applied") return [];

    let status: GraduationCandidateStatus = "considering";
    if (lottery?.applicationStatus === "applied") {
      switch (lottery.resultStatus) {
        case "won":
          status = lottery.registrationConfirmation === "confirmed"
            ? "won_confirmed"
            : "won_unconfirmed";
          break;
        case "lost":
          status = "lost";
          break;
        case "pending":
          status = "pending";
          break;
        default:
          status = "applied";
      }
    } else if (lottery?.resultStatus === "won" || lottery?.resultStatus === "lost") {
      status = "needs_confirmation";
    }
    return [{ courseId: masterCourse.id, name: masterCourse.name, status }];
  });
}

const statusPriority = { earned: 3, in_progress: 2, planned: 1 } as const;

function addCourse(
  entries: Map<string, GraduationBoardCourse>,
  entry: GraduationBoardCourse,
) {
  const current = entries.get(entry.course.courseId);
  if (!current || statusPriority[entry.status] > statusPriority[current.status]) {
    entries.set(entry.course.courseId, entry);
  }
}

export function selectGraduationBoard(
  state: AppState,
): GraduationSemesterBoard[] {
  const entries = new Map<string, GraduationBoardCourse>();

  for (const record of Object.values(state.firstSemester.courses)) {
    if (record.status !== "earned") continue;
    const course = curriculumCoursesById.get(record.courseId);
    if (!course || course.planningAvailability !== "standard") continue;
    addCourse(entries, {
      course,
      semesterId: "year1-spring",
      status: "earned",
      source: "first_semester",
      editable: false,
    });
  }

  if (state.user.timetableModel && state.user.englishTrack) {
    for (const masterCourse of courseCatalog) {
      if (
        masterCourse.grade !== 1 ||
        masterCourse.semester !== "second" ||
        masterCourse.requirementType !== "required" ||
        masterCourse.specialCourseType
      ) {
        continue;
      }
      const course = curriculumCoursesById.get(masterCourse.id);
      if (!course) continue;
      addCourse(entries, {
        course,
        semesterId: "year1-fall",
        // 必修対象であることは分かっても、UNIPA上の履修確認までは
        // AppStateにないため「履修中」へ昇格させない。
        status: "planned",
        source: "current_registration",
        editable: false,
      });
    }
  }

  for (const situation of selectGraduationCandidateSituations(state)) {
    if (situation.status !== "won_confirmed") continue;
    const course = curriculumCoursesById.get(situation.courseId);
    if (!course || course.planningAvailability !== "standard") continue;
    addCourse(entries, {
      course,
      semesterId: "year1-fall",
      // UNIPA登録確認済みでも、履修中・修得済みとは断定しない。
      status: "planned",
      source: "current_registration",
      registrationEvidence: "unipa_confirmed",
      editable: false,
    });
  }

  for (const planEntry of state.graduationPlan.entries) {
    const course = curriculumCoursesById.get(planEntry.courseId);
    if (!course || course.planningAvailability !== "standard") continue;
    addCourse(entries, {
      course,
      semesterId: planEntry.semesterId,
      status: "planned",
      source: "graduation_plan",
      editable: true,
    });
  }

  return graduationSemesters.map((semester) => {
    const courses = [...entries.values()]
      .filter((entry) => entry.semesterId === semester.id)
      .sort((a, b) => a.course.name.localeCompare(b.course.name, "ja"));
    return {
      id: semester.id,
      label: semester.label,
      courses,
      credits: getSemesterPlannedCredits(courses),
    };
  });
}

export function selectGraduationCreditSummary(
  state: AppState,
): GraduationCreditSummary {
  return getGraduationCreditSummary(selectGraduationBoard(state));
}

const firstSemesterCapCourses = [
  ...firstSemesterRequiredCourses,
  ...firstSemesterElectiveCourses,
];

function selectFirstSemesterCapInput(state: AppState): GraduationSemesterCapInput {
  let creditsKnown = true;
  const courses = firstSemesterCapCourses.flatMap((course) => {
    const record = state.firstSemester.courses[course.id];
    if (!record || !record.confirmedByUser || record.status === "unknown") {
      creditsKnown = false;
      return [];
    }
    return record.status === "earned" || record.status === "failed"
      ? [{ courseId: course.id, credits: course.credits }]
      : [];
  });
  return { semesterId: "year1-spring", courses, creditsKnown };
}

export function selectGraduationCapPlan(
  state: AppState,
): GraduationYearCapResult[] {
  const board = selectGraduationBoard(state);
  const semesterInputs = new Map<GraduationSemesterId, GraduationSemesterCapInput>(
    graduationSemesters.map((semester) => [
      semester.id,
      { semesterId: semester.id, courses: [], creditsKnown: true },
    ]),
  );
  semesterInputs.set("year1-spring", selectFirstSemesterCapInput(state));

  const fallConfigured = Boolean(
    state.user.timetableModel && state.user.englishTrack,
  );
  const firstFall = semesterInputs.get("year1-fall");
  if (firstFall) firstFall.creditsKnown = fallConfigured;

  for (const semester of board) {
    const input = semesterInputs.get(semester.id);
    if (!input) continue;
    const additions = semester.courses
      .filter((entry) =>
        entry.source === "graduation_plan" ||
        entry.source === "current_registration"
      )
      .map((entry) => ({
        courseId: entry.course.courseId,
        credits: entry.course.credits,
      }));
    input.courses = [...input.courses, ...additions];
  }

  return calculateGraduationCapPlan({
    semesters: [...semesterInputs.values()],
    rules: registrationRules.capRules,
  });
}

export function selectProspectiveGraduationCap(
  state: AppState,
  courseId: string,
  semesterId: GraduationSemesterId,
): GraduationYearCapResult | null {
  const semester = graduationSemesters.find((item) => item.id === semesterId);
  if (!semester || !curriculumCoursesById.has(courseId)) return null;
  const previewState: AppState = {
    ...state,
    graduationPlan: {
      entries: [
        ...state.graduationPlan.entries.filter((entry) => entry.courseId !== courseId),
        { courseId, semesterId },
      ],
    },
  };
  return selectGraduationCapPlan(previewState).find(
    (result) => result.grade === semester.year,
  ) ?? null;
}

function flattenGraduationBoard(state: AppState) {
  return selectGraduationBoard(state).flatMap((semester) => semester.courses);
}

export function selectGraduationPrerequisiteChecks(
  state: AppState,
): ReadonlyMap<string, PrerequisiteCheckResult> {
  return new Map(
    checkGraduationPlanPrerequisites({
      courses: curriculumCourses,
      placements: flattenGraduationBoard(state),
    }).map((result) => [result.courseId, result]),
  );
}

export function selectProspectivePrerequisiteCheck(
  state: AppState,
  courseId: string,
  semesterId: GraduationSemesterId,
): PrerequisiteCheckResult | null {
  const course = curriculumCoursesById.get(courseId);
  if (!course) return null;
  return checkCoursePrerequisites({
    course,
    semesterId,
    placements: flattenGraduationBoard(state),
    coursesById: curriculumCoursesById,
  });
}

export function selectGraduationRequirementSummary(state: AppState) {
  const entries = selectGraduationBoard(state).flatMap((semester) => semester.courses);
  return officialGraduationRequirements.requirements.map(({ symbol }) => ({
    symbol: symbol as CurriculumRequirementSymbol,
    earnedCredits: entries
      .filter((entry) => entry.status === "earned" && entry.course.requirementGroups.includes(symbol as CurriculumRequirementSymbol))
      .reduce((sum, entry) => sum + entry.course.credits, 0),
    planIncludingCurrentCredits: entries
      .filter((entry) => entry.course.requirementGroups.includes(symbol as CurriculumRequirementSymbol))
      .reduce((sum, entry) => sum + entry.course.credits, 0),
  }));
}

export function selectGraduationRequirementProgress(state: AppState) {
  const placements = selectGraduationRequirementPlacements(state);
  const hasUnknownFirstSemesterStatus = firstSemesterCapCourses.some((course) => {
    const record = state.firstSemester.courses[course.id];
    return !record || !record.confirmedByUser || record.status === "unknown";
  });

  return calculateGraduationRequirementProgress({
    curriculum: curriculumCourses,
    placements,
    requirements: officialGraduationRequirements,
    hasUnknownFirstSemesterStatus,
  });
}

export function selectGraduationRequirementPlacements(
  state: AppState,
): GraduationRequirementPlacement[] {
  return selectGraduationBoard(state)
    .flatMap((semester) => semester.courses)
    .map((entry) => ({
      courseId: entry.course.courseId,
      layer: entry.status === "earned"
        ? "earned"
        : entry.source === "current_registration"
          ? "current"
          : "planned",
    }));
}

export function selectGraduationRequirementShortfalls(state: AppState) {
  return getGraduationRequirementShortfalls(
    selectGraduationRequirementProgress(state),
  );
}

function hasSpecialCourseUncertainty(state: AppState): boolean {
  const lecture = state.innovationLecture;
  const method = state.innovationMethod;
  return (
    state.firstSemester.innovationMethod.registeredInFirstSemester !== false ||
    lecture.previousEarnedCount > 0 ||
    lecture.applicationStatus === "applied" ||
    lecture.resultStatus !== null ||
    lecture.preferences.length > 0 ||
    method.previousEarnedCount > 0 ||
    method.newLectureApplication.applicationStatus === "applied" ||
    method.newLectureApplication.resultStatus !== null ||
    method.lectureModule.miniCourses.length > 0 ||
    method.eventModule.eventId !== null ||
    method.eventModule.estimatedHours !== undefined
  );
}

export function selectGraduationPlanChecks(state: AppState) {
  const placements = flattenGraduationBoard(state);
  return calculateGraduationPlanChecks({
    requirementProgress: selectGraduationRequirementProgress(state),
    capResults: selectGraduationCapPlan(state),
    prerequisiteChecks: selectGraduationPrerequisiteChecks(state),
    placements,
    hasSpecialCourseUncertainty: hasSpecialCourseUncertainty(state),
  });
}

export function selectSupersededGraduationPlanEntries(state: AppState) {
  const shown = new Map(
    selectGraduationBoard(state).flatMap((semester) =>
      semester.courses.map((entry) => [entry.course.courseId, entry] as const),
    ),
  );
  return state.graduationPlan.entries.flatMap((entry) => {
    const current = shown.get(entry.courseId);
    return current && current.source !== "graduation_plan"
      ? [{ courseId: entry.courseId, name: current.course.name, source: current.source }]
      : [];
  });
}

export function selectGraduationSpecialSummary(state: AppState) {
  const lectureState = state.innovationLecture;
  const lecture = lectureState.resultStatus === "won"
    ? lectureState.registrationConfirmation === "confirmed"
      ? "当選・UNIPA確認済み"
      : "当選・UNIPA未確認"
    : lectureState.resultStatus === "lost"
      ? "落選・今学期対象外"
      : lectureState.applicationStatus === "applied"
        ? "応募済み・結果を確認"
        : "未申込";
  const mode = getInnovationMethodEnrollmentMode(
    state.firstSemester.innovationMethod.registeredInFirstSemester,
  );
  const methodApplication = state.innovationMethod.newLectureApplication;
  const method = mode === "continuation"
    ? "前期から継続（後期自動登録）"
    : mode === "needs_confirmation"
      ? "前期登録状況を確認"
      : methodApplication.resultStatus === "won"
        ? methodApplication.registrationConfirmation === "confirmed"
          ? "講座系の当選・UNIPA確認済み"
          : "講座系の当選・UNIPA未確認"
        : methodApplication.resultStatus === "lost"
          ? "講座系の抽選に落選"
          : methodApplication.applicationStatus === "applied"
            ? "講座系へ応募済み・結果を確認"
            : "講座系の新規申込状況を確認";
  return { lecture, method, includedInCredits: false as const };
}

export function selectOccupiedGraduationCourseIds(
  state: AppState,
): ReadonlySet<string> {
  return new Set(
    selectGraduationBoard(state).flatMap((semester) =>
      semester.courses.map((entry) => entry.course.courseId),
    ),
  );
}

export function selectUnplacedCurriculumCourses(
  state: AppState,
  filters: CurriculumFilters = {},
) {
  const occupied = selectOccupiedGraduationCourseIds(state);
  const query = filters.query?.trim().toLocaleLowerCase("ja") ?? "";

  return plannableCurriculumCourses.filter((course) => {
    if (occupied.has(course.courseId)) return false;
    if (query && !course.name.toLocaleLowerCase("ja").includes(query)) {
      return false;
    }
    if (filters.year && !course.recommendedYears.includes(filters.year)) {
      return false;
    }
    if (
      filters.semester &&
      !course.availableSemesters.includes(filters.semester)
    ) {
      return false;
    }
    if (
      filters.requirementGroup &&
      !course.requirementGroups.includes(filters.requirementGroup)
    ) {
      return false;
    }
    if (
      filters.requirementType &&
      course.requirementType !== filters.requirementType
    ) {
      return false;
    }
    return true;
  });
}

export function selectGraduationCandidatesForRequirement(
  state: AppState,
  requirementId: string,
  filters: GraduationCandidateFilters = {},
) {
  return getCandidatesForRequirement({
    curriculum: curriculumCourses,
    placements: selectGraduationRequirementPlacements(state),
    progress: selectGraduationRequirementProgress(state),
    requirements: officialGraduationRequirements,
    requirementId,
    filters,
  });
}

export function selectGraduationCandidatePreview(
  state: AppState,
  courseId: string,
  semesterId: GraduationSemesterId,
): CandidatePlacementPreview | null {
  const course = curriculumCoursesById.get(courseId);
  const semester = graduationSemesters.find((item) => item.id === semesterId);
  if (!course || !semester || course.planningAvailability !== "standard") {
    return null;
  }
  const prerequisiteResult = selectProspectivePrerequisiteCheck(
    state,
    courseId,
    semesterId,
  );
  if (!prerequisiteResult) return null;
  const capBefore = selectGraduationCapPlan(state).find(
    (result) => result.grade === semester.year,
  ) ?? null;
  const capAfter = selectProspectiveGraduationCap(state, courseId, semesterId);
  return previewCandidatePlacement({
    course,
    semesterId,
    prerequisiteResult,
    capBefore,
    capAfter,
  });
}

export function selectGraduationCandidateConstraintSummary(
  state: AppState,
  courseIds: readonly string[],
  semesterId: GraduationSemesterId,
) {
  const previews = courseIds.flatMap((courseId) => {
    const preview = selectGraduationCandidatePreview(state, courseId, semesterId);
    return preview ? [preview] : [];
  });
  return getCandidateConstraintSummary(previews);
}
