import {
  createEmptyLotteryApplication,
  normalizeLotteryPreferences,
  type LotteryApplication,
} from "../domain/lottery";
import { normalizeInnovationLecturePreferences } from "../domain/innovation";
import type { UserCourseRecord } from "../domain/user";
import type { AppAction } from "./actions";
import { createInitialState, type AppState } from "./initialState";

function getPreviousCourse(
  state: AppState,
  courseId: string,
): UserCourseRecord {
  return (
    state.firstSemester.courses[courseId] ?? {
      courseId,
      status: "unknown",
      confirmedByUser: false,
    }
  );
}

function getLottery(
  state: AppState,
  courseId: string,
): LotteryApplication {
  return (
    state.lotteries[courseId] ?? {
      ...createEmptyLotteryApplication(courseId),
    }
  );
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_TIMETABLE_MODEL":
      return {
        ...state,
        setupCompleted: false,
        user: { ...state.user, timetableModel: action.payload },
      };
    case "SET_ENGLISH_TRACK":
      return {
        ...state,
        setupCompleted: false,
        user: { ...state.user, englishTrack: action.payload },
      };
    case "SET_PREVIOUS_COURSE_STATUS": {
      const { courseId, status } = action.payload;
      return {
        ...state,
        setupCompleted: false,
        firstSemester: {
          ...state.firstSemester,
          courses: {
            ...state.firstSemester.courses,
            [courseId]: {
              ...getPreviousCourse(state, courseId),
              status,
              confirmedByUser: true,
            },
          },
        },
      };
    }
    case "SET_PREVIOUS_COURSE_CONFIRMED": {
      const { courseId, confirmedByUser } = action.payload;
      return {
        ...state,
        setupCompleted: false,
        firstSemester: {
          ...state.firstSemester,
          courses: {
            ...state.firstSemester.courses,
            [courseId]: {
              ...getPreviousCourse(state, courseId),
              confirmedByUser,
            },
          },
        },
      };
    }
    case "SET_REQUIRED_COURSES_CONFIRMED":
      return {
        ...state,
        setupCompleted: false,
        firstSemester: {
          ...state.firstSemester,
          requiredCoursesConfirmed: action.payload,
        },
      };
    case "SET_ALL_REQUIRED_COURSES_EARNED": {
      const courses = { ...state.firstSemester.courses };

      for (const courseId of action.payload.courseIds) {
        courses[courseId] = {
          courseId,
          status: "earned",
          confirmedByUser: true,
        };
      }

      return {
        ...state,
        setupCompleted: false,
        firstSemester: {
          ...state.firstSemester,
          requiredCoursesConfirmed: true,
          courses,
        },
      };
    }
    case "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION":
      return {
        ...state,
        setupCompleted: false,
        firstSemester: {
          ...state.firstSemester,
          innovationMethod: {
            ...state.firstSemester.innovationMethod,
            registeredInFirstSemester: action.payload,
            moduleType:
              action.payload === true
                ? state.firstSemester.innovationMethod.moduleType
                : null,
            confirmedByUser: true,
          },
        },
      };
    case "SET_FIRST_SEMESTER_INNOVATION_MODULE_TYPE":
      return {
        ...state,
        setupCompleted: false,
        firstSemester: {
          ...state.firstSemester,
          innovationMethod: {
            ...state.firstSemester.innovationMethod,
            moduleType:
              state.firstSemester.innovationMethod
                .registeredInFirstSemester === true
                ? action.payload
                : null,
          },
        },
      };
    case "SELECT_COURSE":
      return {
        ...state,
        plannedCourses: {
          ...state.plannedCourses,
          [action.payload]: { selected: true },
        },
      };
    case "UNSELECT_COURSE":
      return {
        ...state,
        plannedCourses: {
          ...state.plannedCourses,
          [action.payload]: { selected: false },
        },
      };
    case "SET_LOTTERY_APPLICATION_STATUS": {
      const { courseId, status } = action.payload;

      if (status === "not_applied") {
        return {
          ...state,
          lotteries: {
            ...state.lotteries,
            [courseId]: createEmptyLotteryApplication(courseId),
          },
        };
      }

      const current = getLottery(state, courseId);
      return {
        ...state,
        lotteries: {
          ...state.lotteries,
          [courseId]: {
            ...current,
            applicationStatus: "applied",
            preferences:
              action.payload.preferences === undefined
                ? current.preferences
                : normalizeLotteryPreferences(action.payload.preferences),
            resultStatus:
              current.applicationStatus === "not_applied"
                ? "pending"
                : (current.resultStatus ?? "pending"),
            wonOfferingId:
              current.applicationStatus === "not_applied"
                ? null
                : current.wonOfferingId,
            wonScheduleOptionId:
              current.applicationStatus === "not_applied"
                ? null
                : current.wonScheduleOptionId,
            registrationConfirmation:
              current.applicationStatus === "not_applied"
                ? "unconfirmed"
                : current.registrationConfirmation,
          },
        },
      };
    }
    case "SET_LOTTERY_PREFERENCES": {
      const { courseId, preferences } = action.payload;
      return {
        ...state,
        lotteries: {
          ...state.lotteries,
          [courseId]: {
            ...getLottery(state, courseId),
            preferences: normalizeLotteryPreferences(preferences),
          },
        },
      };
    }
    case "SET_LOTTERY_RESULT": {
      const { courseId, result, wonOfferingId, wonScheduleOptionId } =
        action.payload;
      const current = getLottery(state, courseId);

      if (current.applicationStatus !== "applied") return state;

      return {
        ...state,
        lotteries: {
          ...state.lotteries,
          [courseId]: {
            ...current,
            resultStatus: result,
            wonOfferingId: result === "won" ? wonOfferingId : null,
            wonScheduleOptionId:
              result === "won" ? (wonScheduleOptionId ?? null) : null,
            registrationConfirmation: "unconfirmed",
          },
        },
      };
    }
    case "SET_LOTTERY_REGISTRATION_CONFIRMATION": {
      const { courseId, status } = action.payload;
      const current = getLottery(state, courseId);

      if (current.resultStatus !== "won") return state;

      return {
        ...state,
        lotteries: {
          ...state.lotteries,
          [courseId]: {
            ...current,
            registrationConfirmation: status,
          },
        },
      };
    }
    case "RESET_LOTTERY_APPLICATION": {
      const lotteries = { ...state.lotteries };
      delete lotteries[action.payload];
      return { ...state, lotteries };
    }
    case "UNSELECT_COURSE_AND_RESET_LOTTERY": {
      const lotteries = { ...state.lotteries };
      delete lotteries[action.payload];
      return {
        ...state,
        plannedCourses: {
          ...state.plannedCourses,
          [action.payload]: { selected: false },
        },
        lotteries,
      };
    }
    case "SET_INNOVATION_LECTURE_PREVIOUS_EARNED_COUNT":
      return {
        ...state,
        innovationLecture: {
          ...state.innovationLecture,
          previousEarnedCount: action.payload,
        },
      };
    case "SET_INNOVATION_LECTURE_PREFERENCES":
      return {
        ...state,
        innovationLecture: {
          ...state.innovationLecture,
          preferences: normalizeInnovationLecturePreferences(action.payload),
        },
      };
    case "SET_INNOVATION_LECTURE_APPLICATION_STATUS": {
      if (action.payload === "not_applied") {
        return {
          ...state,
          innovationLecture: {
            ...state.innovationLecture,
            applicationStatus: "not_applied",
            preferences: [],
            resultStatus: null,
            wonClassId: null,
            registrationConfirmation: "unconfirmed",
          },
        };
      }

      return {
        ...state,
        innovationLecture: {
          ...state.innovationLecture,
          applicationStatus: "applied",
          resultStatus:
            state.innovationLecture.applicationStatus === "not_applied"
              ? "pending"
              : (state.innovationLecture.resultStatus ?? "pending"),
          wonClassId:
            state.innovationLecture.applicationStatus === "not_applied"
              ? null
              : state.innovationLecture.wonClassId,
          registrationConfirmation:
            state.innovationLecture.applicationStatus === "not_applied"
              ? "unconfirmed"
              : state.innovationLecture.registrationConfirmation,
        },
      };
    }
    case "SET_INNOVATION_LECTURE_RESULT": {
      if (state.innovationLecture.applicationStatus !== "applied") return state;
      return {
        ...state,
        innovationLecture: {
          ...state.innovationLecture,
          resultStatus: action.payload.result,
          wonClassId:
            action.payload.result === "won"
              ? (action.payload.wonClassId ?? null)
              : null,
          registrationConfirmation: "unconfirmed",
        },
      };
    }
    case "SET_INNOVATION_LECTURE_REGISTRATION_CONFIRMATION":
      if (state.innovationLecture.resultStatus !== "won") return state;
      return {
        ...state,
        innovationLecture: {
          ...state.innovationLecture,
          registrationConfirmation: action.payload,
        },
      };
    case "SET_INNOVATION_METHOD_PREVIOUS_EARNED_COUNT":
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          previousEarnedCount: action.payload,
        },
      };
    case "SET_INNOVATION_METHOD_APPLICATION_STATUS": {
      if (action.payload === "not_applied") {
        return {
          ...state,
          innovationMethod: {
            ...state.innovationMethod,
            newLectureApplication: {
              applicationStatus: "not_applied",
              resultStatus: null,
              registrationConfirmation: "unconfirmed",
            },
          },
        };
      }

      const current = state.innovationMethod.newLectureApplication;
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          newLectureApplication: {
            applicationStatus: "applied",
            resultStatus:
              current.applicationStatus === "not_applied"
                ? "pending"
                : (current.resultStatus ?? "pending"),
            registrationConfirmation:
              current.applicationStatus === "not_applied"
                ? "unconfirmed"
                : current.registrationConfirmation,
          },
        },
      };
    }
    case "SET_INNOVATION_METHOD_RESULT": {
      const current = state.innovationMethod.newLectureApplication;
      if (current.applicationStatus !== "applied") return state;
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          newLectureApplication: {
            ...current,
            resultStatus: action.payload,
            registrationConfirmation: "unconfirmed",
          },
        },
      };
    }
    case "SET_INNOVATION_METHOD_REGISTRATION_CONFIRMATION": {
      const current = state.innovationMethod.newLectureApplication;
      if (current.resultStatus !== "won") return state;
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          newLectureApplication: {
            ...current,
            registrationConfirmation: action.payload,
          },
        },
      };
    }
    case "SET_INNOVATION_METHOD_MINI_COURSE_STATUS": {
      const { academicYear, miniCourseId, status } = action.payload;
      const records = state.innovationMethod.lectureModule.miniCourses.filter(
        (record) =>
          record.academicYear !== academicYear ||
          record.miniCourseId !== miniCourseId,
      );
      const existing = state.innovationMethod.lectureModule.miniCourses.find(
        (record) =>
          record.academicYear === academicYear &&
          record.miniCourseId === miniCourseId,
      );
      if (status !== null) {
        records.push({
          academicYear,
          miniCourseId,
          status,
          alreadyUsedForCredit:
            status === "passed" ? (existing?.alreadyUsedForCredit ?? null) : null,
        });
      }
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          lectureModule: { miniCourses: records },
        },
      };
    }
    case "SET_INNOVATION_METHOD_MINI_COURSE_CREDIT_USE": {
      const { academicYear, miniCourseId, alreadyUsedForCredit } = action.payload;
      const records = state.innovationMethod.lectureModule.miniCourses.map(
        (record) =>
          record.academicYear === academicYear &&
          record.miniCourseId === miniCourseId &&
          record.status === "passed"
            ? { ...record, alreadyUsedForCredit }
            : record,
      );
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          lectureModule: { miniCourses: records },
        },
      };
    }
    case "SET_INNOVATION_METHOD_EVENT":
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          eventModule: {
            ...state.innovationMethod.eventModule,
            eventId: action.payload,
          },
        },
      };
    case "SET_INNOVATION_METHOD_ESTIMATED_HOURS":
      if (
        action.payload !== undefined &&
        (!Number.isFinite(action.payload) || action.payload < 0)
      ) {
        return state;
      }
      return {
        ...state,
        innovationMethod: {
          ...state.innovationMethod,
          eventModule: {
            ...state.innovationMethod.eventModule,
            estimatedHours: action.payload,
          },
        },
      };
    case "SET_SETUP_COMPLETED":
      return { ...state, setupCompleted: action.payload };
    case "RESET_APP":
      return createInitialState();
  }
}
