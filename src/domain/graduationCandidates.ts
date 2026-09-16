import type { GraduationYearCapResult } from "./graduationCap";
import {
  getPlacementWarnings,
  graduationSemesters,
  type CurriculumCourse,
  type CurriculumRequirementSymbol,
  type CurriculumRequirementType,
  type CurriculumSemester,
  type GraduationSemesterId,
} from "./graduationPlanning";
import type { PrerequisiteCheckResult } from "./graduationPrerequisites";
import type {
  GraduationRequirementPlacement,
  GraduationRequirementProgress,
  GraduationRequirementsData,
} from "./graduationRequirements";

export type GraduationCandidateReason =
  | "requirement_group"
  | "selectable_required_total"
  | "elective_category"
  | "total_credits"
  | "required_course";

export type CandidateConstraintStatus = "clear" | "attention" | "unknown";

export type GraduationCourseCandidateReason = {
  type: GraduationCandidateReason;
  requirementId: string;
  label: string;
};

export type GraduationCourseCandidate = {
  course: CurriculumCourse;
  courseId: string;
  credits: number;
  reasons: GraduationCourseCandidateReason[];
  recommendedYears: number[];
  availableSemesters: CurriculumSemester[];
  prerequisiteStatus: CandidateConstraintStatus;
  alreadyUsed: "none" | "earned" | "current" | "planned";
  notes: string[];
};

export type GraduationCandidateFilters = {
  query?: string;
  year?: number | null;
  semester?: CurriculumSemester | null;
  requirementGroup?: CurriculumRequirementSymbol | null;
  requirementType?: CurriculumRequirementType | null;
  curriculumCategoryPrefix?: string | null;
  placementSemesterId?: GraduationSemesterId | null;
  matchingPlacementOnly?: boolean;
};

export type CandidatePlacementPreview = {
  courseId: string;
  semesterId: GraduationSemesterId;
  yearPlacement: "match" | "mismatch" | "unknown";
  semesterPlacement: "match" | "mismatch" | "unknown";
  prerequisite: CandidateConstraintStatus;
  cap: {
    beforeCredits: number | null;
    afterCredits: number | null;
    limit: number | null;
    status: GraduationYearCapResult["status"];
  };
  status: CandidateConstraintStatus;
  messages: string[];
};

export type CandidateConstraintSummary = {
  total: number;
  clear: number;
  attention: number;
  unknown: number;
};

function requirementIsOpen(status: string) {
  return status === "shortfall" || status === "unknown";
}

export function isTotalOnlyCandidateSearchAvailable(
  progress: GraduationRequirementProgress,
): boolean {
  const otherStatuses = [
    progress.requiredCourses.status,
    progress.selectableRequired.status,
    ...progress.requirementGroups.map((item) => item.status),
    ...progress.electiveRequirements.map((item) => item.status),
  ];
  return progress.totalCredits.status === "shortfall" && otherStatuses.every(
    (status) => status === "satisfied" || status === "projected_satisfied",
  );
}

export function getCandidateReasons({
  course,
  progress,
  requirements,
}: {
  course: CurriculumCourse;
  progress: GraduationRequirementProgress;
  requirements: GraduationRequirementsData;
}): GraduationCourseCandidateReason[] {
  const reasons: GraduationCourseCandidateReason[] = [];
  if (
    course.requirementType === "required" &&
    progress.requiredCourses.status === "shortfall"
  ) {
    reasons.push({
      type: "required_course",
      requirementId: progress.requiredCourses.id,
      label: "公式curriculum上の未計画必修科目です",
    });
  }
  if (
    course.requirementType === "required_elective" &&
    progress.selectableRequired.status === "shortfall"
  ) {
    reasons.push({
      type: "selectable_required_total",
      requirementId: progress.selectableRequired.id,
      label: "選択必修合計に関係する科目です",
    });
  }
  for (const group of progress.requirementGroups) {
    if (
      group.status === "shortfall" &&
      course.requirementGroups.includes(group.symbol)
    ) {
      reasons.push({
        type: "requirement_group",
        requirementId: group.id,
        label: `${group.symbol} ${group.label}の選択必修科目です`,
      });
    }
  }
  for (const elective of progress.electiveRequirements) {
    const rule = requirements.electiveRequirements.find(
      (item) => item.id === elective.id,
    );
    if (
      rule &&
      requirementIsOpen(elective.status) &&
      course.requirementType === "elective" &&
      course.curriculumCategory.startsWith(rule.categoryPrefix)
    ) {
      reasons.push({
        type: "elective_category",
        requirementId: elective.id,
        label: `${elective.label}に関係する選択科目です`,
      });
    }
  }
  if (isTotalOnlyCandidateSearchAvailable(progress)) {
    reasons.push({
      type: "total_credits",
      requirementId: progress.totalCredits.id,
      label: "総卒業単位の計画に関係する一般科目です",
    });
  }
  return [...new Map(reasons.map((reason) => [reason.requirementId, reason])).values()];
}

