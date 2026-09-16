import type { CurriculumData } from "../../domain/graduationPlanning";
import curriculumJson from "./curriculum.json";

export const curriculumData = curriculumJson as CurriculumData;
export const curriculumCourses = curriculumData.courses;
export const curriculumCoursesById = new Map(
  curriculumCourses.map((course) => [course.courseId, course]),
);

export const plannableCurriculumCourses = curriculumCourses.filter(
  (course) => course.planningAvailability === "standard",
);

export const manuallyPlannableCurriculumCourses = plannableCurriculumCourses.filter(
  (course) => course.requirementType !== "required",
);
