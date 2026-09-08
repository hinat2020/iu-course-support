import { beforeEach, describe, expect, it } from "vitest";
import { regularLotteryData } from "../data/2026/lottery";
import { specialCoursesData } from "../data/2026/specialCourses";
import {
  calculateInnovationMethodLectureProgress,
  canStartInnovationMethodModuleInSecondSemester,
  evaluateInnovationMiniCourseConflicts,
  getInnovationLectureCreditLabel,
  getInnovationMethodEnrollmentMode,
  getSpecialLotteryPhase,
  isInnovationMethodEventContinuation,
  normalizeInnovationLecturePreferences,
  type InnovationMiniCourseProgress,
} from "../domain/innovation";
import { createEmptyLotteryApplication } from "../domain/lottery";
import { createInitialState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { loadState, STORAGE_KEY } from "../storage/localStorage";

const miniCourses = specialCoursesData.innovationMethod.lecture.miniCourses;
const requiredSessionCount =
  specialCoursesData.innovationMethod.lecture.requiredPassedSessionCount;

function progress(
  records: InnovationMiniCourseProgress[],
  targetCredit: "a" | "b" = "a",
) {
  return calculateInnovationMethodLectureProgress({
    academicYear: 2026,
    targetCredit,
    records,
    miniCourses,
    requiredSessionCount,
  });
}

function record(
  miniCourseId: string,
  status: InnovationMiniCourseProgress["status"],
  alreadyUsedForCredit: "a" | "b" | null = null,
  academicYear = 2026,
): InnovationMiniCourseProgress {
  return { academicYear, miniCourseId, status, alreadyUsedForCredit };
}

describe("イノベーション特講", () => {
  it.each([
    [0, "a"],
    [1, "b"],
    [2, "completed"],
  ] as const)("previousEarnedCount=%sなら%s", (count, expected) => {
    expect(getInnovationLectureCreditLabel(count)).toBe(expected);
  });

  it("2クラスへ第1・第2希望を設定できる", () => {
    const [first, second] = specialCoursesData.innovationLecture.classes;
    const state = appReducer(createInitialState(), {
      type: "SET_INNOVATION_LECTURE_PREFERENCES",
      payload: [
        { classId: first.id, rank: 1 },
        { classId: second.id, rank: 2 },
      ],
    });
    expect(state.innovationLecture.preferences).toHaveLength(2);
  });

  it("同一クラスを複数順位へ設定しない", () => {
    const classId = specialCoursesData.innovationLecture.classes[0].id;
    expect(
      normalizeInnovationLecturePreferences([
        { classId, rank: 1 },
        { classId, rank: 2 },
      ]),
    ).toEqual([{ classId, rank: 1 }]);
  });

  it("当選クラスは単一のwonClassIdだけを保持する", () => {
    const [first, second] = specialCoursesData.innovationLecture.classes;
    let state = appReducer(createInitialState(), {
      type: "SET_INNOVATION_LECTURE_APPLICATION_STATUS",
      payload: "applied",
    });
    state = appReducer(state, {
      type: "SET_INNOVATION_LECTURE_RESULT",
      payload: { result: "won", wonClassId: first.id },
    });
    state = appReducer(state, {
      type: "SET_INNOVATION_LECTURE_RESULT",
      payload: { result: "won", wonClassId: second.id },
    });
    expect(state.innovationLecture.wonClassId).toBe(second.id);
    expect(Array.isArray(state.innovationLecture.wonClassId)).toBe(false);
  });

  it("lostでwonClassIdをnullにする", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_INNOVATION_LECTURE_APPLICATION_STATUS",
      payload: "applied",
    });
    state = appReducer(state, {
      type: "SET_INNOVATION_LECTURE_RESULT",
      payload: {
        result: "won",
        wonClassId: specialCoursesData.innovationLecture.classes[0].id,
      },
    });
    state = appReducer(state, {
      type: "SET_INNOVATION_LECTURE_RESULT",
      payload: { result: "lost" },
    });
    expect(state.innovationLecture.wonClassId).toBeNull();
  });

  it("won前にUNIPA確認済みへできない", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_INNOVATION_LECTURE_REGISTRATION_CONFIRMATION",
      payload: "confirmed",
    });
    expect(state.innovationLecture.registrationConfirmation).toBe("unconfirmed");
  });

  it("特講を通常LotteryApplicationへ混入させない", () => {
    const normalCourseIds = new Set(
      regularLotteryData.courses.map((item) => item.courseId),
    );
    for (const courseId of specialCoursesData.innovationLecture.courseIds) {
      expect(normalCourseIds.has(courseId)).toBe(false);
    }
  });
});

