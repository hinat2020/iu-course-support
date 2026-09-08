import type { SpecialCoursesData } from "../../domain/innovation";
import specialCoursesJson from "./special-courses.json";

export const specialCoursesData = specialCoursesJson as SpecialCoursesData;

if (
  specialCoursesData.specialLottery.registrationMethod !== "special_lottery" ||
  specialCoursesData.innovationLecture.registrationMethod !== "special_lottery" ||
  specialCoursesData.innovationMethod.registrationMethod !== "special_lottery"
) {
  throw new Error("Special course registration method must be special_lottery");
}

if (
  new Set(
    specialCoursesData.innovationLecture.classes.map((item) => item.id),
  ).size !== specialCoursesData.innovationLecture.classes.length
) {
  throw new Error("Duplicate innovation lecture class id");
}

if (
  new Set(
    specialCoursesData.innovationMethod.lecture.miniCourses.map(
      (item) => item.id,
    ),
  ).size !== specialCoursesData.innovationMethod.lecture.miniCourses.length
) {
  throw new Error("Duplicate innovation mini-course id");
}
