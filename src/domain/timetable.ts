import type { EnglishTrack } from "./user";

export type TimetableModel = "A" | "B" | "C" | "D" | "E";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

export type Period = 1 | 2 | 3 | 4 | 5 | 6;

export type TimeSlot = {
  day: Weekday;
  period: Period;
};

export type RegistrationMethod =
  | "automatic"
  | "lottery"
  | "special_lottery"
  | "office_procedure";

export type ScheduleOption = {
  id: string;
  label: string;
  slots: TimeSlot[];
};

export type ScheduleException = {
  type: "special_date" | "special_period" | "variable_schedule";
  startDate?: string;
  endDate?: string;
  note: string;
};

export type CourseOffering = {
  id: string;
  courseId: string;
  academicYear: number;
  semester: "second";
  model: TimetableModel | "ALL";
  englishTrack?: EnglishTrack;
  slots: TimeSlot[];
  scheduleOptions?: ScheduleOption[];
  scheduleExceptions?: ScheduleException[];
  instructor?: string;
  room?: string;
  variant?: string;
  registrationMethod: RegistrationMethod;
  notes?: string[];
};
