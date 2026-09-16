import syllabusJson from "./syllabus.json";
import type { SyllabusCatalog, SyllabusData } from "../../domain/syllabus";

export const syllabusCatalog = syllabusJson as SyllabusCatalog;

export function getSyllabusByCourseId(courseId: string): SyllabusData | null {
  return syllabusCatalog[courseId] ?? null;
}
