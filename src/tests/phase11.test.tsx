import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import routerSource from "../app/router.tsx?raw";
import { curriculumData, curriculumCourses } from "../data/2026/curriculum";
import coursesJson from "../data/2026/courses.json";
import { firstSemesterRequiredCourses } from "../data/2026/setup";
import {
  addPlannedCourse,
  canAddCourseToPlan,
  createEmptyGraduationPlan,
  getPlacementWarnings,
  movePlannedCourse,
  removePlannedCourse,
} from "../domain/graduationPlanning";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import {
  selectGraduationBoard,
  selectGraduationCreditSummary,
  selectUnplacedCurriculumCourses,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { loadState, saveState } from "../storage/localStorage";
import { migrateState } from "../storage/migrations";

const validGraduationCourseIds = new Set(
  curriculumCourses
    .filter((course) => course.planningAvailability === "standard")
    .map((course) => course.courseId),
);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPlanner(initialState: AppState = createInitialState()) {
  function Harness() {
    const [state, dispatch] = useReducer(appReducer, initialState);
    return (
      <AppStateContext.Provider value={{ state, dispatch }}>
        <MemoryRouter><GraduationPlanPage /></MemoryRouter>
      </AppStateContext.Provider>
    );
  }
  return render(<Harness />);
}

function createV4State(state: AppState = createInitialState()) {
  const { graduationPlan: _graduationPlan, ...withoutPlan } = state;
  void _graduationPlan;
  return { ...withoutPlan, schemaVersion: 4 as const };
}

describe("Phase 11 curriculum data", () => {
  it("公式便覧のカリキュラム科目IDに重複がない", () => {
    const ids = curriculumCourses.map((course) => course.courseId);
    const officialNames = curriculumCourses.map((course) => course.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(officialNames).size).toBe(officialNames.length);
    expect(ids.length).toBe(112);
  });

  it("単位・要件記号・source年度が有効", () => {
    const allowed = new Set(["◆", "▲", "■", "□", "◎", "★", "☆"]);
    expect(curriculumData.metadata.academicYear).toBe(2026);
    expect(curriculumData.metadata.documentName).toBe("02_2026年度学生便覧.pdf");
    for (const course of curriculumCourses) {
      expect(course.credits).toBeGreaterThanOrEqual(0);
      expect(course.requirementGroups.every((symbol) => allowed.has(symbol))).toBe(true);
      expect(course.sourcePage).toBeGreaterThanOrEqual(30);
      expect(course.sourcePage).toBeLessThanOrEqual(35);
    }
  });

  it("前提科目参照はカリキュラム内に存在する", () => {
    const ids = new Set(curriculumCourses.map((course) => course.courseId));
    for (const course of curriculumCourses) {
      for (const prerequisite of course.prerequisites) expect(ids.has(prerequisite)).toBe(true);
    }
    expect(
      curriculumCourses.find((course) => course.courseId === "pre-internship-guidance")
        ?.prerequisites,
    ).toEqual(["business-introduction", "ict-introduction"]);
    expect(
      curriculumCourses.find((course) => course.courseId === "project-practice-seminar-3")
        ?.prerequisites,
    ).toEqual(["project-practice-seminar-2"]);
  });

  it("学生便覧の正式科目名を保持する", () => {
    expect(
      curriculumCourses.find((course) => course.courseId === "interaction-design-intro")
        ?.name,
    ).toBe("インタラクションデザイン入門");
  });

  it("学生便覧の配当学期を転記どおり保持する", () => {
    const semesters = Object.fromEntries(
      curriculumCourses.map((course) => [course.courseId, course.availableSemesters]),
    );
    expect(semesters["career-design-2"]).toEqual(["fall"]);
    expect(semesters["software-process-and-quality"]).toEqual(["spring"]);
    expect(semesters["network-construction-3"]).toEqual(["fall"]);
    expect(semesters["big-data"]).toEqual(["fall"]);
  });

  it("既存course masterの全科目を同一IDで照合できる", () => {
    const ids = new Set(curriculumCourses.map((course) => course.courseId));
    for (const course of coursesJson) expect(ids.has(course.id)).toBe(true);
  });
});

describe("Phase 11 schema v5 migration", () => {
  it("v4から既存状態を保持して空のgraduationPlanを追加する", () => {
    const current: AppState = {
      ...appReducer(createInitialState(), { type: "SET_TIMETABLE_MODEL", payload: "C" }),
      firstSemester: {
        ...createInitialState().firstSemester,
        courses: {
          "study-skills": {
            courseId: "study-skills",
            status: "earned",
            confirmedByUser: true,
          },
        },
      },
      lotteries: {
        database: {
          courseId: "database",
          applicationStatus: "applied",
          preferences: [],
          resultStatus: "pending",
          wonOfferingId: null,
          wonScheduleOptionId: null,
          registrationConfirmation: "unconfirmed",
        },
      },
      innovationLecture: {
        ...createInitialState().innovationLecture,
        previousEarnedCount: 1,
      },
      innovationMethod: {
        ...createInitialState().innovationMethod,
        previousEarnedCount: 1,
      },
    };
    const v4 = createV4State({
      ...current,
      plannedCourses: { database: { selected: true } },
    });
    const migrated = migrateState(v4);
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.user.timetableModel).toBe("C");
    expect(migrated.firstSemester).toEqual(current.firstSemester);
    expect(migrated.plannedCourses.database.selected).toBe(true);
    expect(migrated.lotteries).toEqual(current.lotteries);
    expect(migrated.innovationLecture).toEqual(current.innovationLecture);
    expect(migrated.innovationMethod).toEqual(current.innovationMethod);
    expect(migrated.graduationPlan).toEqual({ entries: [] });
  });

  it("v5はidempotentで値を変更しない", () => {
    const state: AppState = {
      ...createInitialState(),
      graduationPlan: { entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }] },
    };
    expect(migrateState(structuredClone(state))).toEqual(state);
  });

  it("壊れたgraduationPlanだけを修復し既存入力を保持する", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL", payload: "C",
    });
    const broken = { ...state, graduationPlan: { entries: [{ courseId: "x", semesterId: "year9" }] } };
    expect(migrateState(broken)).toEqual(state);
  });
});

