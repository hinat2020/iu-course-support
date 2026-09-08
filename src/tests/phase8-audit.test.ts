import { describe, expect, it } from "vitest";
import {
  candidateCourses,
  candidateOfferings,
} from "../data/2026/coursePlanning";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { calculateCap } from "../domain/cap";
import type { Course } from "../domain/course";
import { evaluateScheduleOptions, resolveCandidateOffering } from "../domain/coursePlanning";
import {
  createEmptyLotteryApplication,
  formatLotteryDateTime,
  validateLotteryApplication,
} from "../domain/lottery";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import { migrateState } from "../storage/migrations";
import { selectDashboardSummary, selectHomeTasks } from "../state/dashboardSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";

function makeCourse(id: string, credits: number): Course {
  return {
    id,
    name: id,
    credits,
    requirementType: "elective",
    requirementGroups: [],
    grade: 1,
    semester: "first",
    category: { major: "audit" },
  };
}

function calculateBoundary(total: number) {
  const first = makeCourse("first", total - 14);
  const second = makeCourse("second", 14);
  return calculateCap({
    firstSemester: {
      requiredCoursesConfirmed: true,
      courses: {
        first: {
          courseId: "first",
          status: "earned",
          confirmedByUser: true,
        },
      },
      innovationMethod: {
        registeredInFirstSemester: false,
        moduleType: null,
        confirmedByUser: true,
      },
    },
    firstSemesterCourses: [first],
    requiredSecondSemesterCourses: [second],
    selectedCandidateCourses: [],
    capLimit: 46,
  });
}

function readyState(): AppState {
  let state = appReducer(createInitialState(), {
    type: "SET_TIMETABLE_MODEL",
    payload: "C",
  });
  state = appReducer(state, {
    type: "SET_ENGLISH_TRACK",
    payload: "normal",
  });
  for (const course of [
    ...firstSemesterRequiredCourses,
    ...firstSemesterElectiveCourses,
  ]) {
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: course.id, status: "not_taken" },
    });
  }
  state = appReducer(state, {
    type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
    payload: false,
  });
  return appReducer(state, { type: "SET_SETUP_COMPLETED", payload: true });
}

describe("Phase 8 CAP audit", () => {
  it.each([
    [45, false],
    [46, false],
    [47, true],
  ] as const)("%i / 46のexceededは%s", (credits, exceeded) => {
    expect(calculateBoundary(credits).exceeded).toBe(exceeded);
  });

  it("failedだけでも前期登録単位へ加算する", () => {
    const course = makeCourse("failed-course", 2);
    const result = calculateCap({
      firstSemester: {
        requiredCoursesConfirmed: true,
        courses: {
          [course.id]: {
            courseId: course.id,
            status: "failed",
            confirmedByUser: true,
          },
        },
        innovationMethod: {
          registeredInFirstSemester: false,
          moduleType: null,
          confirmedByUser: true,
        },
      },
      firstSemesterCourses: [course],
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: 46,
    });

    expect(result.firstSemesterRegistered).toBe(2);
  });

  it("未確認またはunknownがあれば年次CAPをnullにする", () => {
    const course = makeCourse("unknown-course", 2);
    const result = calculateCap({
      firstSemester: {
        requiredCoursesConfirmed: false,
        courses: {
          [course.id]: {
            courseId: course.id,
            status: "unknown",
            confirmedByUser: true,
          },
        },
        innovationMethod: {
          registeredInFirstSemester: "unknown",
          moduleType: null,
          confirmedByUser: false,
        },
      },
      firstSemesterCourses: [course],
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: 46,
    });

    expect(result).toMatchObject({
      firstSemesterRegistered: null,
      confirmedAnnualCredits: null,
      maximumAnnualCredits: null,
      resultReflectedAnnualCredits: null,
      exceeded: null,
    });
  });

  it("wonからlostへ変更すると抽選結果反映値から単位を外す", () => {
    let state = appReducer(readyState(), {
      type: "SELECT_COURSE",
      payload: "database",
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: {
        courseId: "database",
        status: "applied",
        preferences: [
          {
            offeringId: "2026-second-database-C",
            scheduleOptionId: null,
            rank: 1,
          },
        ],
      },
    });
    const base = selectDashboardSummary(state).cap?.resultReflectedAnnualCredits;
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "won",
        wonOfferingId: "2026-second-database-C",
      },
    });
    const won = selectDashboardSummary(state).cap?.resultReflectedAnnualCredits;
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "lost",
        wonOfferingId: null,
      },
    });
    const lost = selectDashboardSummary(state).cap?.resultReflectedAnnualCredits;

    expect(won).toBe((base ?? 0) + 2);
    expect(lost).toBe(base);
  });
});

