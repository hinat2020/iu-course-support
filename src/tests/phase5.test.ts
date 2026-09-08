import { beforeEach, describe, expect, it } from "vitest";
import {
  candidateCourses,
  candidateOfferings,
  registrationRules,
} from "../data/2026/coursePlanning";
import { regularLotteryData } from "../data/2026/lottery";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import { calculateCap } from "../domain/cap";
import type { Course } from "../domain/course";
import {
  createEmptyLotteryApplication,
  getLotteryPhase,
  hasLotteryActivity,
  normalizeLotteryPreferences,
  validateLotteryApplication,
  type LotteryApplication,
  type LotteryPreference,
} from "../domain/lottery";
import {
  buildLotteryCourseContexts,
  type LotteryCourseContext,
} from "../domain/lotteryPlanning";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import type { TimetableModel } from "../domain/timetable";
import type {
  EnglishTrack,
  FirstSemesterState,
  PreviousCourseStatus,
} from "../domain/user";
import { createInitialState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import {
  loadState,
  saveState,
  STORAGE_KEY,
} from "../storage/localStorage";

function makeFirstCourse(id: string): Course {
  return {
    id,
    name: id,
    credits: 2,
    requirementType: "required_elective",
    requirementGroups: [],
    grade: 1,
    semester: "first",
    category: { major: "test" },
  };
}

function makeFirstSemester(
  courses: readonly Course[],
  status: PreviousCourseStatus = "earned",
): FirstSemesterState {
  return {
    requiredCoursesConfirmed: true,
    courses: Object.fromEntries(
      courses.map((course) => [
        course.id,
        {
          courseId: course.id,
          status,
          confirmedByUser: true,
        },
      ]),
    ),
    innovationMethod: {
      registeredInFirstSemester: "unknown",
      moduleType: null,
      confirmedByUser: false,
    },
  };
}

function requiredCourses(
  model: TimetableModel = "A",
  englishTrack: EnglishTrack = "normal",
) {
  return generateRequiredTimetable({
    timetableModel: model,
    englishTrack,
    academicYear: 2026,
    grade: 1,
    semester: "second",
    courses: courseCatalog,
    offerings: courseOfferings,
  });
}

function lotteryContext(
  model: TimetableModel,
  englishTrack: EnglishTrack,
  courseId: string,
  selectedCourseIds: readonly string[] = [courseId],
): LotteryCourseContext {
  const selected = candidateCourses.filter((course) =>
    selectedCourseIds.includes(course.id),
  );
  const context = buildLotteryCourseContexts({
    courses: selected,
    offerings: candidateOfferings,
    requiredCourses: requiredCourses(model, englishTrack).courses,
    timetableModel: model,
    academicYear: 2026,
    semester: "second",
  }).find((item) => item.course.id === courseId);

  if (!context) throw new Error("Lottery context not found: " + courseId);
  return context;
}

function appliedApplication(
  courseId: string,
  preferences: LotteryPreference[],
): LotteryApplication {
  return {
    ...createEmptyLotteryApplication(courseId),
    applicationStatus: "applied",
    resultStatus: "pending",
    preferences,
  };
}

describe("Phase 5 lottery state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("plannedだけではapplicationStatusはappliedにならない", () => {
    const state = appReducer(createInitialState(), {
      type: "SELECT_COURSE",
      payload: "database",
    });

    expect(state.plannedCourses.database.selected).toBe(true);
    expect(state.lotteries.database).toBeUndefined();
  });

  it("未申込から申込済みに変更できる", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: {
        courseId: "database",
        status: "applied",
        preferences: [
          {
            offeringId: "2026-second-database-A",
            scheduleOptionId: null,
            rank: 1,
          },
        ],
      },
    });

    expect(state.lotteries.database).toMatchObject({
      applicationStatus: "applied",
      resultStatus: "pending",
    });
  });

  it("申込済みから未申込へ戻せる", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "not_applied" },
    });

    expect(state.lotteries.database.applicationStatus).toBe("not_applied");
  });

  it("未申込へ戻すと結果・当選枠・最終確認を初期化する", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "won",
        wonOfferingId: "2026-second-database-A",
      },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_REGISTRATION_CONFIRMATION",
      payload: { courseId: "database", status: "confirmed" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "not_applied" },
    });

    expect(state.lotteries.database).toEqual(
      createEmptyLotteryApplication("database"),
    );
  });

  it("applied科目をwonへ変更できる", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "won",
        wonOfferingId: "2026-second-database-A",
      },
    });

    expect(state.lotteries.database.resultStatus).toBe("won");
  });

  it("applied科目をlostへ変更できる", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "lost",
        wonOfferingId: null,
      },
    });

    expect(state.lotteries.database.resultStatus).toBe("lost");
  });

  it("lostへ変更すると古い当選Offeringを削除する", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "interaction-design-intro", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "interaction-design-intro",
        result: "won",
        wonOfferingId: "2026-second-interaction-design-intro-ALL",
        wonScheduleOptionId: "wed3",
      },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "interaction-design-intro",
        result: "lost",
        wonOfferingId: null,
      },
    });

    expect(state.lotteries["interaction-design-intro"]).toMatchObject({
      resultStatus: "lost",
      wonOfferingId: null,
      wonScheduleOptionId: null,
      registrationConfirmation: "unconfirmed",
    });
  });

  it("単一枠科目のwonで対象Offeringを保持する", () => {
    const context = lotteryContext("A", "normal", "database");
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "won",
        wonOfferingId: context.offering.id,
      },
    });

    expect(state.lotteries.database.wonOfferingId).toBe(context.offering.id);
    expect(state.lotteries.database.wonScheduleOptionId).toBeNull();
  });

  it("normalのInteraction Designでrank 1 / 2を保存できる", () => {
    const offeringId = lotteryContext(
      "C",
      "normal",
      "interaction-design-intro",
    ).offering.id;
    const state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_PREFERENCES",
      payload: {
        courseId: "interaction-design-intro",
        preferences: [
          { offeringId, scheduleOptionId: "wed3", rank: 1 },
          { offeringId, scheduleOptionId: "tue4", rank: 2 },
        ],
      },
    });

    expect(
      state.lotteries["interaction-design-intro"].preferences,
    ).toHaveLength(2);
  });

  it("同じscheduleOptionを複数順位へ保存しない", () => {
    const offeringId = "2026-second-interaction-design-intro-ALL";
    expect(
      normalizeLotteryPreferences([
        { offeringId, scheduleOptionId: "wed3", rank: 1 },
        { offeringId, scheduleOptionId: "wed3", rank: 2 },
      ]),
    ).toEqual([{ offeringId, scheduleOptionId: "wed3", rank: 1 }]);
  });

  it("当選科目だけregistrationConfirmationをconfirmedにできる", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_REGISTRATION_CONFIRMATION",
      payload: { courseId: "database", status: "confirmed" },
    });
    expect(
      state.lotteries.database.registrationConfirmation,
    ).toBe("unconfirmed");

    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "won",
        wonOfferingId: "2026-second-database-A",
      },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_REGISTRATION_CONFIRMATION",
      payload: { courseId: "database", status: "confirmed" },
    });
    expect(state.lotteries.database.registrationConfirmation).toBe(
      "confirmed",
    );
  });

  it("lost科目にはfinal confirmationを設定しない", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "database",
        result: "lost",
        wonOfferingId: null,
      },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_REGISTRATION_CONFIRMATION",
      payload: { courseId: "database", status: "confirmed" },
    });

    expect(
      state.lotteries.database.registrationConfirmation,
    ).toBe("unconfirmed");
  });

  it("LotteryApplicationを保存後にreload相当で復元できる", () => {
    let state = appReducer(createInitialState(), {
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
            offeringId: "2026-second-database-A",
            scheduleOptionId: null,
            rank: 1,
          },
        ],
      },
    });
    saveState(state);

    expect(loadState().lotteries.database).toEqual(state.lotteries.database);
  });

  it("v2からv3へ基本設定・前期情報・候補・旧抽選結果を保持して移行する", () => {
    const base = createInitialState();
    const legacyState = {
      ...base,
      schemaVersion: 2,
      innovationLecture: {
        lotteryStatus: "candidate",
        preferences: [],
        wonClassId: null,
        previousEarnedCount: 0,
      },
      innovationMethod: {
        moduleType: null,
        enrollmentSource: null,
        lotteryStatus: null,
        targetCredit: null,
      },
      user: { ...base.user, timetableModel: "C", englishTrack: "advanced" },
      firstSemester: {
        ...base.firstSemester,
        courses: {
          database: {
            courseId: "database",
            status: "earned",
            confirmedByUser: true,
          },
        },
      },
      plannedCourses: { database: { selected: true } },
      lotteries: {
        database: {
          courseId: "database",
          status: "won",
          preferences: [
            { offeringId: "2026-second-database-C", rank: 1 },
          ],
          wonOfferingId: "2026-second-database-C",
          confirmedByUser: true,
        },
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState));

    const migrated = loadState();
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.user).toMatchObject({
      timetableModel: "C",
      englishTrack: "advanced",
    });
    expect(migrated.firstSemester.courses.database.status).toBe("earned");
    expect(migrated.plannedCourses.database.selected).toBe(true);
    expect(migrated.lotteries.database).toMatchObject({
      applicationStatus: "applied",
      resultStatus: "won",
      wonOfferingId: "2026-second-database-C",
      wonScheduleOptionId: null,
      registrationConfirmation: "unconfirmed",
    });
  });

  it("抽選記録付き科目を候補から外す処理は候補と抽選を同時に初期化する", () => {
    let state = appReducer(createInitialState(), {
      type: "SELECT_COURSE",
      payload: "database",
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "database", status: "applied" },
    });
    expect(hasLotteryActivity(state.lotteries.database)).toBe(true);

    state = appReducer(state, {
      type: "UNSELECT_COURSE_AND_RESET_LOTTERY",
      payload: "database",
    });
    expect(state.plannedCourses.database.selected).toBe(false);
    expect(state.lotteries.database).toBeUndefined();
  });
});

