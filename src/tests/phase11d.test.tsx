import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import { selectDashboardSummary } from "../state/dashboardSelectors";
import {
  selectGraduationBoard,
  selectGraduationCandidateSituations,
  selectGraduationCreditSummary,
  selectGraduationRequirementSummary,
  selectGraduationSpecialSummary,
  selectSupersededGraduationPlanEntries,
  selectUnplacedCurriculumCourses,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";

afterEach(cleanup);

function configuredState() {
  return appReducer(
    appReducer(createInitialState(), { type: "SET_TIMETABLE_MODEL", payload: "C" }),
    { type: "SET_ENGLISH_TRACK", payload: "normal" },
  );
}

function withDatabaseLottery(
  state: AppState,
  resultStatus: "pending" | "won" | "lost",
  confirmation: "unconfirmed" | "confirmed" = "unconfirmed",
): AppState {
  return {
    ...state,
    plannedCourses: { ...state.plannedCourses, database: { selected: true } },
    lotteries: {
      ...state.lotteries,
      database: {
        courseId: "database",
        applicationStatus: "applied",
        preferences: [],
        resultStatus,
        wonOfferingId: resultStatus === "won" ? "2026-second-database-C" : null,
        wonScheduleOptionId: null,
        registrationConfirmation: confirmation,
      },
    },
  };
}

function renderPlanner(initial: AppState) {
  function Harness() {
    const [state, dispatch] = useReducer(appReducer, initial);
    return (
      <AppStateContext.Provider value={{ state, dispatch }}>
        <MemoryRouter><GraduationPlanPage /></MemoryRouter>
      </AppStateContext.Provider>
    );
  }
  return render(<Harness />);
}

describe("Phase 11D graduated credit classification", () => {
  it("前期earnedのみ修得済みへ集計する", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    expect(selectGraduationCreditSummary(state)).toMatchObject({
      earnedCredits: 2,
      currentCredits: 0,
      plannedCredits: 72,
      totalPlannedCredits: 74,
    });
    expect(state.graduationPlan.entries).toEqual([]);
  });

  it.each(["failed", "not_taken", "unknown"] as const)(
    "前期%sを修得単位へ入れない",
    (status) => {
      const state = appReducer(createInitialState(), {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId: "study-skills", status },
      });
      expect(selectGraduationCreditSummary(state).earnedCredits).toBe(0);
    },
  );

  it("後期必修8科目14単位は今学期対象で修得済みではない", () => {
    const state = configuredState();
    const current = selectGraduationBoard(state).flatMap((term) => term.courses)
      .filter((entry) => entry.source === "current_registration");
    expect(current).toHaveLength(8);
    expect(selectGraduationCreditSummary(state)).toMatchObject({
      earnedCredits: 0,
      currentCredits: 14,
      plannedCredits: 60,
    });
  });

  it("selectedだけの候補は今学期対象・将来予定へ加算しない", () => {
    const state = {
      ...configuredState(),
      plannedCourses: { database: { selected: true } },
    };
    expect(selectGraduationCandidateSituations(state).find((item) => item.courseId === "database")?.status).toBe("considering");
    expect(selectGraduationCreditSummary(state).currentCredits).toBe(14);
    expect(selectGraduationCreditSummary(state).plannedCredits).toBe(60);
  });

  it("応募済み・結果待ちは今学期対象へ入れない", () => {
    const state = withDatabaseLottery(configuredState(), "pending");
    expect(selectGraduationCandidateSituations(state).find((item) => item.courseId === "database")?.status).toBe("pending");
    expect(selectGraduationCreditSummary(state).currentCredits).toBe(14);
    expect(selectGraduationCreditSummary(state).plannedCredits).toBe(60);
  });

  it("応募済みで結果未入力も今学期対象へ入れない", () => {
    const pending = withDatabaseLottery(configuredState(), "pending");
    const state: AppState = {
      ...pending,
      lotteries: {
        ...pending.lotteries,
        database: { ...pending.lotteries.database, resultStatus: null },
      },
    };
    expect(selectGraduationCandidateSituations(state).find((item) => item.courseId === "database")?.status).toBe("applied");
    expect(selectGraduationCreditSummary(state).currentCredits).toBe(14);
  });

  it("落選は今学期対象へ入れない", () => {
    const state = withDatabaseLottery(configuredState(), "lost");
    expect(selectGraduationCandidateSituations(state).find((item) => item.courseId === "database")?.status).toBe("lost");
    expect(selectGraduationCreditSummary(state).currentCredits).toBe(14);
  });

  it("当選・UNIPA未確認は修得済み・今学期対象へ入れない", () => {
    const state = withDatabaseLottery(configuredState(), "won");
    expect(selectGraduationCandidateSituations(state).find((item) => item.courseId === "database")?.status).toBe("won_unconfirmed");
    expect(selectGraduationCreditSummary(state)).toMatchObject({
      earnedCredits: 0,
      currentCredits: 14,
    });
  });

  it("当選・UNIPA確認済みは今学期対象へ加え、修得済みではない", () => {
    const state = withDatabaseLottery(configuredState(), "won", "confirmed");
    expect(selectGraduationCandidateSituations(state).find((item) => item.courseId === "database")?.status).toBe("won_confirmed");
    expect(selectGraduationCreditSummary(state)).toMatchObject({
      earnedCredits: 0,
      currentCredits: 16,
      plannedCredits: 60,
      totalPlannedCredits: 76,
    });
  });

  it("当選確認済みと同一科目の将来plannedを二重計上せず、保存記録を知らせる", () => {
    const state: AppState = {
      ...withDatabaseLottery(configuredState(), "won", "confirmed"),
      graduationPlan: { entries: [{ courseId: "database", semesterId: "year2-spring" }] },
    };
    expect(selectGraduationCreditSummary(state)).toMatchObject({
      currentCredits: 16,
      plannedCredits: 60,
      totalPlannedCredits: 76,
    });
    expect(selectSupersededGraduationPlanEntries(state).map((item) => item.courseId)).toEqual(["database"]);
  });

  it("earnedと同一科目の将来plannedを二重計上しない", () => {
    const earned = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    const state: AppState = {
      ...earned,
      graduationPlan: { entries: [{ courseId: "study-skills", semesterId: "year2-spring" }] },
    };
    expect(selectGraduationCreditSummary(state)).toMatchObject({
      earnedCredits: 2,
      plannedCredits: 72,
      totalPlannedCredits: 74,
    });
  });

  it("現在対象科目を将来学期へ追加できない", () => {
    const state = withDatabaseLottery(configuredState(), "won", "confirmed");
    const action = {
      type: "ADD_GRADUATION_PLAN_COURSE" as const,
      payload: { courseId: "database", semesterId: "year2-spring" as const },
    };
    expect(appReducer(state, action)).toBe(state);
    expect(selectUnplacedCurriculumCourses(state, { query: "データベース" })).toEqual([]);
  });

  it("要件記号はcurriculumの修得済みと計画を別々に集計する", () => {
    const earned = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "computer-architecture", status: "earned" },
    });
    const state: AppState = {
      ...earned,
      graduationPlan: { entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }] },
    };
    const ict = selectGraduationRequirementSummary(state).find((item) => item.symbol === "■");
    expect(ict).toEqual({
      symbol: "■",
      earnedCredits: 2,
      planIncludingCurrentCredits: 4,
    });
  });

  it("特殊科目は状態案内のみで通常の単位合計へ含めない", () => {
    const base = createInitialState();
    const state: AppState = {
      ...base,
      firstSemester: {
        ...base.firstSemester,
        innovationMethod: {
          ...base.firstSemester.innovationMethod,
          registeredInFirstSemester: true,
          moduleType: "lecture",
        },
      },
      innovationLecture: {
        ...base.innovationLecture,
        resultStatus: "won",
        wonClassId: "sample-class",
        registrationConfirmation: "confirmed",
      },
    };
    expect(selectGraduationSpecialSummary(state)).toMatchObject({
      lecture: "当選・UNIPA確認済み",
      method: "前期から継続（後期自動登録）",
      includedInCredits: false,
    });
    expect(selectGraduationCreditSummary(state).totalPlannedCredits).toBe(74);
  });

  it("特殊科目の前期earned記録も一般科目の修得単位へ混ぜない", () => {
    const base = createInitialState();
    const state: AppState = {
      ...base,
      firstSemester: {
        ...base.firstSemester,
        courses: {
          "innovation-lecture-a": {
            courseId: "innovation-lecture-a",
            status: "earned",
            confirmedByUser: true,
          },
        },
      },
    };
    expect(selectGraduationCreditSummary(state).earnedCredits).toBe(0);
  });

  it("RESET_APPで計画も消える", () => {
    const planned = appReducer(createInitialState(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    expect(appReducer(planned, { type: "RESET_APP" }).graduationPlan.entries).toEqual([]);
  });

  it("model・英語の変更で手動計画を消さない", () => {
    const planned = appReducer(createInitialState(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    const changedModel = appReducer(planned, { type: "SET_TIMETABLE_MODEL", payload: "D" });
    const changedEnglish = appReducer(changedModel, { type: "SET_ENGLISH_TRACK", payload: "advanced" });
    expect(changedEnglish.graduationPlan).toEqual(planned.graduationPlan);
  });

  it("前期修得状況の変更を即時にearned表示へ反映する", () => {
    const base = createInitialState();
    const earned = appReducer(base, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    expect(selectGraduationCreditSummary(earned).earnedCredits).toBe(2);
    const failed = appReducer(earned, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "failed" },
    });
    expect(selectGraduationCreditSummary(failed).earnedCredits).toBe(0);
  });

  it("schema v5と他機能の状態・サマリーを変更しない", () => {
    const state = withDatabaseLottery(configuredState(), "pending");
    const before = selectDashboardSummary(state);
    const after = appReducer(state, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    expect(after.schemaVersion).toBe(5);
    expect(after.lotteries).toEqual(state.lotteries);
    expect(after.innovationLecture).toEqual(state.innovationLecture);
    expect(after.innovationMethod).toEqual(state.innovationMethod);
    expect(selectDashboardSummary(after)).toEqual(before);
  });
});

describe("Phase 11D UI", () => {
  it("修得済み・今学期対象・将来予定を分けて表示する", () => {
    const earned = appReducer(configuredState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    const state = appReducer(earned, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    renderPlanner(state);
    const summary = screen.getByRole("region", { name: "計画単位の内訳" });
    expect(within(summary).getByText("修得済み").nextElementSibling).toHaveTextContent("2単位");
    expect(within(summary).getByText("今学期の履修対象").nextElementSibling).toHaveTextContent("14単位");
    expect(within(summary).getByText("将来予定").nextElementSibling).toHaveTextContent("60単位");
    const fall = screen.getByRole("region", { name: "1年後期" });
    expect(within(fall).getAllByText("● 今学期の必修")).toHaveLength(8);
    expect(within(fall).queryByText("✓ 修得済み")).not.toBeInTheDocument();
  });

  it("未確認の当選を状況一覧に表示するがボードの対象にしない", () => {
    renderPlanner(withDatabaseLottery(configuredState(), "won"));
    expect(screen.getByText("当選・UNIPA最終確認未完了")).toBeInTheDocument();
    expect(screen.queryByText("● 今学期の履修対象")).not.toBeInTheDocument();
  });

  it("UNIPA確認済み当選を今学期対象に表示する", () => {
    renderPlanner(withDatabaseLottery(configuredState(), "won", "confirmed"));
    const fall = screen.getByRole("region", { name: "1年後期" });
    expect(within(fall).getByText("● 今学期の履修対象")).toBeInTheDocument();
    expect(within(fall).getByText("データベース")).toBeInTheDocument();
  });

  it("既存計画が今学期対象と重なったら警告し、手動で外せる", () => {
    const state: AppState = {
      ...withDatabaseLottery(configuredState(), "won", "confirmed"),
      graduationPlan: { entries: [{ courseId: "database", semesterId: "year2-spring" }] },
    };
    renderPlanner(state);
    expect(screen.getByText("重複する将来予定を確認してください")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "データベースの将来予定を外す" }));
    expect(screen.queryByText("重複する将来予定を確認してください")).not.toBeInTheDocument();
  });
});
