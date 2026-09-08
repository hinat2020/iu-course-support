import type { Course } from "../../domain/course";
import type { GraduationRequirementsData } from "../../domain/requirements";
import type { CourseOffering } from "../../domain/timetable";
import type { RegistrationRules } from "../../domain/cap";
import coursePlanningJson from "./course-planning.json";
import coursesJson from "./courses.json";
import graduationRequirementsJson from "./graduation-requirements.json";
import registrationRulesJson from "./registration-rules.json";
import timetableJson from "./timetable.json";

const courses = coursesJson as Course[];
const offerings = timetableJson as CourseOffering[];

export const coursePlanningData = coursePlanningJson;
export const graduationRequirements =
  graduationRequirementsJson as GraduationRequirementsData;
export const registrationRules = registrationRulesJson as RegistrationRules;

const courseById = new Map(courses.map((course) => [course.id, course]));

export const candidateCourses = coursePlanningJson.candidateCourseIds.map(
  (courseId) => {
    const course = courseById.get(courseId);

    if (!course) {
      throw new Error(`Candidate course not found: ${courseId}`);
    }

    if (course.specialCourseType) {
      throw new Error(`Special course cannot be a Phase 4 candidate: ${courseId}`);
    }

    return course;
  },
);

const candidateCourseIds = new Set(candidateCourses.map((course) => course.id));

export const candidateOfferings = offerings.filter((offering) =>
  candidateCourseIds.has(offering.courseId),
);
