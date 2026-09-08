import type { Course } from "./course";
import type { CourseOffering, TimetableModel } from "./timetable";
import type { EnglishTrack } from "./user";

export type GeneratedRequiredCourse = {
  course: Course;
  offering: CourseOffering;
};

export type GeneratedRequiredTimetable = {
  model: TimetableModel;
  englishTrack: EnglishTrack;
  courses: GeneratedRequiredCourse[];
  totalCredits: number;
};

export type GenerateRequiredTimetableInput = {
  timetableModel: TimetableModel;
  englishTrack: EnglishTrack;
  academicYear: number;
  grade: number;
  semester: "second";
  courses: readonly Course[];
  offerings: readonly CourseOffering[];
};

export function generateRequiredTimetable({
  timetableModel,
  englishTrack,
  academicYear,
  grade,
  semester,
  courses,
  offerings,
}: GenerateRequiredTimetableInput): GeneratedRequiredTimetable {
  const requiredCourses = courses.filter(
    (course) =>
      course.requirementType === "required" &&
      course.grade === grade &&
      (course.semester === semester || course.semester === "both"),
  );

  const generatedCourses = requiredCourses.map((course) => {
    const matchingOfferings = offerings.filter((offering) => {
      if (
        offering.courseId !== course.id ||
        offering.academicYear !== academicYear ||
        offering.semester !== semester
      ) {
        return false;
      }

      if (offering.englishTrack !== undefined) {
        return (
          offering.englishTrack === englishTrack &&
          (offering.model === timetableModel || offering.model === "ALL")
        );
      }

      return offering.model === timetableModel;
    });

    if (matchingOfferings.length === 0) {
      throw new Error(
        `Required offering not found: ${course.id} (${timetableModel}/${englishTrack})`,
      );
    }

    if (matchingOfferings.length > 1) {
      throw new Error(
        `Required offering is ambiguous: ${course.id} (${timetableModel}/${englishTrack})`,
      );
    }

    return { course, offering: matchingOfferings[0] };
  });

  return {
    model: timetableModel,
    englishTrack,
    courses: generatedCourses,
    totalCredits: generatedCourses.reduce(
      (total, generated) => total + generated.course.credits,
      0,
    ),
  };
}
