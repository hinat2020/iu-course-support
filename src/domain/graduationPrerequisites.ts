import type {
  CurriculumCourse,
  GraduationBoardCourse,
  GraduationSemesterId,
} from "./graduationPlanning";
import { getGraduationSemesterOrder } from "./graduationPlanning";

export type PrerequisiteRequirementStatus =
  | "earned"
  | "planned_before"
  | "current_unconfirmed"
  | "planned_same_semester"
  | "planned_after"
  | "missing";

export type PrerequisiteCheckStatus =
  | "satisfied"
  | "warning"
  | "not_satisfied"
  | "not_applicable";

export type PrerequisiteRequirementResult = {
  prerequisiteCourseId: string;
  prerequisiteCourseName: string;
  status: PrerequisiteRequirementStatus;
};

export type PrerequisiteCheckResult = {
  courseId: string;
  status: PrerequisiteCheckStatus;
  requirements: PrerequisiteRequirementResult[];
};

export type PrerequisitePlacement = Pick<
  GraduationBoardCourse,
  "course" | "semesterId" | "source" | "status"
>;

function getRequirementStatus(
  placement: PrerequisitePlacement | undefined,
  targetSemesterId: GraduationSemesterId,
): PrerequisiteRequirementStatus {
  if (!placement) return "missing";
  if (placement.status === "earned") return "earned";
  if (placement.source === "current_registration") {
    return "current_unconfirmed";
  }

  const prerequisiteOrder = getGraduationSemesterOrder(placement.semesterId);
  const targetOrder = getGraduationSemesterOrder(targetSemesterId);
  if (prerequisiteOrder < targetOrder) return "planned_before";
  if (prerequisiteOrder === targetOrder) return "planned_same_semester";
  return "planned_after";
}

export function checkCoursePrerequisites({
  course,
  semesterId,
  placements,
  coursesById,
}: {
  course: CurriculumCourse;
  semesterId: GraduationSemesterId;
  placements: readonly PrerequisitePlacement[];
  coursesById: ReadonlyMap<string, CurriculumCourse>;
}): PrerequisiteCheckResult {
  if (course.prerequisites.length === 0) {
    return { courseId: course.courseId, status: "not_applicable", requirements: [] };
  }

  const placementsById = new Map(
    placements.map((placement) => [placement.course.courseId, placement]),
  );
  const requirements = course.prerequisites.map((prerequisiteCourseId) => ({
    prerequisiteCourseId,
    prerequisiteCourseName:
      coursesById.get(prerequisiteCourseId)?.name ?? prerequisiteCourseId,
    status: getRequirementStatus(
      placementsById.get(prerequisiteCourseId),
      semesterId,
    ),
  }));

  if (
    requirements.every(
      ({ status }) => status === "earned" || status === "planned_before",
    )
  ) {
    return { courseId: course.courseId, status: "satisfied", requirements };
  }
  if (requirements.some(({ status }) => status === "current_unconfirmed")) {
    return { courseId: course.courseId, status: "warning", requirements };
  }
  return { courseId: course.courseId, status: "not_satisfied", requirements };
}

export function checkGraduationPlanPrerequisites({
  courses,
  placements,
}: {
  courses: readonly CurriculumCourse[];
  placements: readonly PrerequisitePlacement[];
}): PrerequisiteCheckResult[] {
  const coursesById = new Map(courses.map((course) => [course.courseId, course]));
  return placements
    .filter((placement) => placement.source === "graduation_plan")
    .map((placement) =>
      checkCoursePrerequisites({
        course: placement.course,
        semesterId: placement.semesterId,
        placements,
        coursesById,
      }),
    );
}
