import type { Course } from "../../domain/course";
import type { TimetableModel } from "../../domain/timetable";
import type { EnglishTrack } from "../../domain/user";
import coursesJson from "./courses.json";
import setupJson from "./first-semester-setup.json";

type SetupCourseReference = {
  courseId: string;
  credits: number;
};

const courses = coursesJson as Course[];
const coursesById = new Map(courses.map((course) => [course.id, course]));

function resolveCourses(
  references: readonly SetupCourseReference[],
): readonly Course[] {
  return references.map((reference) => {
    const course = coursesById.get(reference.courseId);

    if (!course) {
      throw new Error(`Course not found: ${reference.courseId}`);
    }

    if (course.credits !== reference.credits) {
      throw new Error(`Course credits mismatch: ${reference.courseId}`);
    }

    return course;
  });
}

export const firstSemesterSetupData = setupJson;
export const timetableModelChoices = setupJson.basicSetup.timetableModels.map(
  (value) => ({ value: value as TimetableModel, label: `${value}モデル` }),
);
export const englishTrackChoices = setupJson.basicSetup.englishTracks as {
  value: EnglishTrack;
  label: string;
}[];
export const innovationMethodModuleChoices = setupJson.innovationMethod
  .moduleTypes as {
  value: "lecture" | "event" | "unknown";
  label: string;
}[];
export const firstSemesterRequiredCourses = resolveCourses(
  setupJson.firstSemester.requiredCourses,
);
export const firstSemesterElectiveCourses = resolveCourses(
  setupJson.firstSemester.electiveCourses,
);