function courseMatchesRequirement({
  course,
  requirementId,
  progress,
  requirements,
}: {
  course: CurriculumCourse;
  requirementId: string;
  progress: GraduationRequirementProgress;
  requirements: GraduationRequirementsData;
}) {
  if (requirementId === progress.requiredCourses.id) {
    return course.requirementType === "required";
  }
  if (requirementId === progress.selectableRequired.id) {
    return course.requirementType === "required_elective";
  }
  if (requirementId === progress.totalCredits.id) {
    return isTotalOnlyCandidateSearchAvailable(progress);
  }
  const group = progress.requirementGroups.find((item) => item.id === requirementId);
  if (group) return course.requirementGroups.includes(group.symbol);
  const elective = requirements.electiveRequirements.find(
    (item) => item.id === requirementId,
  );
  return Boolean(
    elective &&
      course.requirementType === "elective" &&
      course.curriculumCategory.startsWith(elective.categoryPrefix),
  );
}

function matchesFilters(course: CurriculumCourse, filters: GraduationCandidateFilters) {
  const query = filters.query?.trim().toLocaleLowerCase("ja") ?? "";
  if (query && !course.name.toLocaleLowerCase("ja").includes(query)) return false;
  if (filters.year && !course.recommendedYears.includes(filters.year)) return false;
  if (filters.semester && !course.availableSemesters.includes(filters.semester)) {
    return false;
  }
  if (
    filters.requirementGroup &&
    !course.requirementGroups.includes(filters.requirementGroup)
  ) return false;
  if (
    filters.requirementType &&
    course.requirementType !== filters.requirementType
  ) return false;
  if (
    filters.curriculumCategoryPrefix &&
    !course.curriculumCategory.startsWith(filters.curriculumCategoryPrefix)
  ) return false;
  if (filters.matchingPlacementOnly && filters.placementSemesterId) {
    const semester = graduationSemesters.find(
      (item) => item.id === filters.placementSemesterId,
    );
    if (!semester) return false;
    if (
      course.recommendedYears.length > 0 &&
      !course.recommendedYears.includes(semester.year)
    ) return false;
    if (
      course.availableSemesters.length > 0 &&
      !course.availableSemesters.includes(semester.semester)
    ) return false;
  }
  return true;
}

export function filterGraduationCandidates(
  candidates: readonly GraduationCourseCandidate[],
  filters: GraduationCandidateFilters,
) {
  return candidates.filter((candidate) => matchesFilters(candidate.course, filters));
}