describe("イノベーション技法の分岐", () => {
  it.each([
    [true, "continuation"],
    [false, "new_second_semester"],
    ["unknown", "needs_confirmation"],
  ] as const)("前期登録%sは%s", (registered, expected) => {
    expect(getInnovationMethodEnrollmentMode(registered)).toBe(expected);
  });

  it("前期登録falseではeventを新規選択できずlectureだけ可能", () => {
    expect(canStartInnovationMethodModuleInSecondSemester("lecture")).toBe(true);
    expect(canStartInnovationMethodModuleInSecondSemester("event")).toBe(false);
  });

  it("event進捗は前期登録trueかつeventだけが対象", () => {
    expect(isInnovationMethodEventContinuation(true, "event")).toBe(true);
    expect(isInnovationMethodEventContinuation(false, "event")).toBe(false);
    expect(isInnovationMethodEventContinuation(true, "lecture")).toBe(false);
    expect(isInnovationMethodEventContinuation("unknown", "event")).toBe(false);
  });

  it("targetCreditを保存せず修得数からderivedにする", () => {
    const state = createInitialState();
    expect("targetCredit" in state.innovationMethod).toBe(false);
    expect(getInnovationLectureCreditLabel(state.innovationMethod.previousEarnedCount)).toBe("a");
  });

  it("estimatedHours=45でも単位修得済みにしない", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_INNOVATION_METHOD_ESTIMATED_HOURS",
      payload: 45,
    });
    expect(state.innovationMethod.eventModule.estimatedHours).toBe(45);
    expect(state.innovationMethod.previousEarnedCount).toBe(0);
    expect(getInnovationLectureCreditLabel(state.innovationMethod.previousEarnedCount)).toBe("a");
  });
});

describe("講座系8回進捗", () => {
  it("passed 2 + 2 + 4で8/8 completed", () => {
    const result = progress([
      record("academic-writing", "passed"),
      record("document-processing", "passed"),
      record("dx-consultant-foundations", "passed"),
    ]);
    expect(result).toEqual({
      passedSessionCount: 8,
      requiredSessionCount: 8,
      remainingSessionCount: 0,
      completed: true,
    });
  });

  it("passed 2 + 2 + failed 4は4/8", () => {
    const result = progress([
      record("academic-writing", "passed"),
      record("document-processing", "passed"),
      record("dx-consultant-foundations", "failed"),
    ]);
    expect(result.passedSessionCount).toBe(4);
    expect(result.remainingSessionCount).toBe(4);
    expect(result.completed).toBe(false);
  });

  it("planned / registeredは合格回数へ入れない", () => {
    expect(
      progress([
        record("academic-writing", "planned"),
        record("document-processing", "registered"),
      ]).passedSessionCount,
    ).toBe(0);
  });

  it("aに使用済み講座はb進捗へ再利用しない", () => {
    const result = progress(
      [
        record("academic-writing", "passed", "a"),
        record("document-processing", "passed"),
      ],
      "b",
    );
    expect(result.passedSessionCount).toBe(2);
  });

  it("8回超過でもremaining=0", () => {
    const result = progress([
      record("academic-writing", "passed"),
      record("document-processing", "passed"),
      record("dx-consultant-foundations", "passed"),
      record("regional-revitalization-innovation", "passed"),
    ]);
    expect(result.passedSessionCount).toBe(12);
    expect(result.remainingSessionCount).toBe(0);
    expect(result.completed).toBe(true);
  });

  it("前年度の合格実績を2026年度へ合算しない", () => {
    const result = progress([
      record("academic-writing", "passed", null, 2025),
      record("document-processing", "passed"),
    ]);
    expect(result.passedSessionCount).toBe(2);
  });

  it("固定曜日・時限で必修または当選科目との重複をwarning用に検出する", () => {
    const course = miniCourses.find((item) => item.id === "academic-writing");
    if (!course) throw new Error("Academic Writing not found");

    expect(
      evaluateInnovationMiniCourseConflicts(course, [
        {
          courseId: "existing-course",
          courseName: "重複する科目",
          slots: [{ day: "wed", period: 5 }],
        },
      ]),
    ).toEqual([
      { courseId: "existing-course", courseName: "重複する科目" },
    ]);
  });
});