describe("Phase 11 graduation planning domain and selectors", () => {
  it("1年前期earnedを修得済みへ反映する", () => {
    const courseId = firstSemesterRequiredCourses[0].id;
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId, status: "earned" },
    });
    const spring = selectGraduationBoard(state).find((item) => item.id === "year1-spring");
    expect(spring?.courses.find((item) => item.course.courseId === courseId)?.status).toBe("earned");
  });

  it.each(["failed", "not_taken", "unknown"] as const)("前期%sはearnedへ含めない", (status) => {
    const courseId = firstSemesterRequiredCourses[0].id;
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId, status },
    });
    const entry = selectGraduationBoard(state).flatMap((item) => item.courses)
      .find((item) => item.course.courseId === courseId);
    expect(entry?.status).not.toBe("earned");
    expect(entry?.source).toBe("required_auto");
  });

  it("plannedとearnedが重複しても単位を二重計上しない", () => {
    const courseId = firstSemesterRequiredCourses[0].id;
    let state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId, status: "earned" },
    });
    state = { ...state, graduationPlan: { entries: [{ courseId, semesterId: "year2-spring" }] } };
    const summary = selectGraduationCreditSummary(state);
    expect(summary.earnedCredits).toBe(firstSemesterRequiredCourses[0].credits);
    expect(summary.plannedCredits).toBe(72);
  });

  it("追加・移動・削除と同一courseId重複防止が純粋に動く", () => {
    let plan = createEmptyGraduationPlan();
    plan = addPlannedCourse(plan, { courseId: "data-science-foundations", semesterId: "year2-spring" }, validGraduationCourseIds);
    plan = addPlannedCourse(plan, { courseId: "data-science-foundations", semesterId: "year2-fall" }, validGraduationCourseIds);
    expect(plan.entries).toHaveLength(1);
    plan = movePlannedCourse(plan, "data-science-foundations", "year2-fall", validGraduationCourseIds);
    expect(plan.entries[0].semesterId).toBe("year2-fall");
    plan = removePlannedCourse(plan, "data-science-foundations");
    expect(plan.entries).toEqual([]);
  });

  it("既存実績にあるcourseIdは新規配置不可", () => {
    expect(canAddCourseToPlan(createEmptyGraduationPlan(), "study-skills", validGraduationCourseIds, new Set(["study-skills"]))).toBe(false);
  });

  it("公式配当年次・学期との不一致をsoft warningにする", () => {
    const course = curriculumCourses.find((item) => item.courseId === "data-science-foundations");
    expect(course).toBeDefined();
    expect(getPlacementWarnings(course!, "year1-fall").join(" ")).toMatch(/2年次|前期/);
  });

  it("未配置検索は科目名・学年・学期・要件で絞れる", () => {
    const results = selectUnplacedCurriculumCourses(createInitialState(), {
      query: "データサイエンス基礎",
      year: 2,
      semester: "spring",
      requirementGroup: "■",
    });
    expect(results.map((course) => course.courseId)).toContain("data-science-foundations");
  });

  it("未配置検索は必修・選択必修・選択の区分で絞れる", () => {
    const results = selectUnplacedCurriculumCourses(createInitialState(), {
      requirementType: "required_elective",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((course) => course.requirementType === "required_elective")).toBe(true);
  });

  it("1年後期必修はUNIPA確認がないため履修予定として表示する", () => {
    let state = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "C",
    });
    state = appReducer(state, {
      type: "SET_ENGLISH_TRACK",
      payload: "advanced",
    });
    const fallRequired = selectGraduationBoard(state)
      .find((semester) => semester.id === "year1-fall")
      ?.courses.filter((course) => course.source === "current_registration");
    expect(fallRequired).toHaveLength(8);
    expect(fallRequired?.every((course) => course.status === "planned")).toBe(true);
  });

  it("当選かつUNIPA確認済みでも履修中とは断定しない", () => {
    const state: AppState = {
      ...createInitialState(),
      plannedCourses: { database: { selected: true } },
      lotteries: {
        database: {
          courseId: "database",
          applicationStatus: "applied",
          preferences: [],
          resultStatus: "won",
          wonOfferingId: "2026-second-database-C",
          wonScheduleOptionId: null,
          registrationConfirmation: "confirmed",
        },
      },
    };
    const database = selectGraduationBoard(state).flatMap((item) => item.courses).find((item) => item.course.courseId === "database");
    expect(database?.status).toBe("planned");
    expect(database?.registrationEvidence).toBe("unipa_confirmed");
    expect(selectGraduationCreditSummary(state).inProgressCredits).toBe(0);
  });

  it("reducerからも前期earned・既存後期対象・特殊科目の重複配置を防ぐ", () => {
    const earnedState = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    expect(appReducer(earnedState, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "study-skills", semesterId: "year2-spring" },
    }).graduationPlan.entries).toEqual([]);

    let configured = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL", payload: "C",
    });
    configured = appReducer(configured, {
      type: "SET_ENGLISH_TRACK", payload: "normal",
    });
    expect(appReducer(configured, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "basic-mathematics", semesterId: "year2-spring" },
    }).graduationPlan.entries).toEqual([]);
    expect(appReducer(configured, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "innovation-lecture-a", semesterId: "year2-spring" },
    }).graduationPlan.entries).toEqual([]);
  });
});

