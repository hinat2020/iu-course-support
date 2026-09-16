export type SyllabusLessonPlanItem = {
  number: string | number | null;
  topic: string | null;
  content: string | null;
};

export type SyllabusSource = {
  type: "official_syllabus";
  academicYear: 2026;
  documentName: string;
  pages: number[];
  sha256: string;
};

export type SyllabusData = {
  academicYear: 2026;
  courseCode: string | null;
  courseName: string;
  grade: string | null;
  semester: string | null;
  category: string | null;
  credits: number | null;
  requiredElective: string | null;
  classFormat: string | null;
  instructor: string | null;
  activeLearning: string | null;
  overview: string | null;
  objectives: string | null;
  lessonPlan: SyllabusLessonPlanItem[] | null;
  grading: string | null;
  preparation: string | null;
  textbooks: string | null;
  references: string | null;
  notes: string | null;
  previousYearReflection: string | null;
  source: SyllabusSource;
};

export type SyllabusCatalog = Readonly<Record<string, SyllabusData>>;
