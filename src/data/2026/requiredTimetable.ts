import type { Course } from "../../domain/course";
import type { CourseOffering } from "../../domain/timetable";
import coursesJson from "./courses.json";
import timetableJson from "./timetable.json";

export const courseCatalog = coursesJson as Course[];
export const courseOfferings = timetableJson as CourseOffering[];