describe("Phase 5 lottery validation", () => {
  it("C + AdvancedのInteraction Designで火4を希望にできない", () => {
    const context = lotteryContext(
      "C",
      "advanced",
      "interaction-design-intro",
    );
    const application = appliedApplication(context.course.id, [
      {
        offeringId: context.offering.id,
        scheduleOptionId: "tue4",
        rank: 1,
      },
    ]);
    const issues = validateLotteryApplication({
      application,
      offering: context.offering,
      scheduleEvaluation: context.scheduleEvaluation,
    });

    expect(issues.map((issue) => issue.code)).toContain(
      "schedule_option_unavailable",
    );
  });

  it("C + AdvancedのInteraction Designで水3を希望にできる", () => {
    const context = lotteryContext(
      "C",
      "advanced",
      "interaction-design-intro",
    );
    const application = appliedApplication(context.course.id, [
      {
        offeringId: context.offering.id,
        scheduleOptionId: "wed3",
        rank: 1,
      },
    ]);
    const issues = validateLotteryApplication({
      application,
      offering: context.offering,
      scheduleEvaluation: context.scheduleEvaluation,
    });

    expect(issues.map((issue) => issue.code)).not.toContain(
      "schedule_option_unavailable",
    );
  });

  it("rank重複をvalidationで検出する", () => {
    const context = lotteryContext(
      "C",
      "normal",
      "interaction-design-intro",
    );
    const application = appliedApplication(context.course.id, [
      {
        offeringId: context.offering.id,
        scheduleOptionId: "wed3",
        rank: 1,
      },
      {
        offeringId: context.offering.id,
        scheduleOptionId: "tue4",
        rank: 1,
      },
    ]);

    expect(
      validateLotteryApplication({
        application,
        offering: context.offering,
        scheduleEvaluation: context.scheduleEvaluation,
      }).map((issue) => issue.code),
    ).toContain("duplicate_rank");
  });

  it("希望していない枠をwonにするとvalidation errorになる", () => {
    const context = lotteryContext(
      "C",
      "normal",
      "interaction-design-intro",
    );
    const application: LotteryApplication = {
      ...appliedApplication(context.course.id, [
        {
          offeringId: context.offering.id,
          scheduleOptionId: "wed3",
          rank: 1,
        },
      ]),
      resultStatus: "won",
      wonOfferingId: context.offering.id,
      wonScheduleOptionId: "tue4",
    };

    expect(
      validateLotteryApplication({
        application,
        offering: context.offering,
        scheduleEvaluation: context.scheduleEvaluation,
      }).map((issue) => issue.code),
    ).toContain("won_option_not_preferred");
  });

  it("model変更後も保存状態を残しOffering不一致をwarningにする", () => {
    const contextA = lotteryContext("A", "normal", "market-innovation");
    let state = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "A",
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: {
        courseId: contextA.course.id,
        status: "applied",
        preferences: [
          {
            offeringId: contextA.offering.id,
            scheduleOptionId: null,
            rank: 1,
          },
        ],
      },
    });
    const savedApplication = state.lotteries[contextA.course.id];
    state = appReducer(state, {
      type: "SET_TIMETABLE_MODEL",
      payload: "B",
    });
    const contextB = lotteryContext("B", "normal", "market-innovation");

    expect(state.lotteries[contextA.course.id]).toEqual(savedApplication);
    expect(
      validateLotteryApplication({
        application: savedApplication,
        offering: contextB.offering,
        scheduleEvaluation: contextB.scheduleEvaluation,
      }).map((issue) => issue.code),
    ).toContain("offering_mismatch");
  });

  it("normalからadvanced変更後は保存済み火4希望をwarningにする", () => {
    const normal = lotteryContext(
      "C",
      "normal",
      "interaction-design-intro",
    );
    const application = appliedApplication(normal.course.id, [
      {
        offeringId: normal.offering.id,
        scheduleOptionId: "tue4",
        rank: 1,
      },
    ]);
    const advanced = lotteryContext(
      "C",
      "advanced",
      "interaction-design-intro",
    );

    expect(
      validateLotteryApplication({
        application,
        offering: advanced.offering,
        scheduleEvaluation: advanced.scheduleEvaluation,
      }).map((issue) => issue.code),
    ).toContain("schedule_option_unavailable");
  });
});

