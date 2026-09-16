import type { GraduationYearCapResult } from "./graduationCap";
import type {
  GraduationBoardCourse,
  GraduationSemesterId,
  UnresolvedRequiredCoursePlacement,
} from "./graduationPlanning";
import { graduationSemesters } from "./graduationPlanning";
import type { PrerequisiteCheckResult } from "./graduationPrerequisites";
import type {
  CreditRequirementProgress,
  GraduationRequirementProgress,
} from "./graduationRequirements";

export type GraduationPlanCheckSeverity = "attention" | "info" | "unknown";

export type GraduationPlanCheckCategory =
  | "requirement"
  | "cap"
  | "prerequisite"
  | "recommended_year"
  | "semester"
  | "special_course"
  | "data_uncertainty";

export type GraduationPlanCheckTarget = {
  type: "course" | "semester" | "year" | "requirement" | "special";
  id: string;
};

export type GraduationPlanCheck = {
  id: string;
  category: GraduationPlanCheckCategory;
  severity: GraduationPlanCheckSeverity;
  title: string;
  message: string;
  courseId?: string;
  semesterId?: GraduationSemesterId;
  grade?: 1 | 2 | 3 | 4;
  requirementId?: string;
  target?: GraduationPlanCheckTarget;
};

export type PlanReviewState =
  | "needs_review"
  | "has_unknowns"
  | "no_detected_warnings";

export type GraduationPlanCheckSummary = {
  checks: GraduationPlanCheck[];
  attentionCount: number;
  unknownCount: number;
  infoCount: number;
  countsByCategory: Record<GraduationPlanCheckCategory, number>;
  reviewState: PlanReviewState;
};

export type CalculateGraduationPlanChecksInput = {
  requirementProgress: GraduationRequirementProgress;
  capResults: readonly GraduationYearCapResult[];
  prerequisiteChecks: ReadonlyMap<string, PrerequisiteCheckResult>;
  placements: readonly GraduationBoardCourse[];
  hasSpecialCourseUncertainty?: boolean;
  unresolvedRequiredCourses?: readonly UnresolvedRequiredCoursePlacement[];
};

const categoryLabels: Record<GraduationPlanCheckCategory, string> = {
  requirement: "卒業要件",
  cap: "CAP",
  prerequisite: "前提科目",
  recommended_year: "配当年次",
  semester: "開講学期",
  special_course: "特殊科目",
  data_uncertainty: "未確認事項",
};

export { categoryLabels as graduationPlanCheckCategoryLabels };

function requirementTarget(requirementId: string): GraduationPlanCheckTarget {
  return {
    type: "requirement",
    id: `graduation-requirement-${requirementId}`,
  };
}

function courseTarget(courseId: string): GraduationPlanCheckTarget {
  return { type: "course", id: `graduation-course-${courseId}` };
}

function creditRequirementCheck(
  progress: CreditRequirementProgress,
): GraduationPlanCheck | null {
  const symbol = "symbol" in progress && typeof progress.symbol === "string"
    ? `${progress.symbol} `
    : "";
  const title = `${symbol}${progress.label}`;
  if (progress.status === "shortfall" && progress.projectedShortfall > 0) {
    return {
      id: `requirement:${progress.id}`,
      category: "requirement",
      severity: "attention",
      title,
      message: `計画上も${progress.projectedShortfall}単位不足しています。`,
      requirementId: progress.id,
      target: requirementTarget(progress.id),
    };
  }
  if (progress.status === "unknown") {
    return {
      id: `requirement:${progress.id}:unknown`,
      category: "requirement",
      severity: "unknown",
      title,
      message: "現在の公式情報・計画だけでは安全に判定できません。",
      requirementId: progress.id,
      target: requirementTarget(progress.id),
    };
  }
  return null;
}

