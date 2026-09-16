import type { AnnualCapRule, CapGrade } from "./cap";
import type { GraduationSemesterId } from "./graduationPlanning";

export type GraduationCapStatus =
  | "within_limit"
  | "at_limit"
  | "over_limit"
  | "unknown";

export type GraduationCapCourse = {
  courseId: string;
  credits: number;
};

export type GraduationSemesterCapInput = {
  semesterId: GraduationSemesterId;
  courses: readonly GraduationCapCourse[];
  creditsKnown: boolean;
};

export type GraduationYearCapResult = {
  grade: CapGrade;
  springCredits: number | null;
  fallCredits: number | null;
  annualCredits: number | null;
  limit: number | null;
  status: GraduationCapStatus;
  sourceConfirmed: boolean;
  warnings: string[];
};

const grades = [1, 2, 3, 4] as const;

function sumUniqueCourses(
  courses: readonly GraduationCapCourse[],
  alreadyCounted: ReadonlySet<string> = new Set(),
) {
  const seen = new Set(alreadyCounted);
  let credits = 0;
  for (const course of courses) {
    if (seen.has(course.courseId)) continue;
    seen.add(course.courseId);
    credits += course.credits;
  }
  return { credits, courseIds: seen };
}

export function calculateGraduationYearCap({
  grade,
  spring,
  fall,
  rule,
}: {
  grade: CapGrade;
  spring: GraduationSemesterCapInput;
  fall: GraduationSemesterCapInput;
  rule: AnnualCapRule | undefined;
}): GraduationYearCapResult {
  const springTotal = sumUniqueCourses(spring.courses);
  const fallTotal = sumUniqueCourses(fall.courses, springTotal.courseIds);
  const springCredits = spring.creditsKnown ? springTotal.credits : null;
  const fallCredits = fall.creditsKnown ? fallTotal.credits : null;
  const annualCredits = springCredits === null || fallCredits === null
    ? null
    : springCredits + fallCredits;
  const sourceConfirmed = rule?.sourceConfirmed === true;
  const limit = sourceConfirmed ? rule.limit : null;
  const warnings: string[] = [];

  if (annualCredits === null) {
    warnings.push("履修登録状況に未確認項目があるため、年間CAPを判定できません。");
  }
  if (limit === null) {
    warnings.push("CAP上限の公式情報を確認できないため判定できません。");
  }

  let status: GraduationCapStatus = "unknown";
  if (annualCredits !== null && limit !== null) {
    status = annualCredits < limit
      ? "within_limit"
      : annualCredits === limit
        ? "at_limit"
        : "over_limit";
    if (status === "over_limit") {
      warnings.push(
        `計画上、年間履修上限を${annualCredits - limit}単位超えています。`,
      );
    }
  }

  return {
    grade,
    springCredits,
    fallCredits,
    annualCredits,
    limit,
    status,
    sourceConfirmed,
    warnings,
  };
}

export function calculateGraduationCapPlan({
  semesters,
  rules,
}: {
  semesters: readonly GraduationSemesterCapInput[];
  rules: readonly AnnualCapRule[];
}): GraduationYearCapResult[] {
  const semesterMap = new Map(
    semesters.map((semester) => [semester.semesterId, semester]),
  );
  return grades.map((grade) => {
    const springId = `year${grade}-spring` as GraduationSemesterId;
    const fallId = `year${grade}-fall` as GraduationSemesterId;
    return calculateGraduationYearCap({
      grade,
      spring: semesterMap.get(springId) ?? {
        semesterId: springId,
        courses: [],
        creditsKnown: true,
      },
      fall: semesterMap.get(fallId) ?? {
        semesterId: fallId,
        courses: [],
        creditsKnown: true,
      },
      rule: rules.find((candidate) => candidate.grade === grade),
    });
  });
}

export function getGraduationCapWarnings(
  results: readonly GraduationYearCapResult[],
): string[] {
  return results.flatMap((result) =>
    result.warnings.map((warning) => `${result.grade}年次: ${warning}`),
  );
}
