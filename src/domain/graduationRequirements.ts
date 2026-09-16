import type {
  CurriculumCourse,
  CurriculumRequirementSymbol,
} from "./graduationPlanning";

export type RequirementProgressStatus =
  | "satisfied"
  | "projected_satisfied"
  | "shortfall"
  | "unknown";

export type OfficialRequirementGroup = {
  id: string;
  symbol: CurriculumRequirementSymbol;
  label: string;
  requiredCredits: number;
};

export type ElectiveRequirementRule = {
  id: string;
  label: string;
  categoryPrefix: string;
  minimumCredits: number;
};

export type GraduationRequirementsData = {
  academicYear: 2026;
  entryCohort: { from: number; label: string };
  totalCreditsRequired: number;
  categoryTotals: {
    requiredCredits: number;
    selectableRequiredCredits: number;
    electiveCredits: number;
  };
  requiredCourses: {
    id: string;
    label: string;
    requiredCredits: number;
    allCoursesRequired: boolean;
  };
  selectableRequired: {
    id: string;
    label: string;
    totalRequiredCredits: number;
  };
  electiveRequirements: ElectiveRequirementRule[];
  excessSelectableRequiredTreatment: {
    canCountTowardElectives: boolean;
    allocation: "requires_official_confirmation";
    note: string;
  };
  requirements: OfficialRequirementGroup[];
  source: {
    documentName: string;
    section: string;
    page: number;
    physicalPage: number;
  };
};

export type GraduationRequirementLayer = "earned" | "current" | "planned";

export type GraduationRequirementPlacement = {
  courseId: string;
  layer: GraduationRequirementLayer;
};

export type CreditRequirementProgress = {
  id: string;
  label: string;
  requiredCredits: number;
  earnedCredits: number;
  currentIncludedCredits: number;
  plannedIncludedCredits: number;
  earnedShortfall: number;
  projectedShortfall: number;
  status: RequirementProgressStatus;
  notes: string[];
};

export type RequirementGroupProgress = CreditRequirementProgress & {
  symbol: CurriculumRequirementSymbol;
};

export type RequiredCourseProgress = {
  id: string;
  label: string;
  requiredCredits: number;
  totalCourses: number;
  earnedCourses: number;
  currentIncludedCourses: number;
  plannedIncludedCourses: number;
  unplannedCourses: Array<{ courseId: string; name: string; credits: number }>;
  earnedCredits: number;
  currentIncludedCredits: number;
  plannedIncludedCredits: number;
  status: RequirementProgressStatus;
  notes: string[];
};

export type SelectableRequiredExcessProgress = {
  earnedCredits: number;
  currentIncludedCredits: number;
  plannedIncludedCredits: number;
  canCountTowardElectives: boolean;
  allocationRequiresConfirmation: boolean;
  note: string;
};

export type GraduationRequirementProgress = {
  totalCredits: CreditRequirementProgress;
  requiredCourses: RequiredCourseProgress;
  selectableRequired: CreditRequirementProgress;
  requirementGroups: RequirementGroupProgress[];
  electiveRequirements: CreditRequirementProgress[];
  selectableRequiredExcess: SelectableRequiredExcessProgress;
  hasUnknownFirstSemesterStatus: boolean;
  excludedSpecialCourses: Array<{ courseId: string; name: string }>;
  warnings: string[];
};

type LayeredCredits = {
  earned: number;
  currentIncluded: number;
  plannedIncluded: number;
};

const layerPriority: Record<GraduationRequirementLayer, number> = {
  earned: 3,
  current: 2,
  planned: 1,
};

function normalizePlacements(
  placements: readonly GraduationRequirementPlacement[],
): Map<string, GraduationRequirementLayer> {
  const normalized = new Map<string, GraduationRequirementLayer>();
  for (const placement of placements) {
    const current = normalized.get(placement.courseId);
    if (!current || layerPriority[placement.layer] > layerPriority[current]) {
      normalized.set(placement.courseId, placement.layer);
    }
  }
  return normalized;
}

function calculateLayeredCredits(
  courses: readonly CurriculumCourse[],
  placements: ReadonlyMap<string, GraduationRequirementLayer>,
): LayeredCredits {
  let earned = 0;
  let current = 0;
  let planned = 0;
  for (const course of courses) {
    const layer = placements.get(course.courseId);
    if (layer === "earned") earned += course.credits;
    if (layer === "current") current += course.credits;
    if (layer === "planned") planned += course.credits;
  }
  return {
    earned,
    currentIncluded: earned + current,
    plannedIncluded: earned + current + planned,
  };
}