function addRequirementChecks(
  checks: GraduationPlanCheck[],
  progress: GraduationRequirementProgress,
) {
  const creditRequirements = [
    progress.totalCredits,
    progress.selectableRequired,
    ...progress.requirementGroups,
    ...progress.electiveRequirements,
  ];
  for (const requirement of creditRequirements) {
    const check = creditRequirementCheck(requirement);
    if (check) checks.push(check);
  }

  if (progress.requiredCourses.status === "shortfall") {
    checks.push({
      id: `requirement:${progress.requiredCourses.id}`,
      category: "requirement",
      severity: "attention",
      title: "未計画の必修科目",
      message: `${progress.requiredCourses.unplannedCourses.length}科目が、修得済み・今学期対象・将来予定のいずれにも含まれていません。`,
      requirementId: progress.requiredCourses.id,
      target: requirementTarget(progress.requiredCourses.id),
    });
  } else if (progress.requiredCourses.status === "unknown") {
    checks.push({
      id: `requirement:${progress.requiredCourses.id}:unknown`,
      category: "requirement",
      severity: "unknown",
      title: progress.requiredCourses.label,
      message: "必修科目の計画状況を安全に判定できません。",
      requirementId: progress.requiredCourses.id,
      target: requirementTarget(progress.requiredCourses.id),
    });
  }

  if (progress.selectableRequiredExcess.plannedIncludedCredits > 0) {
    checks.push({
      id: "requirement:selectable-required-excess",
      category: "requirement",
      severity: "info",
      title: "選択必修の超過単位",
      message: `選択必修の超過が${progress.selectableRequiredExcess.plannedIncludedCredits}単位あります。選択科目要件へ算入できる可能性がありますが、カテゴリ別配分は自動判定していません。`,
      requirementId: progress.selectableRequired.id,
      target: requirementTarget(progress.selectableRequired.id),
    });
  }
}

function addCapChecks(
  checks: GraduationPlanCheck[],
  capResults: readonly GraduationYearCapResult[],
) {
  for (const result of capResults) {
    const target: GraduationPlanCheckTarget = {
      type: "year",
      id: `graduation-cap-year-${result.grade}`,
    };
    if (result.status === "over_limit") {
      checks.push({
        id: `cap:year:${result.grade}`,
        category: "cap",
        severity: "attention",
        title: `${result.grade}年次CAP`,
        message: `計画上の履修登録単位が${result.annualCredits} / ${result.limit}単位で、年間上限を${(result.annualCredits ?? 0) - (result.limit ?? 0)}単位超えています。例外制度は自動判定していません。`,
        grade: result.grade,
        target,
      });
    } else if (result.status === "unknown") {
      checks.push({
        id: `cap:year:${result.grade}:unknown`,
        category: "cap",
        severity: "unknown",
        title: `${result.grade}年次CAP`,
        message: result.warnings.join(" ") || "年間CAPを判定できません。",
        grade: result.grade,
        target,
      });
    } else if (result.status === "at_limit") {
      checks.push({
        id: `cap:year:${result.grade}:at-limit`,
        category: "cap",
        severity: "info",
        title: `${result.grade}年次CAP`,
        message: `計画上の履修登録単位が年間上限ちょうどの${result.annualCredits}単位です。`,
        grade: result.grade,
        target,
      });
    }
  }
}

function addPrerequisiteChecks(
  checks: GraduationPlanCheck[],
  prerequisiteChecks: ReadonlyMap<string, PrerequisiteCheckResult>,
  placements: readonly GraduationBoardCourse[],
) {
  const names = new Map(
    placements.map((placement) => [placement.course.courseId, placement.course.name]),
  );
  for (const result of prerequisiteChecks.values()) {
    if (result.status === "satisfied" || result.status === "not_applicable") continue;
    for (const requirement of result.requirements) {
      if (requirement.status === "earned" || requirement.status === "planned_before") {
        continue;
      }
      const unknown = requirement.status === "current_unconfirmed";
      const descriptions = {
        current_unconfirmed: "現在履修対象ですが、単位修得はまだ確定していません。",
        planned_same_semester: "対象科目と同じ学期に配置されています。",
        planned_after: "対象科目より後の学期に配置されています。",
        missing: "それ以前の学期に配置されていません。",
      } as const;
      checks.push({
        id: `prerequisite:${result.courseId}:${requirement.prerequisiteCourseId}`,
        category: "prerequisite",
        severity: unknown ? "unknown" : "attention",
        title: `${names.get(result.courseId) ?? result.courseId} — 前提科目`,
        message: `${requirement.prerequisiteCourseName} — ${descriptions[requirement.status]}`,
        courseId: result.courseId,
        target: courseTarget(result.courseId),
      });
    }
  }
}

