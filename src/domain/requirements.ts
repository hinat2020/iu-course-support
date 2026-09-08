import type { Course } from "./course";
import type { FirstSemesterState } from "./user";

export type GraduationRequirement = {
  id: string;
  symbol: string;
  label: string;
  requiredCredits: number;
};

export type GraduationRequirementsData = {
  academicYear: 2026;
  requirements: GraduationRequirement[];
};

export type RequirementProgress = {
  groupId: string;
  symbol: string;
  label: string;
  earnedCredits: number;
  requiredCredits: number;
  remainingCredits: number;
  completed: boolean;
};

export type CalculateRequirementProgressInput = {
  firstSemester: FirstSemesterState;
  firstSemesterCourses: readonly Course[];
  requirements: readonly GraduationRequirement[];
};

export type RequirementContribution = {
  groupId: string;
  symbol: string;
  label: string;
  currentCredits: number;
  creditsIfEarned: number;
  requiredCredits: number;
};

export function calculateRequirementProgress({
  firstSemester,
  firstSemesterCourses,
  requirements,
}: CalculateRequirementProgressInput): RequirementProgress[] {
  const earnedByGroup = new Map<string, number>();

  for (const course of firstSemesterCourses) {
    const record = firstSemester.courses[course.id];

    if (record?.status !== "earned" || !record.confirmedByUser) continue;

    for (const groupId of course.requirementGroups) {
      earnedByGroup.set(
        groupId,
        (earnedByGroup.get(groupId) ?? 0) + course.credits,
      );
    }
  }

  return requirements.map((requirement) => {
    const earnedCredits = earnedByGroup.get(requirement.id) ?? 0;
    const remainingCredits = Math.max(
      0,
      requirement.requiredCredits - earnedCredits,
    );

    return {
      groupId: requirement.id,
      symbol: requirement.symbol,
      label: requirement.label,
      earnedCredits,
      requiredCredits: requirement.requiredCredits,
      remainingCredits,
      completed: remainingCredits === 0,
    };
  });
}

export function calculateRequirementContribution(
  course: Course,
  progress: readonly RequirementProgress[],
): RequirementContribution[] {
  const progressById = new Map(
    progress.map((item) => [item.groupId, item]),
  );

  return course.requirementGroups.flatMap((groupId) => {
    const item = progressById.get(groupId);
    if (!item) return [];

    return [
      {
        groupId,
        symbol: item.symbol,
        label: item.label,
        currentCredits: item.earnedCredits,
        creditsIfEarned: item.earnedCredits + course.credits,
        requiredCredits: item.requiredCredits,
      },
    ];
  });
}
