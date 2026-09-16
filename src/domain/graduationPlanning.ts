export type GraduationSemesterId =
  | "year1-spring"
  | "year1-fall"
  | "year2-spring"
  | "year2-fall"
  | "year3-spring"
  | "year3-fall"
  | "year4-spring"
  | "year4-fall";

export type GraduationCourseStatus = "earned" | "in_progress" | "planned";

export type GraduationPlanEntry = {
  courseId: string;
  semesterId: GraduationSemesterId;
};

export type GraduationPlan = {
  entries: GraduationPlanEntry[];
};

export type CurriculumSemester = "spring" | "fall";
export type CurriculumRequirementSymbol = "◆" | "▲" | "■" | "□" | "◎" | "★" | "☆";
export type CurriculumRequirementType =
  | "required"
  | "required_elective"
  | "elective";

export type CurriculumCourse = {
  courseId: string;
  name: string;
  credits: number;
  recommendedYears: number[];
  availableSemesters: CurriculumSemester[];
  curriculumCategory: string;
  requirementGroups: CurriculumRequirementSymbol[];
  requirementType: CurriculumRequirementType;
  prerequisites: string[];
  notes: string[];
  planningAvailability: "standard" | "managed_elsewhere";
  sourcePage: number;
};

export type CurriculumData = {
  metadata: {
    academicYear: 2026;
    applicableAdmissionYears: string;
    documentName: string;
    documentSection: string;
  };
  courses: CurriculumCourse[];
};

export type GraduationBoardCourse = {
  course: CurriculumCourse;
  semesterId: GraduationSemesterId;
  status: GraduationCourseStatus;
  source:
    | "first_semester"
    | "current_registration"
    | "required_auto"
    | "graduation_plan";
  firstSemesterStatus?: "failed" | "not_taken" | "unknown";
  registrationEvidence?: "unipa_confirmed";
  editable: boolean;
};

export type RequiredCourseAutomaticPlacement = {
  course: CurriculumCourse;
  semesterId: GraduationSemesterId;
};

export type UnresolvedRequiredCoursePlacement = {
  course: CurriculumCourse;
  reasons: Array<
    | "multiple_years"
    | "multiple_semesters"
    | "unknown_year"
    | "unknown_semester"
    | "managed_elsewhere"
  >;
};

export type GraduationSemesterBoard = {
  id: GraduationSemesterId;
  label: string;
  courses: GraduationBoardCourse[];
  credits: {
    earned: number;
    current: number;
    inProgress: number;
    planned: number;
    total: number;
  };
};

export type GraduationCreditSummary = {
  earnedCredits: number;
  currentCredits: number;
  inProgressCredits: number;
  plannedCredits: number;
  totalPlannedCredits: number;
};

export const graduationSemesters: readonly {
  id: GraduationSemesterId;
  label: string;
  year: number;
  semester: CurriculumSemester;
}[] = [
  { id: "year1-spring", label: "1年前期", year: 1, semester: "spring" },
  { id: "year1-fall", label: "1年後期", year: 1, semester: "fall" },
  { id: "year2-spring", label: "2年前期", year: 2, semester: "spring" },
  { id: "year2-fall", label: "2年後期", year: 2, semester: "fall" },
  { id: "year3-spring", label: "3年前期", year: 3, semester: "spring" },
  { id: "year3-fall", label: "3年後期", year: 3, semester: "fall" },
  { id: "year4-spring", label: "4年前期", year: 4, semester: "spring" },
  { id: "year4-fall", label: "4年後期", year: 4, semester: "fall" },
];

const graduationSemesterOrder = new Map(
  graduationSemesters.map((semester, index) => [semester.id, index]),
);

export function getGraduationSemesterOrder(
  semesterId: GraduationSemesterId,
): number {
  return graduationSemesterOrder.get(semesterId) ?? -1;
}

export function createEmptyGraduationPlan(): GraduationPlan {
  return { entries: [] };
}

export function isGraduationSemesterId(
  value: unknown,
): value is GraduationSemesterId {
  return typeof value === "string" && graduationSemesters.some(
    (semester) => semester.id === value,
  );
}

export function getRequiredCourseAutomaticPlacement(
  course: CurriculumCourse,
): RequiredCourseAutomaticPlacement | null {
  if (
    course.requirementType !== "required" ||
    course.planningAvailability !== "standard" ||
    course.recommendedYears.length !== 1 ||
    course.availableSemesters.length !== 1
  ) {
    return null;
  }
  const year = course.recommendedYears[0];
  const semester = course.availableSemesters[0];
  const semesterId = `year${year}-${semester}`;
  if (!isGraduationSemesterId(semesterId)) return null;
  return { course, semesterId };
}

export function getUnresolvedRequiredCoursePlacement(
  course: CurriculumCourse,
): UnresolvedRequiredCoursePlacement | null {
  if (course.requirementType !== "required") return null;
  if (getRequiredCourseAutomaticPlacement(course)) return null;
  const reasons: UnresolvedRequiredCoursePlacement["reasons"] = [];
  if (course.planningAvailability !== "standard") reasons.push("managed_elsewhere");
  if (course.recommendedYears.length === 0) reasons.push("unknown_year");
  if (course.recommendedYears.length > 1) reasons.push("multiple_years");
  if (course.availableSemesters.length === 0) reasons.push("unknown_semester");
  if (course.availableSemesters.length > 1) reasons.push("multiple_semesters");
  return { course, reasons };
}

