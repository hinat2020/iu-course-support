import type {
  LotteryApplicationStatus,
  LotteryPreference,
  RegistrationConfirmationStatus,
} from "../domain/lottery";
import type {
  InnovationLecturePreference,
  InnovationMiniCourseStatus,
  SpecialLotteryApplicationStatus,
} from "../domain/innovation";
import type { TimetableModel } from "../domain/timetable";
import type {
  EnglishTrack,
  PreviousCourseStatus,
} from "../domain/user";

export type FirstSemesterInnovationRegistration = true | false | "unknown";
export type FirstSemesterInnovationModuleType =
  | "lecture"
  | "event"
  | "unknown"
  | null;

export type AppAction =
  | { type: "SET_TIMETABLE_MODEL"; payload: TimetableModel }
  | { type: "SET_ENGLISH_TRACK"; payload: EnglishTrack }
  | {
      type: "SET_PREVIOUS_COURSE_STATUS";
      payload: { courseId: string; status: PreviousCourseStatus };
    }
  | {
      type: "SET_PREVIOUS_COURSE_CONFIRMED";
      payload: { courseId: string; confirmedByUser: boolean };
    }
  | { type: "SET_REQUIRED_COURSES_CONFIRMED"; payload: boolean }
  | {
      type: "SET_ALL_REQUIRED_COURSES_EARNED";
      payload: { courseIds: string[] };
    }
  | {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION";
      payload: FirstSemesterInnovationRegistration;
    }
  | {
      type: "SET_FIRST_SEMESTER_INNOVATION_MODULE_TYPE";
      payload: FirstSemesterInnovationModuleType;
    }
  | { type: "SELECT_COURSE"; payload: string }
  | { type: "UNSELECT_COURSE"; payload: string }
  | {
      type: "SET_LOTTERY_APPLICATION_STATUS";
      payload: {
        courseId: string;
        status: LotteryApplicationStatus;
        preferences?: LotteryPreference[];
      };
    }
  | {
      type: "SET_LOTTERY_PREFERENCES";
      payload: { courseId: string; preferences: LotteryPreference[] };
    }
  | {
      type: "SET_LOTTERY_RESULT";
      payload: {
        courseId: string;
        result: "won" | "lost";
        wonOfferingId: string | null;
        wonScheduleOptionId?: string | null;
      };
    }
  | {
      type: "SET_LOTTERY_REGISTRATION_CONFIRMATION";
      payload: {
        courseId: string;
        status: RegistrationConfirmationStatus;
      };
    }
  | { type: "RESET_LOTTERY_APPLICATION"; payload: string }
  | { type: "UNSELECT_COURSE_AND_RESET_LOTTERY"; payload: string }
  | {
      type: "SET_INNOVATION_LECTURE_PREVIOUS_EARNED_COUNT";
      payload: 0 | 1 | 2;
    }
  | {
      type: "SET_INNOVATION_LECTURE_PREFERENCES";
      payload: InnovationLecturePreference[];
    }
  | {
      type: "SET_INNOVATION_LECTURE_APPLICATION_STATUS";
      payload: SpecialLotteryApplicationStatus;
    }
  | {
      type: "SET_INNOVATION_LECTURE_RESULT";
      payload: { result: "won" | "lost"; wonClassId?: string | null };
    }
  | {
      type: "SET_INNOVATION_LECTURE_REGISTRATION_CONFIRMATION";
      payload: RegistrationConfirmationStatus;
    }
  | {
      type: "SET_INNOVATION_METHOD_PREVIOUS_EARNED_COUNT";
      payload: 0 | 1 | 2;
    }
  | {
      type: "SET_INNOVATION_METHOD_APPLICATION_STATUS";
      payload: SpecialLotteryApplicationStatus;
    }
  | {
      type: "SET_INNOVATION_METHOD_RESULT";
      payload: "won" | "lost";
    }
  | {
      type: "SET_INNOVATION_METHOD_REGISTRATION_CONFIRMATION";
      payload: RegistrationConfirmationStatus;
    }
  | {
      type: "SET_INNOVATION_METHOD_MINI_COURSE_STATUS";
      payload: {
        academicYear: number;
        miniCourseId: string;
        status: InnovationMiniCourseStatus | null;
      };
    }
  | {
      type: "SET_INNOVATION_METHOD_MINI_COURSE_CREDIT_USE";
      payload: {
        academicYear: number;
        miniCourseId: string;
        alreadyUsedForCredit: "a" | "b" | null;
      };
    }
  | {
      type: "SET_INNOVATION_METHOD_EVENT";
      payload: string | null;
    }
  | {
      type: "SET_INNOVATION_METHOD_ESTIMATED_HOURS";
      payload: number | undefined;
    }
  | { type: "SET_SETUP_COMPLETED"; payload: boolean }
  | { type: "RESET_APP" };
