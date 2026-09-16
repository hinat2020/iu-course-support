import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { firstSemesterElectiveCourses, firstSemesterRequiredCourses } from "../data/2026/setup";
import { CourseDetailPage } from "../pages/CourseDetailPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AppStateContext } from "../state/appStateContextValue";
import { selectCourseDetail } from "../state/courseDetailSelector";
import {
  getRootDestination,
  selectAppWarnings,
  selectDashboardSummary,
  selectFinalReviewSummary,
  selectHomeTasks,
} from "../state/dashboardSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";

function readyState(): AppState {
  let state = appReducer(createInitialState(), { type: "SET_TIMETABLE_MODEL", payload: "C" });
  state = appReducer(state, { type: "SET_ENGLISH_TRACK", payload: "advanced" });
  state = appReducer(state, {
    type: "SET_ALL_REQUIRED_COURSES_EARNED",
    payload: { courseIds: firstSemesterRequiredCourses.map((course) => course.id) },
  });
  for (const course of firstSemesterElectiveCourses) {
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: course.id, status: "not_taken" },
    });
  }
  state = appReducer(state, { type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION", payload: false });
  return appReducer(state, { type: "SET_SETUP_COMPLETED", payload: true });
}

function selectCourse(state: AppState, courseId: string): AppState {
  return appReducer(state, { type: "SELECT_COURSE", payload: courseId });
}

function applyForDatabase(state: AppState): AppState {
  return appReducer(state, {
    type: "SET_LOTTERY_APPLICATION_STATUS",
    payload: {
      courseId: "database",
      status: "applied",
      preferences: [{ offeringId: "2026-second-database-C", scheduleOptionId: null, rank: 1 }],
    },
  });
}

afterEach(() => cleanup());

describe("Phase 7 Home derived state", () => {
  it("setup未完了ならrootはWelcomeを維持する", () => {
    expect(getRootDestination(false)).toBeNull();
  });

  it("setup完了ならrootからHomeへ進む", () => {
    expect(getRootDestination(true)).toBe("/home");
  });

  it("候補が未申込ならHomeTaskを生成する", () => {
    const tasks = selectHomeTasks(selectCourse(readyState(), "database"));
    expect(tasks.find((task) => task.id === "lottery-not-applied")).toMatchObject({ href: "/lottery" });
  });

  it("当選かつUNIPA未確認ならHomeTaskを生成する", () => {
    let state = applyForDatabase(selectCourse(readyState(), "database"));
    state = appReducer(state, { type: "SET_LOTTERY_RESULT", payload: { courseId: "database", result: "won", wonOfferingId: "2026-second-database-C" } });
    expect(selectHomeTasks(state).find((task) => task.id === "lottery-unipa-unconfirmed")).toMatchObject({ href: "/lottery/results" });
  });

  it("CAP最大値が上限を超えるとtaskを生成する", () => {
    let state = readyState();
    for (const course of firstSemesterElectiveCourses) {
      state = appReducer(state, { type: "SET_PREVIOUS_COURSE_STATUS", payload: { courseId: course.id, status: "earned" } });
    }
    for (const courseId of ["market-innovation", "operating-systems-intro", "applied-mathematics-b", "database", "interaction-design-intro", "network-technology", "social-research-methods"]) {
      state = selectCourse(state, courseId);
    }
    expect(selectHomeTasks(state).find((task) => task.id === "cap-exceeded")).toBeDefined();
  });

  it("前期unknownを問題なし扱いせず確認taskにする", () => {
    const state = appReducer(readyState(), { type: "SET_PREVIOUS_COURSE_STATUS", payload: { courseId: firstSemesterRequiredCourses[0].id, status: "unknown" } });
    expect(selectHomeTasks(state).find((task) => task.id === "first-semester-unknown")).toMatchObject({ href: "/settings" });
  });

  it("抽選validation errorをwarningへ集約する", () => {
    let state = selectCourse(readyState(), "market-innovation");
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: { courseId: "market-innovation", status: "applied", preferences: [{ offeringId: "2026-second-market-innovation-A", rank: 1 }] },
    });
    state = appReducer(state, { type: "SET_TIMETABLE_MODEL", payload: "B" });
    expect(selectAppWarnings(state).find((warning) => warning.code === "LOTTERY_VALIDATION")).toBeDefined();
  });

  it("技法の前期登録unknownを特殊科目taskにする", () => {
    const state = {
      ...readyState(),
      firstSemester: {
        ...readyState().firstSemester,
        innovationMethod: { registeredInFirstSemester: "unknown" as const, moduleType: null, confirmedByUser: true },
      },
    };
    expect(selectHomeTasks(state).find((task) => task.id === "innovation-method-registration-unknown")).toMatchObject({ href: "/setup/innovation-method" });
  });

  it("taskは正しい詳細ページを参照する", () => {
    const state = selectCourse(readyState(), "database");
    expect(selectHomeTasks(state).every((task) => task.href.startsWith("/"))).toBe(true);
  });

  it("HomeTaskやwarningをAppStateへ保存しない", () => {
    const state = readyState();
    selectDashboardSummary(state);
    expect("tasks" in state).toBe(false);
    expect("warnings" in state).toBe(false);
  });
});

