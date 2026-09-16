import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  curriculumCourses,
  curriculumCoursesById,
} from "../data/2026/curriculum";
import {
  getRequiredCourseAutomaticPlacement,
  getUnresolvedRequiredCoursePlacement,
  type CurriculumCourse,
} from "../domain/graduationPlanning";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import {
  selectGraduationBoard,
  selectGraduationCandidatesForRequirement,
  selectGraduationCapPlan,
  selectGraduationPrerequisiteChecks,
  selectGraduationRequirementProgress,
  selectUnplacedCurriculumCourses,
  selectUnresolvedRequiredCourses,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { saveState, STORAGE_KEY } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function configuredState(): AppState {
  const initial = createInitialState();
  return {
    ...initial,
    user: { ...initial.user, timetableModel: "C", englishTrack: "advanced" },
  };
}

function renderPlanner(initial: AppState = configuredState()) {
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

describe("Phase 15A required course derivation", () => {
  it("36必修すべての配当学期を公式curriculumから一意に導出する", () => {
    const required = curriculumCourses.filter((course) => course.requirementType === "required");
    expect(required).toHaveLength(36);
    expect(required.every((course) => getRequiredCourseAutomaticPlacement(course))).toBe(true);
    expect(selectUnresolvedRequiredCourses()).toEqual([]);
  });

  it("2年前期と3年後期の必修を自動配置する", () => {
    const board = selectGraduationBoard(createInitialState());
    const year2Spring = board.find((semester) => semester.id === "year2-spring")!;
    const year3Fall = board.find((semester) => semester.id === "year3-fall")!;
    expect(year2Spring.courses).toHaveLength(5);
    expect(year3Fall.courses).toHaveLength(4);
    expect([...year2Spring.courses, ...year3Fall.courses].every(
      (entry) => entry.source === "required_auto" && !entry.editable,
    )).toBe(true);
  });

  it("配置が一意でない必修は自動配置せず理由を返す", () => {
    const course: CurriculumCourse = {
      ...curriculumCourses.find((item) => item.requirementType === "required")!,
      courseId: "ambiguous-required",
      recommendedYears: [2, 3],
      availableSemesters: ["spring", "fall"],
    };
    expect(getRequiredCourseAutomaticPlacement(course)).toBeNull();
    expect(getUnresolvedRequiredCoursePlacement(course)?.reasons).toEqual([
      "multiple_years",
      "multiple_semesters",
    ]);
  });

  it.each([
    ["earned", "earned", "first_semester"],
    ["failed", "planned", "required_auto"],
    ["not_taken", "planned", "required_auto"],
    ["unknown", "planned", "required_auto"],
  ] as const)("1年前期%sを安全な状態で表示する", (previous, status, source) => {
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: previous },
    });
    const entry = selectGraduationBoard(state)
      .find((semester) => semester.id === "year1-spring")!
      .courses.find((item) => item.course.courseId === "study-skills")!;
    expect(entry.status).toBe(status);
    expect(entry.source).toBe(source);
  });

  it("1年後期8必修14単位を今学期必修として優先表示する", () => {
    const fall = selectGraduationBoard(configuredState()).find(
      (semester) => semester.id === "year1-fall",
    )!;
    const required = fall.courses.filter((entry) => entry.course.requirementType === "required");
    expect(required).toHaveLength(8);
    expect(required.reduce((sum, entry) => sum + entry.course.credits, 0)).toBe(14);
    expect(required.every((entry) => entry.source === "current_registration")).toBe(true);
  });

  it("必修を一般検索・Candidate Engineから除外する", () => {
    const state = createInitialState();
    expect(selectUnplacedCurriculumCourses(state).some(
      (course) => course.requirementType === "required",
    )).toBe(false);
    expect(selectGraduationCandidatesForRequirement(state, "required-courses")).toEqual([]);
  });

  it("必修の追加・移動・削除actionを拒否する", () => {
    const initial = createInitialState();
    const requiredId = "basic-project-1";
    expect(appReducer(initial, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: requiredId, semesterId: "year4-fall" },
    })).toBe(initial);
    const legacy: AppState = {
      ...initial,
      graduationPlan: { entries: [{ courseId: requiredId, semesterId: "year4-fall" }] },
    };
    expect(appReducer(legacy, {
      type: "MOVE_GRADUATION_PLAN_COURSE",
      payload: { courseId: requiredId, semesterId: "year2-fall" },
    })).toBe(legacy);
    expect(appReducer(legacy, {
      type: "REMOVE_GRADUATION_PLAN_COURSE",
      payload: requiredId,
    })).toBe(legacy);
  });

  it("古いplanned必修を自動配置へ統合して一度だけ数える", () => {
    const state: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "basic-project-1", semesterId: "year4-fall" }],
      },
    };
    const matching = selectGraduationBoard(state).flatMap((semester) => semester.courses)
      .filter((entry) => entry.course.courseId === "basic-project-1");
    expect(matching).toHaveLength(1);
    expect(matching[0].semesterId).toBe("year2-spring");
    expect(matching[0].source).toBe("required_auto");
  });

  it("自動必修を卒業要件・将来CAP・前提科目へ接続する", () => {
    const state = configuredState();
    const progress = selectGraduationRequirementProgress(state);
    expect(progress.requiredCourses.plannedIncludedCourses).toBe(36);
    expect(progress.requiredCourses.plannedIncludedCredits).toBe(74);
    const cap = selectGraduationCapPlan(state);
    for (const grade of [2, 3, 4] as const) {
      const expected = curriculumCourses
        .filter((course) =>
          course.requirementType === "required" && course.recommendedYears[0] === grade
        )
        .reduce((sum, course) => sum + course.credits, 0);
      expect(cap.find((item) => item.grade === grade)?.annualCredits).toBe(expected);
    }
    expect(selectGraduationPrerequisiteChecks(state).get("basic-project-2")?.status)
      .toBe("satisfied");
  });

  it("required_autoをLocalStorageへ保存せずschema v5を維持する", () => {
    const state = configuredState();
    selectGraduationBoard(state);
    saveState(state);
    const raw = localStorage.getItem(STORAGE_KEY)!;
    expect(JSON.parse(raw).schemaVersion).toBe(5);
    expect(raw).not.toContain("required_auto");
    expect(JSON.parse(raw).graduationPlan.entries).toEqual([]);
  });
});