describe("Phase 11 graduation plan UI", () => {
  it("8学期と自動配置必修を表示する", () => {
    renderPlanner();
    for (const label of ["1年前期", "1年後期", "2年前期", "2年後期", "3年前期", "3年後期", "4年前期", "4年後期"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/必修・将来予定/).length).toBeGreaterThan(0);
  });

  it("検索して科目を選び学期へ追加する", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), { target: { value: "データサイエンス基礎" } });
    fireEvent.click(screen.getByRole("radio", { name: /データサイエンス基礎/ }));
    fireEvent.change(screen.getByLabelText("配置する学期"), { target: { value: "year2-spring" } });
    fireEvent.click(screen.getByRole("button", { name: "この学期に追加" }));
    const semester = screen.getByRole("heading", { name: "2年前期" }).closest("section");
    expect(within(semester!).getByText("データサイエンス基礎")).toBeInTheDocument();
    expect(within(semester!).getByText("○ 履修予定")).toBeInTheDocument();
  });

  it("区分フィルターと配置後のsoft warningを表示する", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
    fireEvent.change(screen.getByLabelText("区分"), {
      target: { value: "required_elective" },
    });
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "データサイエンス基礎" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /データサイエンス基礎/ }));
    fireEvent.change(screen.getByLabelText("配置する学期"), {
      target: { value: "year1-fall" },
    });
    fireEvent.click(screen.getByRole("button", { name: "この学期に追加" }));
    const fall = screen.getByRole("heading", { name: "1年後期" }).closest("section");
    expect(within(fall!).getByText(/公式の配当情報と異なる配置です/)).toBeInTheDocument();
  });

  it("planned科目を移動してから削除できる", () => {
    const state: AppState = {
      ...createInitialState(),
      graduationPlan: { entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }] },
    };
    renderPlanner(state);
    const courseCard = screen.getByText("データサイエンス基礎").closest("li")!;
    fireEvent.click(within(courseCard).getByRole("button", { name: "学期を変更" }));
    fireEvent.click(screen.getByRole("button", { name: "2年後期" }));
    fireEvent.click(screen.getByRole("button", { name: "確認して移動" }));
    expect(within(screen.getByRole("heading", { name: "2年後期" }).closest("section")!).getByText("データサイエンス基礎")).toBeInTheDocument();
    const movedCard = screen.getByText("データサイエンス基礎").closest("li")!;
    fireEvent.click(within(movedCard).getByRole("button", { name: "計画から外す" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "計画から外しますか？" })).getByRole("button", { name: "計画から外す" }));
    expect(screen.queryByText("データサイエンス基礎")).not.toBeInTheDocument();
  });

  it("earned科目は卒業設計から削除できない", () => {
    const courseId = firstSemesterRequiredCourses[0].id;
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId, status: "earned" },
    });
    renderPlanner(state);
    const spring = screen.getByRole("heading", { name: "1年前期" }).closest("section");
    expect(within(spring!).getByText("✓ 修得済み")).toBeInTheDocument();
    expect(within(spring!).queryByRole("button", { name: "計画から外す" })).not.toBeInTheDocument();
    expect(within(spring!).getByRole("link", { name: "前期設定" })).toHaveAttribute("href", "/settings");
  });

  it("卒業計画はLocalStorage保存・reload相当で復元される", () => {
    const state = appReducer(createInitialState(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    saveState(state);
    expect(loadState().graduationPlan).toEqual(state.graduationPlan);
  });

  it("graduation planルートをHashRouter配下に保持する", () => {
    expect(routerSource).toContain('path="/graduation/plan"');
  });

});