export function getCreditRequirementStatus(
  earnedCredits: number,
  plannedIncludedCredits: number,
  requiredCredits: number,
  isUnknown = false,
): RequirementProgressStatus {
  if (isUnknown) return "unknown";
  if (earnedCredits >= requiredCredits) return "satisfied";
  if (plannedIncludedCredits >= requiredCredits) return "projected_satisfied";
  return "shortfall";
}

function makeCreditProgress(
  id: string,
  label: string,
  requiredCredits: number,
  credits: LayeredCredits,
  notes: string[] = [],
  isUnknown = false,
): CreditRequirementProgress {
  return {
    id,
    label,
    requiredCredits,
    earnedCredits: credits.earned,
    currentIncludedCredits: credits.currentIncluded,
    plannedIncludedCredits: credits.plannedIncluded,
    earnedShortfall: Math.max(requiredCredits - credits.earned, 0),
    projectedShortfall: Math.max(requiredCredits - credits.plannedIncluded, 0),
    status: getCreditRequirementStatus(
      credits.earned,
      credits.plannedIncluded,
      requiredCredits,
      isUnknown,
    ),
    notes,
  };
}

export type CalculateGraduationRequirementProgressInput = {
  curriculum: readonly CurriculumCourse[];
  placements: readonly GraduationRequirementPlacement[];
  requirements: GraduationRequirementsData;
  hasUnknownFirstSemesterStatus?: boolean;
  hasUnresolvedRequiredCoursePlacement?: boolean;
};