describe("Phase 8 lottery-state audit", () => {
  const database = candidateCourses.find((course) => course.id === "database");
  if (!database) throw new Error("Audit fixture course not found");
  const offering = resolveCandidateOffering({
    courseId: database.id,
    timetableModel: "C",
    academicYear: 2026,
    semester: "second",
    offerings: candidateOfferings,
  });
  const scheduleEvaluation = evaluateScheduleOptions(offering, []);

  it("未申込に抽選結果またはUNIPA確認が残る矛盾を検出する", () => {
    const issues = validateLotteryApplication({
      application: {
        ...createEmptyLotteryApplication(database.id),
        resultStatus: "won",
        wonOfferingId: offering.id,
        registrationConfirmation: "confirmed",
      },
      offering,
      scheduleEvaluation,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "result_without_application",
        "confirmation_without_application",
      ]),
    );
  });

  it("pending等の非当選状態に古い当選枠が残る矛盾を検出する", () => {
    const issues = validateLotteryApplication({
      application: {
        ...createEmptyLotteryApplication(database.id),
        applicationStatus: "applied",
        resultStatus: "pending",
        wonOfferingId: offering.id,
      },
      offering,
      scheduleEvaluation,
    });

    expect(issues.map((issue) => issue.code)).toContain(
      "non_won_has_won_offering",
    );
  });

  it("未申込+wonの破損値をCAPへ加算せずHome warningへ集約する", () => {
    const state = readyState();
    state.plannedCourses.database = { selected: true };
    state.lotteries.database = {
      ...createEmptyLotteryApplication(database.id),
      resultStatus: "won",
      wonOfferingId: offering.id,
      registrationConfirmation: "confirmed",
    };

    const summary = selectDashboardSummary(state);
    expect(summary.cap?.resultReflectedAnnualCredits).toBe(
      summary.cap?.confirmedAnnualCredits,
    );
    expect(
      selectHomeTasks(state).some((task) => task.id === "lottery-validation"),
    ).toBe(true);
  });
});

describe("Phase 8 persistence and timezone audit", () => {
  it("current schema migrationはidempotentで値を変更しない", () => {
    const state = readyState();
    state.plannedCourses.database = { selected: true };
    expect(migrateState(structuredClone(state))).toEqual(state);
  });

  it("未知のenumを含む保存値は安全な初期状態へ戻す", () => {
    const state = readyState() as unknown as Record<string, unknown>;
    state.user = {
      ...(state.user as Record<string, unknown>),
      englishTrack: "expert",
    };
    expect(migrateState(state)).toEqual(createInitialState());
  });

  it("大学日程を端末timezoneではなくAsia/Tokyoで表示する", () => {
    expect(
      formatLotteryDateTime("2026-09-15T09:00:00Z", "Asia/Tokyo"),
    ).toBe("9月15日 18:00");
  });

  it("全10パターンで必修8科目・14単位を維持する", () => {
    for (const timetableModel of ["A", "B", "C", "D", "E"] as const) {
      for (const englishTrack of ["normal", "advanced"] as const) {
        const timetable = generateRequiredTimetable({
          timetableModel,
          englishTrack,
          academicYear: 2026,
          grade: 1,
          semester: "second",
          courses: courseCatalog,
          offerings: courseOfferings,
        });
        expect(timetable.courses).toHaveLength(8);
        expect(timetable.totalCredits).toBe(14);
      }
    }
  });
});