function addPlacementChecks(
  checks: GraduationPlanCheck[],
  placements: readonly GraduationBoardCourse[],
) {
  for (const placement of placements) {
    if (placement.source !== "graduation_plan") continue;
    const semester = graduationSemesters.find(
      (candidate) => candidate.id === placement.semesterId,
    );
    if (!semester) continue;
    const target = courseTarget(placement.course.courseId);
    if (
      placement.course.recommendedYears.length > 0 &&
      !placement.course.recommendedYears.includes(semester.year)
    ) {
      checks.push({
        id: `placement:year:${placement.course.courseId}`,
        category: "recommended_year",
        severity: "attention",
        title: `${placement.course.name} — 配当年次`,
        message: `公式配当年次は${placement.course.recommendedYears.join("・")}年、現在の配置は${semester.label}です。`,
        courseId: placement.course.courseId,
        semesterId: placement.semesterId,
        target,
      });
    }
    if (
      placement.course.availableSemesters.length > 0 &&
      !placement.course.availableSemesters.includes(semester.semester)
    ) {
      const official = placement.course.availableSemesters
        .map((value) => value === "spring" ? "前期" : "後期")
        .join("・");
      checks.push({
        id: `placement:semester:${placement.course.courseId}`,
        category: "semester",
        severity: "attention",
        title: `${placement.course.name} — 開講学期`,
        message: `公式配当学期は${official}、現在の配置は${semester.label}です。`,
        courseId: placement.course.courseId,
        semesterId: placement.semesterId,
        target,
      });
    }
  }
}

const severityOrder: Record<GraduationPlanCheckSeverity, number> = {
  unknown: 0,
  attention: 1,
  info: 2,
};

const categoryOrder: Record<GraduationPlanCheckCategory, number> = {
  data_uncertainty: 0,
  cap: 1,
  prerequisite: 2,
  recommended_year: 3,
  semester: 4,
  requirement: 5,
  special_course: 6,
};

export function sortGraduationPlanChecks(
  checks: readonly GraduationPlanCheck[],
): GraduationPlanCheck[] {
  return [...checks].sort((left, right) =>
    severityOrder[left.severity] - severityOrder[right.severity] ||
    categoryOrder[left.category] - categoryOrder[right.category] ||
    left.id.localeCompare(right.id, "ja")
  );
}

export function calculateGraduationPlanChecks({
  requirementProgress,
  capResults,
  prerequisiteChecks,
  placements,
  hasSpecialCourseUncertainty = false,
  unresolvedRequiredCourses = [],
}: CalculateGraduationPlanChecksInput): GraduationPlanCheckSummary {
  const rawChecks: GraduationPlanCheck[] = [];

  if (requirementProgress.hasUnknownFirstSemesterStatus) {
    rawChecks.push({
      id: "data:first-semester-status",
      category: "data_uncertainty",
      severity: "unknown",
      title: "1年前期の修得状況",
      message: "修得状況が未回答または未確認の科目があり、CAP・卒業要件の実際の進捗に影響する可能性があります。",
      target: requirementTarget("total-credits"),
    });
  }
  if (hasSpecialCourseUncertainty) {
    rawChecks.push({
      id: "special:credit-treatment",
      category: "special_course",
      severity: "unknown",
      title: "特殊科目の単位算入",
      message: "イノベーション特講・技法の一部は、卒業要件・CAP試算に含めていません。",
      target: { type: "special", id: "graduation-special-heading" },
    });
  }
  for (const unresolved of unresolvedRequiredCourses) {
    rawChecks.push({
      id: `data:required-placement:${unresolved.course.courseId}`,
      category: "data_uncertainty",
      severity: "unknown",
      title: `${unresolved.course.name} — 必修の配置時期`,
      message: "公式curriculumの配当情報から配置学期を一意に決められないため、自動配置していません。",
    });
  }

  addCapChecks(rawChecks, capResults);
  addPrerequisiteChecks(rawChecks, prerequisiteChecks, placements);
  addPlacementChecks(rawChecks, placements);
  addRequirementChecks(rawChecks, requirementProgress);

  const uniqueChecks = [...new Map(rawChecks.map((check) => [check.id, check])).values()];
  const checks = sortGraduationPlanChecks(uniqueChecks);
  const countsByCategory = Object.fromEntries(
    Object.keys(categoryLabels).map((category) => [
      category,
      checks.filter((check) => check.category === category).length,
    ]),
  ) as Record<GraduationPlanCheckCategory, number>;
  const attentionCount = checks.filter((check) => check.severity === "attention").length;
  const unknownCount = checks.filter((check) => check.severity === "unknown").length;
  const infoCount = checks.filter((check) => check.severity === "info").length;

  return {
    checks,
    attentionCount,
    unknownCount,
    infoCount,
    countsByCategory,
    reviewState: attentionCount > 0
      ? "needs_review"
      : unknownCount > 0
        ? "has_unknowns"
        : "no_detected_warnings",
  };
}