describe("特殊抽選日程", () => {
  const schedule = specialCoursesData.specialLottery.schedule;

  it("9/15 18:00はapplication_open", () => {
    expect(getSpecialLotteryPhase("2026-09-15T18:00:00+09:00", schedule)).toBe("application_open");
  });

  it("9/18 18:00はapplication_open最終時刻", () => {
    expect(getSpecialLotteryPhase("2026-09-18T18:00:00+09:00", schedule)).toBe("application_open");
  });

  it("9/18 18:00直後はwaiting_for_result", () => {
    expect(getSpecialLotteryPhase("2026-09-18T18:00:01+09:00", schedule)).toBe("waiting_for_result");
  });

  it("9/21 18:00はresult_available", () => {
    expect(getSpecialLotteryPhase("2026-09-21T18:00:00+09:00", schedule)).toBe("result_available");
  });

  it("通常抽選の9/18 23:59とは別スケジュール", () => {
    expect(schedule.applicationDeadline).toBe("2026-09-18T18:00:00+09:00");
    expect(regularLotteryData.schedule.applicationDeadline).toBe("2026-09-18T23:59:00+09:00");
  });
});

describe("v3からv4 migration", () => {
  beforeEach(() => window.localStorage.clear());

  it("基本設定・前期・候補・通常抽選を保持し旧Innovationを安全に初期化", () => {
    const current = createInitialState();
    const normalApplication = {
      ...createEmptyLotteryApplication("database"),
      applicationStatus: "applied" as const,
      resultStatus: "won" as const,
      wonOfferingId: "2026-second-database-C",
    };
    const legacy = {
      ...current,
      schemaVersion: 3,
      user: { ...current.user, timetableModel: "C", englishTrack: "advanced" },
      firstSemester: {
        ...current.firstSemester,
        courses: {
          database: {
            courseId: "database",
            status: "earned",
            confirmedByUser: true,
          },
        },
      },
      plannedCourses: { database: { selected: true } },
      lotteries: { database: normalApplication },
      innovationLecture: {
        lotteryStatus: "won",
        preferences: [{ offeringId: "old-class", rank: 1 }],
        wonClassId: "old-class",
        previousEarnedCount: 1,
      },
      innovationMethod: {
        moduleType: "lecture",
        enrollmentSource: "continued_from_first_semester",
        lotteryStatus: "won",
        targetCredit: "b",
        lectureModule: {
          miniCourses: [
            { miniCourseId: "old-course", status: "passed", sessionCount: 8 },
          ],
        },
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const migrated = loadState();
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.user).toMatchObject({ timetableModel: "C", englishTrack: "advanced" });
    expect(migrated.firstSemester.courses.database.status).toBe("earned");
    expect(migrated.plannedCourses.database.selected).toBe(true);
    expect(migrated.lotteries.database).toEqual(normalApplication);
    expect(migrated.innovationLecture).toMatchObject({
      previousEarnedCount: 1,
      applicationStatus: "not_applied",
      resultStatus: null,
      wonClassId: null,
      registrationConfirmation: "unconfirmed",
    });
    expect(migrated.innovationMethod.previousEarnedCount).toBe(0);
    expect(migrated.innovationMethod.lectureModule.miniCourses).toEqual([]);
    expect("targetCredit" in migrated.innovationMethod).toBe(false);
  });
});