describe("Phase 5 CAP", () => {
  const firstCourses = Array.from({ length: 12 }, (_, index) =>
    makeFirstCourse("first-" + index),
  );
  const required = requiredCourses().courses.map(({ course }) => course);
  const database = candidateCourses.find((course) => course.id === "database");

  if (!database) throw new Error("Database course not found");

  it("確定基礎38 + won 2で抽選結果反映値40になる", () => {
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: required,
      selectedCandidateCourses: [database],
      wonCandidateCourses: [database],
      capLimit: 46,
    });

    expect(result.confirmedAnnualCredits).toBe(38);
    expect(result.resultReflectedAnnualCredits).toBe(40);
  });

  it("lost 2単位は抽選結果反映値へ加算しない", () => {
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: required,
      selectedCandidateCourses: [database],
      wonCandidateCourses: [],
      capLimit: 46,
    });

    expect(result.resultReflectedAnnualCredits).toBe(38);
  });

  it("pending 2単位は抽選結果反映値へ加算しない", () => {
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: required,
      selectedCandidateCourses: [database],
      wonCandidateCourses: [],
      capLimit: 46,
    });

    expect(result.wonCredits).toBe(0);
    expect(result.resultReflectedAnnualCredits).toBe(38);
  });

  it("planned候補全件をmaximum projectionへ加算する", () => {
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: required,
      selectedCandidateCourses: candidateCourses,
      wonCandidateCourses: [],
      capLimit: registrationRules.annualCap,
    });

    expect(result.candidateCredits).toBe(14);
    expect(result.maximumAnnualCredits).toBe(52);
    expect(result.resultReflectedAnnualCredits).toBe(38);
  });

  it("unknown前期科目があればPhase 5 CAP値もnullになる", () => {
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses, "unknown"),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: required,
      selectedCandidateCourses: [database],
      wonCandidateCourses: [database],
      capLimit: 46,
    });

    expect(result.confirmedAnnualCredits).toBeNull();
    expect(result.maximumAnnualCredits).toBeNull();
    expect(result.resultReflectedAnnualCredits).toBeNull();
    expect(result.resultExceeded).toBeNull();
  });
});

