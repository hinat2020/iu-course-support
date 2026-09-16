import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { curriculumCourses, curriculumCoursesById } from "../data/2026/curriculum";
import {
  checkCoursePrerequisites,
  checkGraduationPlanPrerequisites,
  type PrerequisitePlacement,
} from "../domain/graduationPrerequisites";
import {
  getGraduationSemesterOrder,
  graduationSemesters,
  type CurriculumCourse,
  type GraduationSemesterId,
} from "../domain/graduationPlanning";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import { selectDashboardSummary } from "../state/dashboardSelectors";
import {
  selectGraduationPrerequisiteChecks,
  selectProspectivePrerequisiteCheck,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { saveState } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function course(courseId: string) {
  const result = curriculumCoursesById.get(courseId);
  if (!result) throw new Error(`Test course not found: ${courseId}`);
  return result;
}

function placement(
  courseId: string,
  semesterId: GraduationSemesterId,
  options: Partial<PrerequisitePlacement> = {},
): PrerequisitePlacement {
  return {
    course: course(courseId),
    semesterId,
    status: "planned",
    source: "graduation_plan",
    ...options,
  };
}

function check(
  target: CurriculumCourse,
  semesterId: GraduationSemesterId,
  placements: PrerequisitePlacement[],
) {
  return checkCoursePrerequisites({
    course: target,
    semesterId,
    placements,
    coursesById: curriculumCoursesById,
  });
}

function stateWithEarned(courseIds: string[]) {
  return courseIds.reduce(
    (state, courseId) =>
      appReducer(state, {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId, status: "earned" },
      }),
    createInitialState(),
  );
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

describe("Phase 12A official prerequisite data", () => {
  it("公式便覧由来の前提科目8件と参照整合性を維持する", () => {
    const withPrerequisites = curriculumCourses.filter(
      (item) => item.prerequisites.length > 0,
    );
    expect(withPrerequisites).toHaveLength(8);
    for (const item of withPrerequisites) {
      for (const prerequisiteId of item.prerequisites) {
        expect(curriculumCoursesById.has(prerequisiteId)).toBe(true);
      }
    }
    expect(
      Object.fromEntries(
        withPrerequisites.map((item) => [item.courseId, item.prerequisites]),
      ),
    ).toEqual({
      "basic-project-1": ["project-introduction"],
      "basic-project-2": ["basic-project-1"],
      "pre-internship-guidance": ["business-introduction", "ict-introduction"],
      "clinical-internship": ["pre-internship-guidance"],
      "post-internship-guidance": ["clinical-internship"],
      "project-practice-seminar-1": ["basic-project-2"],
      "project-practice-seminar-2": ["project-practice-seminar-1"],
      "project-practice-seminar-3": ["project-practice-seminar-2"],
    });
  });
});

describe("Phase 12A prerequisite domain", () => {
  it("前提科目なしはnot_applicable", () => {
    expect(check(course("data-science-foundations"), "year2-spring", []).status)
      .toBe("not_applicable");
  });

  it("earnedは学期位置にかかわらず満たす", () => {
    const result = check(course("basic-project-1"), "year2-spring", [
      placement("project-introduction", "year1-fall", {
        status: "earned",
        source: "first_semester",
      }),
    ]);
    expect(result.status).toBe("satisfied");
    expect(result.requirements[0].status).toBe("earned");
  });

  it("前の学期のplannedは満たす", () => {
    const result = check(course("basic-project-2"), "year2-fall", [
      placement("basic-project-1", "year2-spring"),
    ]);
    expect(result.status).toBe("satisfied");
    expect(result.requirements[0].status).toBe("planned_before");
  });

  it.each([
    ["year2-spring", "planned_same_semester"],
    ["year2-fall", "planned_after"],
  ] as const)("同学期・後学期のplannedを満たした扱いにしない", (semesterId, expected) => {
    const result = check(course("basic-project-1"), "year2-spring", [
      placement("project-introduction", semesterId),
    ]);
    expect(result.status).toBe("not_satisfied");
    expect(result.requirements[0].status).toBe(expected);
  });

  it("未配置の前提科目はmissing", () => {
    const result = check(course("basic-project-1"), "year2-spring", []);
    expect(result.status).toBe("not_satisfied");
    expect(result.requirements[0].status).toBe("missing");
  });

  it("currentはearnedとせず未確定warning", () => {
    const result = check(course("basic-project-1"), "year2-spring", [
      placement("project-introduction", "year1-fall", {
        source: "current_registration",
      }),
    ]);
    expect(result.status).toBe("warning");
    expect(result.requirements[0].status).toBe("current_unconfirmed");
  });

  it("複数前提がすべてearnedまたは前学期plannedならsatisfied", () => {
    const result = check(course("pre-internship-guidance"), "year2-spring", [
      placement("business-introduction", "year1-spring", {
        status: "earned",
        source: "first_semester",
      }),
      placement("ict-introduction", "year1-fall"),
    ]);
    expect(result.status).toBe("satisfied");
  });

  it("複数前提のうち1つ不足ならnot_satisfied", () => {
    const result = check(course("pre-internship-guidance"), "year2-spring", [
      placement("business-introduction", "year1-spring", {
        status: "earned",
        source: "first_semester",
      }),
    ]);
    expect(result.status).toBe("not_satisfied");
    expect(result.requirements.find((item) => item.prerequisiteCourseId === "ict-introduction")?.status)
      .toBe("missing");
  });

  it("8学期順序を共通定義どおり比較できる", () => {
    expect(graduationSemesters.map((item) => getGraduationSemesterOrder(item.id)))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("curriculum-only科目とdirect chainを判定できる", () => {
    const placements = [
      placement("basic-project-1", "year2-spring"),
      placement("basic-project-2", "year2-fall"),
      placement("project-practice-seminar-1", "year3-spring"),
    ];
    const checks = checkGraduationPlanPrerequisites({
      courses: curriculumCourses,
      placements,
    });
    expect(checks.find((item) => item.courseId === "basic-project-2")?.status)
      .toBe("satisfied");
    expect(checks.find((item) => item.courseId === "project-practice-seminar-1")?.status)
      .toBe("satisfied");
  });
});

describe("Phase 12A derived selectors and regression", () => {
  it("自動必修の移動actionを拒否して前提順序を維持する", () => {
    const initial: AppState = {
      ...stateWithEarned(["business-introduction"]),
      graduationPlan: {
        entries: [
          { courseId: "ict-introduction", semesterId: "year1-fall" },
          { courseId: "pre-internship-guidance", semesterId: "year2-spring" },
        ],
      },
    };
    expect(selectGraduationPrerequisiteChecks(initial).get("pre-internship-guidance")?.status)
      .toBe("satisfied");
    const moved = appReducer(initial, {
      type: "MOVE_GRADUATION_PLAN_COURSE",
      payload: { courseId: "ict-introduction", semesterId: "year3-spring" },
    });
    expect(moved).toBe(initial);
    expect(selectGraduationPrerequisiteChecks(moved).get("pre-internship-guidance")?.requirements[1].status)
      .toBe("planned_before");
  });

  it("自動必修の削除actionを拒否して前提配置を維持する", () => {
    const initial: AppState = {
      ...stateWithEarned(["business-introduction"]),
      graduationPlan: {
        entries: [
          { courseId: "ict-introduction", semesterId: "year1-fall" },
          { courseId: "pre-internship-guidance", semesterId: "year2-spring" },
        ],
      },
    };
    const removed = appReducer(initial, {
      type: "REMOVE_GRADUATION_PLAN_COURSE",
      payload: "ict-introduction",
    });
    expect(removed).toBe(initial);
    expect(selectGraduationPrerequisiteChecks(removed).get("pre-internship-guidance")?.requirements[1].status)
      .toBe("planned_before");
  });

  it("後期必修の前提はcurrent_unconfirmedとして扱う", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "C",
    });
    state = appReducer(state, { type: "SET_ENGLISH_TRACK", payload: "normal" });
    const result = selectProspectivePrerequisiteCheck(
      state,
      "basic-project-1",
      "year2-spring",
    );
    expect(result?.status).toBe("warning");
    expect(result?.requirements[0].status).toBe("current_unconfirmed");
  });

  it("warningはLocalStorageへ保存せずschema v5を維持する", () => {
    const state: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "basic-project-1", semesterId: "year2-spring" }],
      },
    };
    expect(selectGraduationPrerequisiteChecks(state).get("basic-project-1")?.status)
      .toBe("satisfied");
    saveState(state);
    const raw = localStorage.getItem("iu-course-support:v1") ?? "";
    expect(raw).not.toContain("not_satisfied");
    expect(raw).not.toContain("current_unconfirmed");
    expect(JSON.parse(raw).schemaVersion).toBe(5);
  });

  it("前提判定を追加しても既存state・ダッシュボードを変更しない", () => {
    const state: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "basic-project-1", semesterId: "year2-spring" }],
      },
    };
    const before = structuredClone(state);
    const dashboard = selectDashboardSummary(state);
    selectGraduationPrerequisiteChecks(state);
    expect(state).toEqual(before);
    expect(selectDashboardSummary(state)).toEqual(dashboard);
  });
});

