import type { Course } from "./course";
import {
  evaluateScheduleOptions,
  getOfferingSlots,
  resolveCandidateOffering,
  type ScheduleOptionsEvaluation,
  type ScheduledCourse,
} from "./coursePlanning";
import type { GeneratedRequiredCourse } from "./requiredTimetable";
import type {
  CourseOffering,
  TimetableModel,
} from "./timetable";

export type LotteryCourseContext = {
  course: Course;
  offering: CourseOffering;
  scheduleEvaluation: ScheduleOptionsEvaluation;
};

export type BuildLotteryCourseContextsInput = {
  courses: readonly Course[];
  offerings: readonly CourseOffering[];
  requiredCourses: readonly GeneratedRequiredCourse[];
  timetableModel: TimetableModel;
  academicYear: number;
  semester: "second";
};

export function buildLotteryCourseContexts({
  courses,
  offerings,
  requiredCourses,
  timetableModel,
  academicYear,
  semester,
}: BuildLotteryCourseContextsInput): LotteryCourseContext[] {
  const resolved = courses.map((course) => ({
    course,
    offering: resolveCandidateOffering({
      courseId: course.id,
      timetableModel,
      academicYear,
      semester,
      offerings,
    }),
  }));
  const requiredSchedules: ScheduledCourse[] = requiredCourses.map(
    ({ course, offering }) => ({
      courseId: course.id,
      courseName: course.name,
      slots: offering.slots,
    }),
  );

  return resolved.map(({ course, offering }) => {
    const otherCandidateSchedules: ScheduledCourse[] = resolved
      .filter((candidate) => candidate.course.id !== course.id)
      .map((candidate) => ({
        courseId: candidate.course.id,
        courseName: candidate.course.name,
        slots: getOfferingSlots(candidate.offering),
      }));

    return {
      course,
      offering,
      scheduleEvaluation: evaluateScheduleOptions(offering, [
        ...requiredSchedules,
        ...otherCandidateSchedules,
      ]),
    };
  });
}
