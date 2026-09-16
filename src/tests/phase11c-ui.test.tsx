import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { curriculumCourses } from "../data/2026/curriculum";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { loadState, saveState } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPlanner(initial: AppState = createInitialState()) {
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

function openSearchFor(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
  fireEvent.change(screen.getByLabelText("科目名検索"), {
    target: { value: name },
  });
}

describe("Phase 11C graduation planning UI", () => {
  it("修得済みと履修予定の学期単位を混同しない", () => {
    const earned = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    renderPlanner(earned);
    const spring = screen.getByRole("heading", { name: "1年前期" }).closest("section");
    expect(within(spring!).getByText("修得済み 2単位")).toBeInTheDocument();
    expect(within(spring!).getByText("将来予定 0単位")).toBeInTheDocument();
    expect(within(spring!).queryByRole("button", { name: "計画から外す" })).not.toBeInTheDocument();
  });

  it.each(["failed", "not_taken", "unknown"] as const)(
    "前期%s科目を修得済みとして表示しない",
    (status) => {
      const state = appReducer(createInitialState(), {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId: "study-skills", status },
      });
      renderPlanner(state);
      const spring = screen.getByRole("heading", { name: "1年前期" }).closest("section");
      expect(within(spring!).queryByText("スタディスキル")).not.toBeInTheDocument();
    },
  );

  it("配置済み科目を再検索すると配置先を説明し、追加を防ぐ", () => {
    const initial: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }],
      },
    };
    renderPlanner(initial);
    openSearchFor("データサイエンス基礎");
    expect(screen.getByText("この科目は2年前期に履修予定として配置されています。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この学期に追加" })).toBeDisabled();
  });

  it("前期修得済み科目は重複配置できず、理由を表示する", () => {
    const earned = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    renderPlanner(earned);
    openSearchFor("スタディスキル");
    expect(screen.getByText(/1年前期に修得済みとして表示されています/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この学期に追加" })).toBeDisabled();
  });

  it("特殊科目だけを検索した場合は一般配置の対象外と説明する", () => {
    const special = curriculumCourses.find((course) => course.planningAvailability === "managed_elsewhere");
    expect(special).toBeDefined();
    renderPlanner();
    openSearchFor(special!.name);
    expect(screen.getByText("特殊な履修方法の科目は現在この画面から配置できません。")).toBeInTheDocument();
  });

  it("検索結果がない場合は明示的な空状態を表示する", () => {
    renderPlanner();
    openSearchFor("該当しない科目名");
    expect(screen.getByText("条件に一致する未配置科目がありません。")).toBeInTheDocument();
  });

  it("配置学期変更後に年次・学期のsoft warningを表示する", () => {
    const initial: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }],
      },
    };
    renderPlanner(initial);
    fireEvent.change(screen.getByLabelText("データサイエンス基礎の配置学期"), {
      target: { value: "year1-spring" },
    });
    expect(screen.getByText(/2年次配当/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("データサイエンス基礎の配置学期"), {
      target: { value: "year2-fall" },
    });
    expect(screen.getByText("公式資料では前期科目です。")).toBeInTheDocument();
    expect(screen.getAllByText("データサイエンス基礎")).toHaveLength(1);
  });

  it("curriculumにだけある科目を存在しない詳細ページへリンクしない", () => {
    const initial: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }],
      },
    };
    renderPlanner(initial);
    const card = screen.getByText("データサイエンス基礎").closest("li");
    expect(within(card!).queryByRole("link", { name: "データサイエンス基礎" })).not.toBeInTheDocument();
    expect(within(card!).getByText("科目詳細は卒業設計データのみです。")).toBeInTheDocument();
  });

  it("保存された計画を再読み込み後の画面にも表示する", () => {
    const saved = appReducer(createInitialState(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    saveState(saved);
    renderPlanner(loadState());
    const spring = screen.getByRole("heading", { name: "2年前期" }).closest("section");
    expect(within(spring!).getByText("データサイエンス基礎")).toBeInTheDocument();
  });
});
