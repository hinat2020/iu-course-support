import type { CapResult } from "./cap";
import type { Course } from "./course";
import type { RequirementProgress } from "./requirements";
import type {
  CourseOffering,
  RegistrationMethod,
  ScheduleOption,
  TimeSlot,
  TimetableModel,
} from "./timetable";

export type ScheduledCourse = {
  courseId: string;
  courseName: string;
  slots: readonly TimeSlot[];
};

export type ConflictCourse = {
  courseId: string;
  courseName: string;
};

export type EvaluatedScheduleOption = {
  id: string;
  label: string;
  slots: readonly TimeSlot[];
  hasConflict: boolean;
  conflictsWith: ConflictCourse[];
};

export type ScheduleOptionsEvaluation = {
  allOptionsConflict: boolean;
  hasAnyConflict: boolean;
  availableOptions: string[];
  conflictingOptions: string[];
  conflictsWith: string[];
  options: EvaluatedScheduleOption[];
};

export type CandidateCourseDecision = {
  courseId: string;
  eligibility: "eligible" | "ineligible" | "needs_confirmation";
  timetable: ScheduleOptionsEvaluation;
  cap: {
    currentCredits: number | null;
    creditsAfterAdding: number | null;
    limit: number;
    exceeded: boolean | null;
  };
  requirements: {
    groups: string[];
    credits: number;
  };
  registration: {
    method: RegistrationMethod;
  };
  warnings: string[];
};

export type ResolveCandidateOfferingInput = {
  courseId: string;
  timetableModel: TimetableModel;
  academicYear: number;
  semester: "second";
  offerings: readonly CourseOffering[];
};

function isSameSlot(left: TimeSlot, right: TimeSlot): boolean {
  return left.day === right.day && left.period === right.period;
}

export function detectTimetableConflicts(
  existingCourses: readonly ScheduledCourse[],
  candidateSlots: readonly TimeSlot[],
): ConflictCourse[] {
  const conflicts = new Map<string, ConflictCourse>();

  for (const existing of existingCourses) {
    if (
      existing.slots.some((existingSlot) =>
        candidateSlots.some((candidateSlot) =>
          isSameSlot(existingSlot, candidateSlot),
        ),
      )
    ) {
      conflicts.set(existing.courseId, {
        courseId: existing.courseId,
        courseName: existing.courseName,
      });
    }
  }

  return [...conflicts.values()];
}

function asScheduleOptions(offering: CourseOffering): ScheduleOption[] {
  if (offering.scheduleOptions && offering.scheduleOptions.length > 0) {
    return offering.scheduleOptions;
  }

  return [
    {
      id: offering.id,
      label: "固定枠",
      slots: offering.slots,
    },
  ];
}

export function evaluateScheduleOptions(
  offering: CourseOffering,
  existingCourses: readonly ScheduledCourse[],
): ScheduleOptionsEvaluation {
  const options = asScheduleOptions(offering).map<EvaluatedScheduleOption>(
    (option) => {
      const conflictsWith = detectTimetableConflicts(
        existingCourses,
        option.slots,
      );

      return {
        ...option,
        hasConflict: conflictsWith.length > 0,
        conflictsWith,
      };
    },
  );
  const conflictingOptions = options
    .filter((option) => option.hasConflict)
    .map((option) => option.id);
  const availableOptions = options
    .filter((option) => !option.hasConflict)
    .map((option) => option.id);
  const conflictsWith = new Set(
    options.flatMap((option) =>
      option.conflictsWith.map((conflict) => conflict.courseId),
    ),
  );

  return {
    allOptionsConflict: options.length > 0 && availableOptions.length === 0,
    hasAnyConflict: conflictingOptions.length > 0,
    availableOptions,
    conflictingOptions,
    conflictsWith: [...conflictsWith],
    options,
  };
}

export function resolveCandidateOffering({
  courseId,
  timetableModel,
  academicYear,
  semester,
  offerings,
}: ResolveCandidateOfferingInput): CourseOffering {
  const matches = offerings.filter(
    (offering) =>
      offering.courseId === courseId &&
      offering.academicYear === academicYear &&
      offering.semester === semester &&
      (offering.model === timetableModel || offering.model === "ALL"),
  );
  const exactMatches = matches.filter(
    (offering) => offering.model === timetableModel,
  );
  const preferredMatches = exactMatches.length > 0 ? exactMatches : matches;

  if (preferredMatches.length === 0) {
    throw new Error(
      `Candidate offering not found: ${courseId} (${timetableModel})`,
    );
  }

  if (preferredMatches.length > 1) {
    throw new Error(
      `Candidate offering is ambiguous: ${courseId} (${timetableModel})`,
    );
  }

  return preferredMatches[0];
}

export function getOfferingSlots(offering: CourseOffering): TimeSlot[] {
  const slots = offering.scheduleOptions?.length
    ? offering.scheduleOptions.flatMap((option) => option.slots)
    : offering.slots;
  const uniqueSlots = new Map(
    slots.map((slot) => [`${slot.day}-${slot.period}`, slot] as const),
  );

  return [...uniqueSlots.values()];
}

export type EvaluateCandidateCourseInput = {
  course: Course;
  offering: CourseOffering;
  existingCourses: readonly ScheduledCourse[];
  cap: CapResult;
  requirementProgress: readonly RequirementProgress[];
  isSelected: boolean;
};

export function evaluateCandidateCourse({
  course,
  offering,
  existingCourses,
  cap,
  requirementProgress,
  isSelected,
}: EvaluateCandidateCourseInput): CandidateCourseDecision {
  const timetable = evaluateScheduleOptions(offering, existingCourses);
  const currentCredits = cap.maximumAnnualCredits;
  const creditsAfterAdding =
    currentCredits === null
      ? null
      : currentCredits + (isSelected ? 0 : course.credits);
  const exceeded =
    creditsAfterAdding === null ? null : creditsAfterAdding > cap.limit;
  const knownRequirementGroups = new Set(
    requirementProgress.map((progress) => progress.groupId),
  );
  const groups = course.requirementGroups.filter((groupId) =>
    knownRequirementGroups.has(groupId),
  );
  const warnings: string[] = [];

  if (timetable.hasAnyConflict && !timetable.allOptionsConflict) {
    warnings.push("一部の授業枠が時間割と重複しています");
  }

  if (timetable.allOptionsConflict) {
    warnings.push("すべての授業枠が時間割と重複しています");
  }

  if (exceeded) {
    warnings.push(
      `この科目を候補に追加すると年間${cap.limit}単位を超える可能性があります`,
    );
  }

  return {
    courseId: course.id,
    eligibility: timetable.allOptionsConflict ? "ineligible" : "eligible",
    timetable,
    cap: {
      currentCredits,
      creditsAfterAdding,
      limit: cap.limit,
      exceeded,
    },
    requirements: {
      groups,
      credits: course.credits,
    },
    registration: {
      method: offering.registrationMethod,
    },
    warnings,
  };
}
