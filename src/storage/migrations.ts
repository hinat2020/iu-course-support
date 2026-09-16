import {
  createEmptyLotteryApplication,
  type LotteryApplication,
} from "../domain/lottery";
import {
  createInitialInnovationLectureState,
  createInitialInnovationMethodState,
} from "../domain/innovation";
import { createInitialState, type AppState } from "../state/initialState";
import {
  isAppStateV4,
  isAppState,
  isAppStateV5Base,
  isAppStateV1,
  isAppStateV2,
  isAppStateV3,
  type AppStateV4,
  type AppStateV1,
  type AppStateV2,
  type AppStateV3,
  type LegacyLotteryApplication,
} from "./schema";
import { plannableCurriculumCourses } from "../data/2026/curriculum";
import {
  createEmptyGraduationPlan,
  sanitizeGraduationPlan,
} from "../domain/graduationPlanning";

const plannableGraduationCourseIds = new Set(
  plannableCurriculumCourses.map((course) => course.courseId),
);

function migrateLottery(
  legacy: LegacyLotteryApplication,
): LotteryApplication {
  if (legacy.status === "candidate" || legacy.status === "not_applied") {
    return {
      ...createEmptyLotteryApplication(legacy.courseId),
      preferences: legacy.preferences.map((preference) => ({
        ...preference,
        scheduleOptionId: null,
      })),
    };
  }

  return {
    courseId: legacy.courseId,
    applicationStatus: "applied",
    preferences: legacy.preferences.map((preference) => ({
      ...preference,
      scheduleOptionId: null,
    })),
    resultStatus:
      legacy.status === "won" || legacy.status === "lost"
        ? legacy.status
        : "pending",
    wonOfferingId:
      legacy.status === "won" ? legacy.wonOfferingId : null,
    wonScheduleOptionId: null,
    registrationConfirmation: "unconfirmed",
  };
}

function migrateV4(state: AppStateV4): AppState {
  const migrated: AppState = {
    ...state,
    schemaVersion: 5,
    graduationPlan: createEmptyGraduationPlan(),
  };

  return isAppState(migrated) ? migrated : createInitialState();
}

function migrateV3(state: AppStateV3): AppState {
  const migrated: AppStateV4 = {
    ...state,
    schemaVersion: 4,
    innovationLecture: {
      ...createInitialInnovationLectureState(),
      previousEarnedCount: state.innovationLecture.previousEarnedCount,
    },
    innovationMethod: createInitialInnovationMethodState(),
  };

  return isAppStateV4(migrated) ? migrateV4(migrated) : createInitialState();
}

function migrateV2(state: AppStateV2): AppState {
  const lotteries = Object.fromEntries(
    Object.entries(state.lotteries).map(([courseId, application]) => [
      courseId,
      migrateLottery(application),
    ]),
  );
  const v3: AppStateV3 = {
    ...state,
    schemaVersion: 3,
    lotteries,
  };

  return migrateV3(v3);
}

function migrateV1(state: AppStateV1): AppState {
  const v2: AppStateV2 = {
    ...state,
    schemaVersion: 2,
    firstSemester: {
      ...state.firstSemester,
      innovationMethod: {
        ...state.firstSemester.innovationMethod,
        moduleType: null,
        confirmedByUser: false,
      },
    },
  };

  return migrateV2(v2);
}

export function migrateState(raw: unknown): AppState {
  if (isAppState(raw)) return raw;
  if (isAppStateV5Base(raw)) {
    return {
      ...raw,
      graduationPlan: sanitizeGraduationPlan(
        raw.graduationPlan,
        plannableGraduationCourseIds,
      ),
    };
  }
  if (isAppStateV4(raw)) return migrateV4(raw);
  if (isAppStateV3(raw)) return migrateV3(raw);
  if (isAppStateV2(raw)) return migrateV2(raw);
  if (isAppStateV1(raw)) return migrateV1(raw);
  return createInitialState();
}