export function sanitizeGraduationPlan(
  raw: unknown,
  validCourseIds: ReadonlySet<string>,
): GraduationPlan {
  if (typeof raw !== "object" || raw === null || !("entries" in raw)) {
    return createEmptyGraduationPlan();
  }
  const entries = raw.entries;
  if (!Array.isArray(entries)) return createEmptyGraduationPlan();

  const seen = new Set<string>();
  const validEntries: GraduationPlanEntry[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    if (!("courseId" in entry) || !("semesterId" in entry)) continue;
    const { courseId, semesterId } = entry;
    if (
      typeof courseId !== "string" ||
      !validCourseIds.has(courseId) ||
      !isGraduationSemesterId(semesterId) ||
      ("status" in entry && entry.status !== "planned") ||
      seen.has(courseId)
    ) continue;
    seen.add(courseId);
    validEntries.push({ courseId, semesterId });
  }
  return { entries: validEntries };
}

export function getPlacementWarnings(
  course: CurriculumCourse,
  semesterId: GraduationSemesterId,
): string[] {
  const semester = graduationSemesters.find((item) => item.id === semesterId);
  if (!semester) return ["配置先の学期を確認できません。"];

  const warnings: string[] = [];
  if (
    course.recommendedYears.length > 0 &&
    !course.recommendedYears.includes(semester.year)
  ) {
    warnings.push(
      `この科目は公式資料では${course.recommendedYears.join("・")}年次配当です。`,
    );
  }
  if (
    course.availableSemesters.length > 0 &&
    !course.availableSemesters.includes(semester.semester)
  ) {
    warnings.push(
      `公式資料では${course.availableSemesters.includes("spring") ? "前期" : "後期"}科目です。`,
    );
  }
  return warnings;
}

export function canAddCourseToPlan(
  plan: GraduationPlan,
  courseId: string,
  validCourseIds: ReadonlySet<string>,
  occupiedCourseIds: ReadonlySet<string> = new Set(),
): boolean {
  return (
    validCourseIds.has(courseId) &&
    !occupiedCourseIds.has(courseId) &&
    !plan.entries.some((entry) => entry.courseId === courseId)
  );
}

export function addPlannedCourse(
  plan: GraduationPlan,
  entry: GraduationPlanEntry,
  validCourseIds: ReadonlySet<string>,
  occupiedCourseIds: ReadonlySet<string> = new Set(),
): GraduationPlan {
  if (
    !isGraduationSemesterId(entry.semesterId) ||
    !canAddCourseToPlan(plan, entry.courseId, validCourseIds, occupiedCourseIds)
  ) return plan;
  return { entries: [...plan.entries, entry] };
}

export function movePlannedCourse(
  plan: GraduationPlan,
  courseId: string,
  semesterId: GraduationSemesterId,
  validCourseIds: ReadonlySet<string>,
): GraduationPlan {
  if (
    !validCourseIds.has(courseId) ||
    !isGraduationSemesterId(semesterId) ||
    !plan.entries.some((entry) => entry.courseId === courseId)
  ) return plan;
  return {
    entries: plan.entries.map((entry) =>
      entry.courseId === courseId ? { ...entry, semesterId } : entry,
    ),
  };
}

export function removePlannedCourse(
  plan: GraduationPlan,
  courseId: string,
): GraduationPlan {
  if (!plan.entries.some((entry) => entry.courseId === courseId)) return plan;
  return { entries: plan.entries.filter((entry) => entry.courseId !== courseId) };
}

export function getSemesterPlannedCredits(
  courses: readonly GraduationBoardCourse[],
): GraduationSemesterBoard["credits"] {
  const earned = courses
    .filter((entry) => entry.status === "earned")
    .reduce((sum, entry) => sum + entry.course.credits, 0);
  const inProgress = courses
    .filter((entry) => entry.status === "in_progress")
    .reduce((sum, entry) => sum + entry.course.credits, 0);
  const current = courses
    .filter((entry) => entry.source === "current_registration")
    .reduce((sum, entry) => sum + entry.course.credits, 0);
  const planned = courses
    .filter((entry) =>
      entry.source === "graduation_plan" || entry.source === "required_auto"
    )
    .reduce((sum, entry) => sum + entry.course.credits, 0);
  return {
    earned,
    current,
    inProgress,
    planned,
    total: earned + current + planned,
  };
}

export function getGraduationCreditSummary(
  board: readonly GraduationSemesterBoard[],
): GraduationCreditSummary {
  const earnedCredits = board.reduce((sum, semester) => sum + semester.credits.earned, 0);
  const currentCredits = board.reduce(
    (sum, semester) => sum + semester.credits.current,
    0,
  );
  const inProgressCredits = board.reduce(
    (sum, semester) => sum + semester.credits.inProgress,
    0,
  );
  const plannedCredits = board.reduce((sum, semester) => sum + semester.credits.planned, 0);
  return {
    earnedCredits,
    currentCredits,
    inProgressCredits,
    plannedCredits,
    totalPlannedCredits: earnedCredits + currentCredits + plannedCredits,
  };
}
