import type { TimetableModel } from "./timetable";

export type EnglishTrack = "normal" | "advanced";

export type PreviousCourseStatus =
  | "earned"
  | "failed"
  | "not_taken"
  | "unknown";

export type UserCourseRecord = {
  courseId: string;
  status: PreviousCourseStatus;
  confirmedByUser: boolean;
};

export type FirstSemesterState = {
  requiredCoursesConfirmed: boolean;
  courses: Record<string, UserCourseRecord>;
  innovationMethod: {
    registeredInFirstSemester: true | false | "unknown";
    moduleType: "lecture" | "event" | "unknown" | null;
    confirmedByUser: boolean;
  };
};

export type UserProfile = {
  academicYear: 2026;
  admissionYear: 2026;
  grade: 1;
  semester: "second";
  timetableModel: TimetableModel | null;
  englishTrack: EnglishTrack | null;
  normalEnglishSection?: string | null;
};