describe("Phase 7 FinalReview derived state", () => {
  it("後期必修8科目・14単位を表示用に生成する", () => {
    const summary = selectFinalReviewSummary(readyState());
    expect(summary.requiredTimetable?.courses).toHaveLength(8);
    expect(summary.requiredTimetable?.totalCredits).toBe(14);
  });

  it("won通常科目を抽出する", () => {
    let state = applyForDatabase(selectCourse(readyState(), "database"));
    state = appReducer(state, { type: "SET_LOTTERY_RESULT", payload: { courseId: "database", result: "won", wonOfferingId: "2026-second-database-C" } });
    expect(selectFinalReviewSummary(state).normalLottery.won.map((course) => course.id)).toEqual(["database"]);
  });

  it("lost通常科目を抽出する", () => {
    let state = applyForDatabase(selectCourse(readyState(), "database"));
    state = appReducer(state, { type: "SET_LOTTERY_RESULT", payload: { courseId: "database", result: "lost", wonOfferingId: null } });
    expect(selectFinalReviewSummary(state).normalLottery.lost.map((course) => course.id)).toEqual(["database"]);
  });

  it("won + confirmedをUNIPA確認済みに分類する", () => {
    let state = applyForDatabase(selectCourse(readyState(), "database"));
    state = appReducer(state, { type: "SET_LOTTERY_RESULT", payload: { courseId: "database", result: "won", wonOfferingId: "2026-second-database-C" } });
    state = appReducer(state, { type: "SET_LOTTERY_REGISTRATION_CONFIRMATION", payload: { courseId: "database", status: "confirmed" } });
    expect(selectFinalReviewSummary(state).normalLottery.confirmed).toHaveLength(1);
  });

  it("won + unconfirmedを未確認とtaskへ分類する", () => {
    let state = applyForDatabase(selectCourse(readyState(), "database"));
    state = appReducer(state, { type: "SET_LOTTERY_RESULT", payload: { courseId: "database", result: "won", wonOfferingId: "2026-second-database-C" } });
    const summary = selectFinalReviewSummary(state);
    expect(summary.normalLottery.unconfirmed).toHaveLength(1);
    expect(summary.tasks.some((task) => task.id === "lottery-unipa-unconfirmed")).toBe(true);
  });

  it("applied + pendingを結果未入力に分類する", () => {
    const summary = selectFinalReviewSummary(applyForDatabase(selectCourse(readyState(), "database")));
    expect(summary.normalLottery.pending).toHaveLength(1);
    expect(summary.tasks.some((task) => task.id === "lottery-pending")).toBe(true);
  });

  it("特講当選状態をsummaryへ反映する", () => {
    let state = appReducer(readyState(), { type: "SET_INNOVATION_LECTURE_APPLICATION_STATUS", payload: "applied" });
    state = appReducer(state, { type: "SET_INNOVATION_LECTURE_RESULT", payload: { result: "won", wonClassId: "innovation-lecture-kang-hanna" } });
    expect(selectFinalReviewSummary(state).special.lecture).toContain("当選");
  });

  it("技法continuationをsummaryへ反映する", () => {
    let state = appReducer(readyState(), { type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION", payload: true });
    state = appReducer(state, { type: "SET_FIRST_SEMESTER_INNOVATION_MODULE_TYPE", payload: "lecture" });
    expect(selectFinalReviewSummary(state).special.method).toContain("前期から継続");
  });

  it("unknown値を問題なし扱いしない", () => {
    const state = { ...readyState(), firstSemester: { ...readyState().firstSemester, innovationMethod: { registeredInFirstSemester: "unknown" as const, moduleType: null, confirmedByUser: true } } };
    expect(selectFinalReviewSummary(state).tasks.some((task) => task.id === "innovation-method-registration-unknown")).toBe(true);
  });
});

describe("Phase 7 Settings", () => {
  it("モデル変更後も抽選記録を保持する", () => {
    const state = applyForDatabase(selectCourse(readyState(), "database"));
    const changed = appReducer(state, { type: "SET_TIMETABLE_MODEL", payload: "D" });
    expect(changed.lotteries).toEqual(state.lotteries);
    expect(changed.setupCompleted).toBe(false);
  });

  it("英語変更後も抽選記録を保持する", () => {
    const state = applyForDatabase(selectCourse(readyState(), "database"));
    const changed = appReducer(state, { type: "SET_ENGLISH_TRACK", payload: "normal" });
    expect(changed.lotteries).toEqual(state.lotteries);
  });

  it("設定変更後にvalidation warningを再計算する", () => {
    let state = selectCourse(readyState(), "interaction-design-intro");
    state = appReducer(state, { type: "SET_LOTTERY_APPLICATION_STATUS", payload: { courseId: "interaction-design-intro", status: "applied", preferences: [{ offeringId: "2026-second-interaction-design-intro-ALL", scheduleOptionId: "tue4", rank: 1 }] } });
    expect(selectHomeTasks(state).some((task) => task.id === "lottery-validation")).toBe(true);
  });

  it("確認前にはRESET_APPをdispatchしない", () => {
    const dispatch = vi.fn();
    render(<AppStateContext.Provider value={{ state: readyState(), dispatch }}><MemoryRouter><SettingsPage /></MemoryRouter></AppStateContext.Provider>);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "すべてのデータを初期化" }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText("本当に初期化しますか？")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "本当に初期化しますか？",
    );
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
  });

  it("確認後だけRESET_APPをdispatchする", () => {
    const dispatch = vi.fn();
    render(<AppStateContext.Provider value={{ state: readyState(), dispatch }}><MemoryRouter><SettingsPage /></MemoryRouter></AppStateContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "すべてのデータを初期化" }));
    fireEvent.click(screen.getByRole("button", { name: "初期化を実行" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "RESET_APP" });
  });
});

