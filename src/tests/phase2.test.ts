import { beforeEach, describe, expect, it } from "vitest";
import { firstSemesterRequiredCourses } from "../data/2026/setup";
import type { PreviousCourseStatus } from "../domain/user";
import { createInitialState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import {
  selectInnovationMethodSetupSummary,
  selectIsBasicSetupComplete,
  selectIsFirstSemesterRequiredComplete,
} from "../state/selectors";
import { loadState, saveState } from "../storage/localStorage";

const requiredCourseIds = firstSemesterRequiredCourses.map(
  (course) => course.id,
);

describe("Phase 2 setup state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("基本設定のモデル・英語変更を保存して復元できる", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "D",
    });
    state = appReducer(state, {
      type: "SET_ENGLISH_TRACK",
      payload: "advanced",
    });
    saveState(state);

    const loaded = loadState();
    expect(selectIsBasicSetupComplete(loaded)).toBe(true);
    expect(loaded.user.timetableModel).toBe("D");
    expect(loaded.user.englishTrack).toBe("advanced");
  });

  it("全前期必修を一括でearnedかつ確認済みにできる", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_ALL_REQUIRED_COURSES_EARNED",
      payload: { courseIds: requiredCourseIds },
    });

    for (const courseId of requiredCourseIds) {
      expect(state.firstSemester.courses[courseId]).toEqual({
        courseId,
        status: "earned",
        confirmedByUser: true,
      });
    }
    expect(
      selectIsFirstSemesterRequiredComplete(state, requiredCourseIds),
    ).toBe(true);
  });

  it.each<PreviousCourseStatus>(["failed", "not_taken", "unknown"])(
    "%sを個別設定すると確認済みになる",
    (status) => {
      const state = appReducer(createInitialState(), {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId: requiredCourseIds[0], status },
      });

      expect(state.firstSemester.courses[requiredCourseIds[0]]).toMatchObject({
        status,
        confirmedByUser: true,
      });
    },
  );

  it("unknownでも全対象がconfirmedByUser=trueなら入力完了になる", () => {
    let state = createInitialState();

    for (const courseId of requiredCourseIds) {
      state = appReducer(state, {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId, status: "unknown" },
      });
    }

    expect(
      selectIsFirstSemesterRequiredComplete(state, requiredCourseIds),
    ).toBe(true);
  });

  it("イノベーション技法をいいえに変更するとmoduleTypeを消す", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
      payload: true,
    });
    state = appReducer(state, {
      type: "SET_FIRST_SEMESTER_INNOVATION_MODULE_TYPE",
      payload: "lecture",
    });
    state = appReducer(state, {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
      payload: false,
    });

    expect(state.firstSemester.innovationMethod.moduleType).toBeNull();
    expect(selectInnovationMethodSetupSummary(state).isComplete).toBe(true);
  });

  it("イノベーション技法がはいでmoduleType未回答なら未完了になる", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
      payload: true,
    });

    expect(state.firstSemester.innovationMethod.moduleType).toBeNull();
    expect(selectInnovationMethodSetupSummary(state).isComplete).toBe(false);
  });

  it("レビュー確定前は全入力後もsetupCompleted=falseを保つ", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "A",
    });
    state = appReducer(state, {
      type: "SET_ENGLISH_TRACK",
      payload: "normal",
    });
    state = appReducer(state, {
      type: "SET_ALL_REQUIRED_COURSES_EARNED",
      payload: { courseIds: requiredCourseIds },
    });
    state = appReducer(state, {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
      payload: "unknown",
    });

    expect(state.setupCompleted).toBe(false);
  });

  it("Phase 2入力値をリロード相当の保存・読込後も復元する", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: requiredCourseIds[0], status: "failed" },
    });
    state = appReducer(state, {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
      payload: true,
    });
    state = appReducer(state, {
      type: "SET_FIRST_SEMESTER_INNOVATION_MODULE_TYPE",
      payload: "event",
    });
    saveState(state);

    const loaded = loadState();
    expect(loaded.firstSemester.courses[requiredCourseIds[0]].status).toBe(
      "failed",
    );
    expect(loaded.firstSemester.innovationMethod).toMatchObject({
      registeredInFirstSemester: true,
      moduleType: "event",
      confirmedByUser: true,
    });
  });

  it("RESET_APPでPhase 2入力も初期化する", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
      payload: false,
    });
    state = appReducer(state, { type: "RESET_APP" });

    expect(state).toEqual(createInitialState());
    expect(state.firstSemester.innovationMethod.confirmedByUser).toBe(false);
  });

  it("設定完了後に入力を変更すると再確認が必要になる", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_SETUP_COMPLETED",
      payload: true,
    });
    state = appReducer(state, {
      type: "SET_ENGLISH_TRACK",
      payload: "advanced",
    });

    expect(state.setupCompleted).toBe(false);
  });
});
