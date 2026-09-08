import type { Course } from "./course";
import type { FirstSemesterState } from "./user";

export type RegistrationRules = {
  academicYear: 2026;
  grade: 1;
  annualCap: number;
};

export type CapResult = {
  firstSemesterRegistered: number | null;
  secondSemesterConfirmed: number;
  candidateCredits: number;
  wonCredits: number;
  confirmedAnnualCredits: number | null;
  maximumAnnualCredits: number | null;
  resultReflectedAnnualCredits: number | null;
  limit: number;
  exceeded: boolean | null;
  resultExceeded: boolean | null;
};

export type CalculateCapInput = {
  firstSemester: FirstSemesterState;
  firstSemesterCourses: readonly Course[];
  requiredSecondSemesterCourses: readonly Course[];
  selectedCandidateCourses: readonly Course[];
  wonCandidateCourses?: readonly Course[];
  capLimit: number;
};

function sumCredits(courses: readonly Course[]): number {
  return courses.reduce((total, course) => total + course.credits, 0);
}

export function calculateCap({
  firstSemester,
  firstSemesterCourses,
  requiredSecondSemesterCourses,
  selectedCandidateCourses,
  wonCandidateCourses = [],
  capLimit,
}: CalculateCapInput): CapResult {
  let firstSemesterRegistered = 0;
  let hasUnknownRegistration = false;

  for (const course of firstSemesterCourses) {
    const record = firstSemester.courses[course.id];

    if (
      !record ||
      !record.confirmedByUser ||
      record.status === "unknown"
    ) {
      hasUnknownRegistration = true;
      continue;
    }

    if (record.status === "earned" || record.status === "failed") {
      firstSemesterRegistered += course.credits;
    }
  }

  const secondSemesterConfirmed = sumCredits(requiredSecondSemesterCourses);
  const candidateCredits = sumCredits(
    selectedCandidateCourses.filter((course) => !course.specialCourseType),
  );
  const wonCredits = sumCredits(
    wonCandidateCourses.filter((course) => !course.specialCourseType),
  );

  if (hasUnknownRegistration) {
    return {
      firstSemesterRegistered: null,
      secondSemesterConfirmed,
      candidateCredits,
      wonCredits,
      confirmedAnnualCredits: null,
      maximumAnnualCredits: null,
      resultReflectedAnnualCredits: null,
      limit: capLimit,
      exceeded: null,
      resultExceeded: null,
    };
  }

  const confirmedAnnualCredits =
    firstSemesterRegistered + secondSemesterConfirmed;
  const maximumAnnualCredits = confirmedAnnualCredits + candidateCredits;
  const resultReflectedAnnualCredits = confirmedAnnualCredits + wonCredits;

  return {
    firstSemesterRegistered,
    secondSemesterConfirmed,
    candidateCredits,
    wonCredits,
    confirmedAnnualCredits,
    maximumAnnualCredits,
    resultReflectedAnnualCredits,
    limit: capLimit,
    exceeded: maximumAnnualCredits > capLimit,
    resultExceeded: resultReflectedAnnualCredits > capLimit,
  };
}
