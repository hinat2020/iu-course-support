import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function configuredState(entries: AppState["graduationPlan"]["entries"] = []): AppState {
  const initial = createInitialState();
  return {
    ...initial,
    user: { ...initial.user, timetableModel: "C", englishTrack: "advanced" },
    graduationPlan: { entries },
  };
}

function renderPlanner(initial = configuredState()) {
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

describe("Phase 15B desktop-centered graduation planning UI", () => {
  it("8学期を必修と自分で選んだ科目へ分け、各学期に追加導線を置く", () => {
    renderPlanner();
    for (const label of ["1年前期", "1年後期", "2年前期", "2年後期", "3年前期", "3年後期", "4年前期", "4年後期"]) {
      const card = screen.getByRole("heading", { name: label }).closest("section")!;
      expect(within(card).getByRole("heading", { name: "必修" })).toBeInTheDocument();
      expect(within(card).getByRole("heading", { name: "自分で選んだ科目" })).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: `${label}に科目を追加` })).toBeInTheDocument();
    }
  });

  it("学期カードから追加すると配置先を初期選択し、追加後に科目へfocusする", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "2年後期に科目を追加" }));
    expect(screen.getByRole("dialog", { name: "科目を追加" })).toBeInTheDocument();
    expect(screen.getByLabelText("配置する学期")).toHaveValue("year2-fall");
    fireEvent.change(screen.getByLabelText("科目名検索"), { target: { value: "データサイエンス基礎" } });
    fireEvent.click(screen.getByRole("radio", { name: /データサイエンス基礎/ }));
    fireEvent.click(screen.getByRole("button", { name: "この学期に追加" }));
    expect(document.activeElement?.id).toBe("graduation-course-data-science-foundations");
  });

  it("必修には編集操作を出さずplannedには移動・削除操作を出す", () => {
    renderPlanner(configuredState([{ courseId: "data-science-foundations", semesterId: "year2-spring" }]));
    const required = screen.getByText("基礎プロジェクトⅠ").closest("li")!;
    expect(within(required).queryByRole("button", { name: "学期を変更" })).not.toBeInTheDocument();
    expect(within(required).queryByRole("button", { name: "計画から外す" })).not.toBeInTheDocument();
    const planned = screen.getByText("データサイエンス基礎").closest("li")!;
    expect(within(planned).getByRole("button", { name: "学期を変更" })).toBeInTheDocument();
    expect(within(planned).getByRole("button", { name: "計画から外す" })).toBeInTheDocument();
  });

  it("学期変更dialogで現在地・8学期・constraint previewを示し移動後focusする", () => {
    renderPlanner(configuredState([{ courseId: "data-science-foundations", semesterId: "year2-spring" }]));
    const planned = screen.getByText("データサイエンス基礎").closest("li")!;
    fireEvent.click(within(planned).getByRole("button", { name: "学期を変更" }));
    const dialog = screen.getByRole("dialog", { name: "学期を変更" });
    expect(within(dialog).getByText("現在：2年前期")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /年/ })).toHaveLength(8);
    expect(within(dialog).getByRole("heading", { name: "移動preview" })).toBeInTheDocument();
    expect(within(dialog).getByText(/前提科目/)).toBeInTheDocument();
    expect(within(dialog).getByText(/CAP/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "2年後期" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "確認して移動" }));
    expect(document.activeElement?.id).toBe("graduation-course-data-science-foundations");
    expect(screen.getAllByText("データサイエンス基礎")).toHaveLength(1);
  });

  it("計画から外す操作は確認前に削除せず、cancelと確定を扱う", () => {
    renderPlanner(configuredState([{ courseId: "data-science-foundations", semesterId: "year2-spring" }]));
    let planned = screen.getByText("データサイエンス基礎").closest("li")!;
    fireEvent.click(within(planned).getByRole("button", { name: "計画から外す" }));
    const firstDialog = screen.getByRole("dialog", { name: "計画から外しますか？" });
    expect(screen.getByText("データサイエンス基礎")).toBeInTheDocument();
    expect(within(firstDialog).getByText("単位修得記録を削除する操作ではありません。")).toBeInTheDocument();
    fireEvent.click(within(firstDialog).getByRole("button", { name: "キャンセル" }));
    planned = screen.getByText("データサイエンス基礎").closest("li")!;
    fireEvent.click(within(planned).getByRole("button", { name: "計画から外す" }));
    const secondDialog = screen.getByRole("dialog", { name: "計画から外しますか？" });
    fireEvent.click(within(secondDialog).getByRole("button", { name: "計画から外す" }));
    expect(screen.queryByText("データサイエンス基礎")).not.toBeInTheDocument();
  });

  it("Plan Check・記号別要件・CAP詳細を初期折りたたみにする", () => {
    renderPlanner();
    for (const summaryText of [
      /確認事項の詳細を見る/,
      "記号別要件・選択区分の詳細を見る",
      "CAP詳細を見る",
    ]) {
      const summary = screen.getByText(summaryText);
      const details = summary.closest("details")!;
      expect(details).not.toHaveAttribute("open");
      fireEvent.click(summary);
      expect(details).toHaveAttribute("open");
    }
  });

  it("通常追加と不足要件候補dialogの目的を区別する", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
    expect(screen.getByRole("dialog", { name: "科目を追加" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "科目選択を閉じる" }));
    fireEvent.click(screen.getAllByRole("button", { name: "候補科目を見る" })[0]);
    expect(screen.getByRole("dialog", { name: "不足を埋める科目を探す" })).toBeInTheDocument();
  });

  it("UIの開閉状態は永続stateへ追加せずschemaVersion 5を維持する", () => {
    const state = configuredState();
    renderPlanner(state);
    fireEvent.click(screen.getByText("CAP詳細を見る"));
    expect(state.schemaVersion).toBe(5);
    expect(Object.keys(state)).not.toContain("graduationUi");
  });
});