export function calculateGraduationRequirementProgress({
  curriculum,
  placements,
  requirements,
  hasUnknownFirstSemesterStatus = false,
  hasUnresolvedRequiredCoursePlacement = false,
}: CalculateGraduationRequirementProgressInput): GraduationRequirementProgress {
  const placementByCourseId = normalizePlacements(placements);
  const standardCourses = curriculum.filter(
    (course) => course.planningAvailability === "standard",
  );
  const standardIds = new Set(standardCourses.map((course) => course.courseId));
  const unknownPlacementIds = [...placementByCourseId.keys()].filter(
    (courseId) => !standardIds.has(courseId),
  );
  const excludedSpecialCourses = curriculum
    .filter((course) => course.planningAvailability === "managed_elsewhere")
    .map((course) => ({ courseId: course.courseId, name: course.name }));
  const multiGroupCourses = standardCourses.filter(
    (course) => course.requirementGroups.length > 1,
  );

  const totalCredits = makeCreditProgress(
    "total-credits",
    "総卒業単位",
    requirements.totalCreditsRequired,
    calculateLayeredCredits(standardCourses, placementByCourseId),
    ["特殊科目の一部は、現在の卒業要件試算に含めていません。"],
  );

  const requiredCourses = standardCourses.filter(
    (course) => course.requirementType === "required",
  );
  const requiredCredits = calculateLayeredCredits(
    requiredCourses,
    placementByCourseId,
  );
  const countAtLayer = (layers: GraduationRequirementLayer[]) =>
    requiredCourses.filter((course) => {
      const layer = placementByCourseId.get(course.courseId);
      return layer ? layers.includes(layer) : false;
    }).length;
  const earnedCourses = countAtLayer(["earned"]);
  const currentIncludedCourses = countAtLayer(["earned", "current"]);
  const plannedIncludedCourses = countAtLayer(["earned", "current", "planned"]);
  const unplannedCourses = requiredCourses
    .filter((course) => !placementByCourseId.has(course.courseId))
    .map((course) => ({
      courseId: course.courseId,
      name: course.name,
      credits: course.credits,
    }));
  const requiredStatus: RequirementProgressStatus =
    hasUnresolvedRequiredCoursePlacement
      ? "unknown"
      : earnedCourses === requiredCourses.length
      ? "satisfied"
      : plannedIncludedCourses === requiredCourses.length
        ? "projected_satisfied"
        : "shortfall";
  const requiredCourseProgress: RequiredCourseProgress = {
    id: requirements.requiredCourses.id,
    label: requirements.requiredCourses.label,
    requiredCredits: requirements.requiredCourses.requiredCredits,
    totalCourses: requiredCourses.length,
    earnedCourses,
    currentIncludedCourses,
    plannedIncludedCourses,
    unplannedCourses,
    earnedCredits: requiredCredits.earned,
    currentIncludedCredits: requiredCredits.currentIncluded,
    plannedIncludedCredits: requiredCredits.plannedIncluded,
    status: requiredStatus,
    notes: [
      "必修は単位数だけでなく、対象となる全科目の修得が必要です。",
      ...(hasUnresolvedRequiredCoursePlacement
        ? ["公式配当から配置学期を一意に決められない必修科目があります。"]
        : []),
    ],
  };

  const selectableCourses = standardCourses.filter(
    (course) => course.requirementType === "required_elective",
  );
  const selectableCredits = calculateLayeredCredits(
    selectableCourses,
    placementByCourseId,
  );
  const selectableRequired = makeCreditProgress(
    requirements.selectableRequired.id,
    requirements.selectableRequired.label,
    requirements.selectableRequired.totalRequiredCredits,
    selectableCredits,
    ["記号別の必要単位も、それぞれ満たす必要があります。"],
  );

  const ambiguousSymbols = new Set(
    multiGroupCourses.flatMap((course) => course.requirementGroups),
  );
  const requirementGroups = requirements.requirements.map((requirement) => {
    const courses = selectableCourses.filter((course) =>
      course.requirementGroups.includes(requirement.symbol),
    );
    const ambiguous = ambiguousSymbols.has(requirement.symbol);
    return {
      ...makeCreditProgress(
        requirement.id,
        requirement.label,
        requirement.requiredCredits,
        calculateLayeredCredits(courses, placementByCourseId),
        ambiguous
          ? ["複数の要件記号に属する科目があり、重複算入ルールの確認が必要です。"]
          : [],
        ambiguous,
      ),
      symbol: requirement.symbol,
    };
  });

  const excess = {
    earned: Math.max(
      selectableCredits.earned - requirements.selectableRequired.totalRequiredCredits,
      0,
    ),
    currentIncluded: Math.max(
      selectableCredits.currentIncluded -
        requirements.selectableRequired.totalRequiredCredits,
      0,
    ),
    plannedIncluded: Math.max(
      selectableCredits.plannedIncluded -
        requirements.selectableRequired.totalRequiredCredits,
      0,
    ),
  };
  const electiveRequirements = requirements.electiveRequirements.map((rule) => {
    const courses = standardCourses.filter(
      (course) =>
        course.requirementType === "elective" &&
        course.curriculumCategory.startsWith(rule.categoryPrefix),
    );
    const credits = calculateLayeredCredits(courses, placementByCourseId);
    const allocationCouldAffectResult =
      credits.plannedIncluded < rule.minimumCredits && excess.plannedIncluded > 0;
    return makeCreditProgress(
      rule.id,
      rule.label,
      rule.minimumCredits,
      credits,
      allocationCouldAffectResult
        ? ["選択必修の超過単位をどの選択科目区分へ充当するか、公式確認が必要です。"]
        : [],
      allocationCouldAffectResult,
    );
  });

  const warnings: string[] = [];
  if (hasUnknownFirstSemesterStatus) {
    warnings.push(
      "1年前期に修得状況未確認の科目があります。実際の進捗は表示より多い可能性があります。",
    );
  }
  if (excludedSpecialCourses.length > 0) {
    warnings.push(
      "特殊科目の一部は、既存の履修状態と卒業要件上の単位対応が未確定なため試算に含めていません。",
    );
  }
  if (multiGroupCourses.length > 0) {
    warnings.push(
      "複数の要件記号に属する科目があり、総合判定では重複算入ルールの確認が必要です。",
    );
  }
  if (unknownPlacementIds.length > 0) {
    warnings.push("卒業設計用カリキュラムで確認できない配置は試算から除外しました。");
  }

  return {
    totalCredits,
    requiredCourses: requiredCourseProgress,
    selectableRequired,
    requirementGroups,
    electiveRequirements,
    selectableRequiredExcess: {
      earnedCredits: excess.earned,
      currentIncludedCredits: excess.currentIncluded,
      plannedIncludedCredits: excess.plannedIncluded,
      canCountTowardElectives:
        requirements.excessSelectableRequiredTreatment.canCountTowardElectives,
      allocationRequiresConfirmation:
        requirements.excessSelectableRequiredTreatment.allocation ===
        "requires_official_confirmation",
      note: requirements.excessSelectableRequiredTreatment.note,
    },
    hasUnknownFirstSemesterStatus,
    excludedSpecialCourses,
    warnings,
  };
}

export function getGraduationRequirementShortfalls(
  progress: GraduationRequirementProgress,
): Array<{ id: string; label: string; amount: number; unit: "単位" | "科目" }> {
  const creditRequirements = [
    progress.totalCredits,
    progress.selectableRequired,
    ...progress.requirementGroups,
    ...progress.electiveRequirements,
  ];
  const shortfalls: Array<{
    id: string;
    label: string;
    amount: number;
    unit: "単位" | "科目";
  }> = creditRequirements
    .filter((item) => item.status === "shortfall" && item.projectedShortfall > 0)
    .map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.projectedShortfall,
      unit: "単位" as const,
    }));
  return shortfalls;
}