describe("getLotteryPhase boundary", () => {
  const schedule = regularLotteryData.schedule;

  it("開始1分前はbefore_application", () => {
    expect(getLotteryPhase("2026-09-15T17:59:00+09:00", schedule)).toBe(
      "before_application",
    );
  });

  it("開始時刻はapplication_open", () => {
    expect(getLotteryPhase("2026-09-15T18:00:00+09:00", schedule)).toBe(
      "application_open",
    );
  });

  it("締切時刻はapplication_open", () => {
    expect(getLotteryPhase("2026-09-18T23:59:00+09:00", schedule)).toBe(
      "application_open",
    );
  });

  it("締切直後はwaiting_for_result", () => {
    expect(getLotteryPhase("2026-09-18T23:59:01+09:00", schedule)).toBe(
      "waiting_for_result",
    );
  });

  it("結果公開・確認開始時刻はconfirmation_period", () => {
    expect(getLotteryPhase("2026-09-21T18:00:00+09:00", schedule)).toBe(
      "confirmation_period",
    );
  });

  it("確認終了時刻をconfirmation_periodへ含める", () => {
    expect(getLotteryPhase("2026-09-22T18:00:00+09:00", schedule)).toBe(
      "confirmation_period",
    );
    expect(getLotteryPhase("2026-09-22T18:00:01+09:00", schedule)).toBe(
      "finished",
    );
  });
});