describe("Phase 7 Error Boundary", () => {
  function BrokenPage(): never {
    throw new Error("broken academic data");
  }

  it("年度データ生成がthrowしてもfallback UIを表示する", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);
    expect(screen.getByRole("heading", { name: "データの読み込み中に問題が発生しました" })).toBeInTheDocument();
    expect(screen.queryByText("broken academic data")).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("fallback表示時にLocalStorageをclearしない", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const clearSpy = vi.spyOn(Storage.prototype, "clear");
    render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Phase 7 CourseDetail", () => {
  it("valid courseIdなら科目情報を返す", () => {
    expect(selectCourseDetail(readyState(), "database")).toMatchObject({ course: { name: "データベース", credits: 2 }, registrationMethod: "lottery" });
  });

  it("unknown courseIdなら安全にnullを返す", () => {
    expect(selectCourseDetail(readyState(), "not-a-course")).toBeNull();
  });

  it("登録済みシラバスを公式ソースの注意とともに表示する", () => {
    render(<AppStateContext.Provider value={{ state: readyState(), dispatch: vi.fn() }}><MemoryRouter initialEntries={["/courses/database"]}><Routes><Route path="/courses/:courseId" element={<CourseDetailPage />} /></Routes></MemoryRouter></AppStateContext.Provider>);
    expect(screen.getByRole("heading", { name: "データベース" })).toBeInTheDocument();
    expect(screen.getByText(/2026年度公式シラバスをもとに表示しています/)).toBeInTheDocument();
  });
});