describe("Phase 15A required course UI", () => {
  it("自動必修を非編集カードとして表示し通常検索に出さない", () => {
    renderPlanner();
    const card = screen.getByText("基礎プロジェクトⅠ").closest("li")!;
    expect(within(card).getByText("▣ 必修・将来予定（自動表示）")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "計画から外す" })).not.toBeInTheDocument();
    expect(within(card).queryByLabelText("基礎プロジェクトⅠの配置学期")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "基礎プロジェクトⅠ" },
    });
    expect(screen.getByText(/公式curriculumに基づき2年前期へ自動表示/)).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /基礎プロジェクトⅠ/ })).not.toBeInTheDocument();
  });

  it("配置時期未確定必修が0件であることを明示する", () => {
    renderPlanner();
    expect(screen.getByRole("heading", {
      name: "配置時期を自動決定できない必修科目",
    })).toBeInTheDocument();
    expect(screen.getByText(/配置時期が一意に決まらない必修科目はありません/))
      .toBeInTheDocument();
  });

  it("1年前期のfailed・not_taken・unknownを色だけに依存せず区別する", () => {
    let state = createInitialState();
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "failed" },
    });
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "ict-introduction", status: "not_taken" },
    });
    renderPlanner(state);
    expect(screen.getByText("△ 必修・未修得")).toBeInTheDocument();
    expect(screen.getByText("□ 必修・未履修")).toBeInTheDocument();
    expect(screen.getAllByText("？ 必修・状態未確認").length).toBeGreaterThan(0);
  });

  it("必修進捗を自動配置で計画上到達として表示する", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "必修科目" }).closest("article")!;
    expect(within(card).getByText(/計画上到達/)).toBeInTheDocument();
    expect(within(card).getByText("計画含む").nextSibling).toHaveTextContent("36科目");
    expect(screen.queryByText(/未計画の必修科目/)).not.toBeInTheDocument();
  });
});

it("official curriculumの代表必修courseIdを維持する", () => {
  expect(curriculumCoursesById.get("basic-project-1")?.name).toBe("基礎プロジェクトⅠ");
});