export function getCandidatesForRequirement({
  curriculum,
  placements,
  progress,
  requirements,
  requirementId,
  filters = {},
}: {
  curriculum: readonly CurriculumCourse[];
  placements: readonly GraduationRequirementPlacement[];
  progress: GraduationRequirementProgress;
  requirements: GraduationRequirementsData;
  requirementId: string;
  filters?: GraduationCandidateFilters;
}): GraduationCourseCandidate[] {
  const used = new Map(placements.map((placement) => [placement.courseId, placement.layer]));
  return curriculum
    .filter((course) =>
      course.planningAvailability === "standard" &&
      course.credits > 0 &&
      !used.has(course.courseId) &&
      courseMatchesRequirement({ course, requirementId, progress, requirements }) &&
      matchesFilters(course, filters)
    )
    .map((course) => ({
      course,
      courseId: course.courseId,
      credits: course.credits,
      reasons: getCandidateReasons({ course, progress, requirements }),
      recommendedYears: course.recommendedYears,
      availableSemesters: course.availableSemesters,
      prerequisiteStatus: "unknown" as const,
      alreadyUsed: "none" as const,
      notes: course.notes,
    }))
    .sort((left, right) =>
      (left.recommendedYears[0] ?? Number.POSITIVE_INFINITY) -
        (right.recommendedYears[0] ?? Number.POSITIVE_INFINITY) ||
      (left.availableSemesters[0] === "spring" ? 0 : 1) -
        (right.availableSemesters[0] === "spring" ? 0 : 1) ||
      left.course.name.localeCompare(right.course.name, "ja")
    );
}

export function previewCandidatePlacement({
  course,
  semesterId,
  prerequisiteResult,
  capBefore,
  capAfter,
}: {
  course: CurriculumCourse;
  semesterId: GraduationSemesterId;
  prerequisiteResult: PrerequisiteCheckResult;
  capBefore: GraduationYearCapResult | null;
  capAfter: GraduationYearCapResult | null;
}): CandidatePlacementPreview {
  const semester = graduationSemesters.find((item) => item.id === semesterId);
  const yearPlacement = !semester || course.recommendedYears.length === 0
    ? "unknown"
    : course.recommendedYears.includes(semester.year) ? "match" : "mismatch";
  const semesterPlacement = !semester || course.availableSemesters.length === 0
    ? "unknown"
    : course.availableSemesters.includes(semester.semester) ? "match" : "mismatch";
  const prerequisite: CandidateConstraintStatus =
    prerequisiteResult.status === "satisfied" ||
      prerequisiteResult.status === "not_applicable"
      ? "clear"
      : prerequisiteResult.requirements.some(
          (item) => item.status === "current_unconfirmed",
        )
        ? "unknown"
        : "attention";
  const messages = getPlacementWarnings(course, semesterId);
  for (const item of prerequisiteResult.requirements) {
    if (item.status === "earned" || item.status === "planned_before") continue;
    const detail = item.status === "current_unconfirmed"
      ? "現在履修対象ですが、単位修得はまだ確定していません。"
      : item.status === "planned_same_semester"
        ? "同じ学期に配置されています。"
        : item.status === "planned_after"
          ? "後の学期に配置されています。"
          : "前の学期に配置されていません。";
    messages.push(`${item.prerequisiteCourseName} — ${detail}`);
  }
  if (capAfter?.status === "over_limit") {
    messages.push(
      `${capAfter.grade}年次の計画上の履修登録単位が${capAfter.annualCredits} / ${capAfter.limit}単位になります。`,
    );
  } else if (capAfter?.status === "unknown") {
    messages.push("年間CAPは現在の情報だけでは判定できません。");
  }
  const hasAttention =
    yearPlacement === "mismatch" ||
    semesterPlacement === "mismatch" ||
    prerequisite === "attention" ||
    capAfter?.status === "over_limit";
  const hasUnknown =
    yearPlacement === "unknown" ||
    semesterPlacement === "unknown" ||
    prerequisite === "unknown" ||
    !capAfter ||
    capAfter.status === "unknown";
  return {
    courseId: course.courseId,
    semesterId,
    yearPlacement,
    semesterPlacement,
    prerequisite,
    cap: {
      beforeCredits: capBefore?.annualCredits ?? null,
      afterCredits: capAfter?.annualCredits ?? null,
      limit: capAfter?.limit ?? null,
      status: capAfter?.status ?? "unknown",
    },
    status: hasAttention ? "attention" : hasUnknown ? "unknown" : "clear",
    messages,
  };
}

export function getCandidateConstraintSummary(
  previews: readonly CandidatePlacementPreview[],
): CandidateConstraintSummary {
  return {
    total: previews.length,
    clear: previews.filter((preview) => preview.status === "clear").length,
    attention: previews.filter((preview) => preview.status === "attention").length,
    unknown: previews.filter((preview) => preview.status === "unknown").length,
  };
}
