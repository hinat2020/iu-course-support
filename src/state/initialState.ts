import type {
  InnovationLectureState,
  InnovationMethodState,
} from "../domain/innovation";
import {
  createInitialInnovationLectureState,
  createInitialInnovationMethodState,
} from "../domain/innovation";
import type { LotteryApplication } from "../domain/lottery";
import type { UserProfile, FirstSemesterState } from "../domain/user";

export type AppState = {
  schemaVersion: 4;
  setupCompleted: boolean;
  user: UserProfile;
  firstSemester: FirstSemesterState;
  plannedCourses: Record<string, { selected: boolean }>;
  lotteries: Record<string, LotteryApplication>;
  innovationLecture: InnovationLectureState;
  innovationMethod: InnovationMethodState;
  ui: {
    lastVisitedPage?: string;
  };
};

export function createInitialState(): AppState {
  return {
    schemaVersion: 4,
    setupCompleted: false,
    user: {
      academicYear: 2026,
      admissionYear: 2026,
      grade: 1,
      semester: "second",
      timetableModel: null,
      englishTrack: null,
      normalEnglishSection: null,
    },
    firstSemester: {
      requiredCoursesConfirmed: false,
      courses: {},
      innovationMethod: {
        registeredInFirstSemester: "unknown",
        moduleType: null,
        confirmedByUser: false,
      },
    },
    plannedCourses: {},
    lotteries: {},
    innovationLecture: createInitialInnovationLectureState(),
    innovationMethod: createInitialInnovationMethodState(),
    ui: {},
  };
}

export const initialState: AppState = createInitialState();