describe("Phase 12A UI", () => {
  it("自動必修の前提科目をカードへ表示する", () => {
    renderPlanner({
      ...stateWithEarned(["business-introduction"]),
      graduationPlan: {
        entries: [{ courseId: "pre-internship-guidance", semesterId: "year2-spring" }],
      },
    });
    const semester = screen.getByRole("heading", { name: "2年後期" }).closest("section")!;
    const card = within(semester).getByText("実習事前指導").closest("li");
    expect(within(card!).getByText("✓ 前提科目OK")).toBeInTheDocument();
    fireEvent.click(within(card!).getByText("✓ 前提科目OK"));
    expect(within(card!).getByText(/ICT入門/)).toBeInTheDocument();
    expect(within(card!).getByText(/前の学期に履修予定/)).toBeInTheDocument();
  });

  it("満たした前提科目をカードへ表示する", () => {
    renderPlanner({
      ...stateWithEarned(["business-introduction", "ict-introduction"]),
      graduationPlan: {
        entries: [{ courseId: "pre-internship-guidance", semesterId: "year2-spring" }],
      },
    });
    const semester = screen.getByRole("heading", { name: "2年後期" }).closest("section")!;
    const card = within(semester).getByText("実習事前指導").closest("li");
    expect(within(card!).getByText("✓ 前提科目OK")).toBeInTheDocument();
  });

  it("必修は通常追加検索から除外して自動配置先を説明する", () => {
    renderPlanner(stateWithEarned(["business-introduction"]));
    fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "実習事前指導" },
    });
    expect(screen.queryByRole("radio", { name: /実習事前指導/ })).not.toBeInTheDocument();
    expect(screen.getByText(/2年後期へ自動表示/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この学期に追加" })).toBeDisabled();
  });

  it("前提科目なしでは前提warningを表示しない", () => {
    renderPlanner({
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }],
      },
    });
    const card = screen.getByText("データサイエンス基礎").closest("li")!;
    expect(within(card).queryByText("⚠ 前提科目を確認")).not.toBeInTheDocument();
    expect(within(card).queryByText("✓ 前提科目OK")).not.toBeInTheDocument();
  });

  it("自動必修は移動UIを持たず前提表示を維持する", () => {
    renderPlanner({
      ...stateWithEarned(["business-introduction"]),
      graduationPlan: {
        entries: [
          { courseId: "ict-introduction", semesterId: "year1-fall" },
          { courseId: "pre-internship-guidance", semesterId: "year2-spring" },
        ],
      },
    });
    const semester = screen.getByRole("heading", { name: "2年後期" }).closest("section")!;
    const card = within(semester).getByText("実習事前指導").closest("li")!;
    expect(within(card).getByText("✓ 前提科目OK")).toBeInTheDocument();
    expect(screen.queryByLabelText("ICT入門の配置学期")).not.toBeInTheDocument();
  });
});
