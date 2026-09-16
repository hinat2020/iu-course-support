import { cleanup, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { curriculumCourses } from "../data/2026/curriculum";
import { officialGraduationRequirements } from "../data/2026/graduationRequirements";
import {
  calculateGraduationRequirementProgress,
  getCreditRequirementStatus,
  getGraduationRequirementShortfalls,
  type GraduationRequirementLayer,
  type GraduationRequirementPlacement,
} from "../domain/graduationRequirements";
import type { CurriculumCourse } from "../domain/graduationPlanning";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import {
  selectGraduationPrerequisiteChecks,
  selectGraduationRequirementProgress,
  selectGraduationRequirementShortfalls,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { saveState } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const symbolRequirements = [
  ["◆", 4],
  ["▲", 10],
  ["■", 8],
  ["□", 2],
  ["◎", 4],
  ["★", 6],
  ["☆", 2],
] as const;

const symbolCourseIds = [
  ["◆", "esports"],
  ["▲", "operations-management"],
  ["■", "computer-architecture"],
  ["□", "programming-application-web"],
  ["◎", "business-discussion-and-debate"],
  ["★", "japanese-culture"],
  ["☆", "manufacturing-industry-internationalization"],
] as const;

function placements(
  ids: readonly string[],
  layer: GraduationRequirementLayer,
): GraduationRequirementPlacement[] {
  return ids.map((courseId) => ({ courseId, layer }));
}

function calculate(
  entries: readonly GraduationRequirementPlacement[] = [],
  curriculum: readonly CurriculumCourse[] = curriculumCourses,
) {
  return calculateGraduationRequirementProgress({
    curriculum,
    placements: entries,
    requirements: officialGraduationRequirements,
  });
}

function configuredState() {
  return appReducer(
    appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "C",
    }),
    { type: "SET_ENGLISH_TRACK", payload: "normal" },
  );
}

function withDatabaseWonConfirmed(state: AppState): AppState {
  return {
    ...state,
    plannedCourses: { ...state.plannedCourses, database: { selected: true } },
    lotteries: {
      ...state.lotteries,
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

describe("Phase 12C official graduation requirement data", () => {
  it("2026年度・2025年度以降入学者の公式データである", () => {
    expect(officialGraduationRequirements).toMatchObject({
      academicYear: 2026,
      entryCohort: { from: 2025, label: "2025年度以降入学者" },
    });
  });

  it("総卒業必要単位は128単位", () => {
    expect(officialGraduationRequirements.totalCreditsRequired).toBe(128);
  });

  it("必修74・選択必修36・選択18の合計が128", () => {
    expect(officialGraduationRequirements.categoryTotals).toEqual({
      requiredCredits: 74,
      selectableRequiredCredits: 36,
      electiveCredits: 18,
    });
    expect(Object.values(officialGraduationRequirements.categoryTotals).reduce((a, b) => a + b, 0)).toBe(128);
  });

  it.each(symbolRequirements)("%sの必要単位は%d", (symbol, credits) => {
    expect(
      officialGraduationRequirements.requirements.find(
        (requirement) => requirement.symbol === symbol,
      )?.requiredCredits,
    ).toBe(credits);
  });

  it("7記号の合計は選択必修36単位", () => {
    expect(
      officialGraduationRequirements.requirements.reduce(
        (sum, requirement) => sum + requirement.requiredCredits,
        0,
      ),
    ).toBe(36);
    expect(officialGraduationRequirements.selectableRequired.totalRequiredCredits).toBe(36);
  });

  it.each([
    ["basic-elective", "基礎科目", 2],
    ["professional-elective", "職業専門科目", 16],
  ] as const)("選択科目要件%sを保持する", (id, prefix, credits) => {
    expect(
      officialGraduationRequirements.electiveRequirements.find(
        (requirement) => requirement.id === id,
      ),
    ).toMatchObject({ categoryPrefix: prefix, minimumCredits: credits });
  });

  it("選択必修超過は選択科目へ充当可能だが自動配分しない", () => {
    expect(officialGraduationRequirements.excessSelectableRequiredTreatment).toMatchObject({
      canCountTowardElectives: true,
      allocation: "requires_official_confirmation",
    });
  });

  it("公式資料のページ情報を保持する", () => {
    expect(officialGraduationRequirements.source).toEqual({
      documentName: "02_2026年度学生便覧.pdf",
      section: "IV. 教育課程 / 5. 学位・卒業要件 / 2025年度以降入学者",
      page: 29,
      physicalPage: 36,
    });
  });

  it("requirement idに重複がない", () => {
    const ids = [
      officialGraduationRequirements.requiredCourses.id,
      officialGraduationRequirements.selectableRequired.id,
      ...officialGraduationRequirements.requirements.map((item) => item.id),
      ...officialGraduationRequirements.electiveRequirements.map((item) => item.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("curriculumの必修36科目・74単位が公式表と一致する", () => {
    const required = curriculumCourses.filter((course) => course.requirementType === "required");
    expect(required).toHaveLength(36);
    expect(required.reduce((sum, course) => sum + course.credits, 0)).toBe(74);
  });

  it("curriculumに複数requirementGroups所属の科目はない", () => {
    expect(curriculumCourses.filter((course) => course.requirementGroups.length > 1)).toEqual([]);
  });
});

describe("Phase 12C graduation requirement engine", () => {
  it.each([
    [9, 9, 10, "shortfall"],
    [10, 10, 10, "satisfied"],
    [4, 10, 10, "projected_satisfied"],
  ] as const)("earned=%d planned=%d required=%dを%sと判定", (earned, planned, required, status) => {
    expect(getCreditRequirementStatus(earned, planned, required)).toBe(status);
  });

  it("公式値が判定不能ならunknown", () => {
    expect(getCreditRequirementStatus(10, 10, 10, true)).toBe("unknown");
  });

  it("空の計画では総単位128不足", () => {
    const result = calculate();
    expect(result.totalCredits).toMatchObject({
      earnedCredits: 0,
      currentIncludedCredits: 0,
      plannedIncludedCredits: 0,
      projectedShortfall: 128,
      status: "shortfall",
    });
  });

  it("earned/current/plannedを累積3層で集計する", () => {
    const result = calculate([
      { courseId: "study-skills", layer: "earned" },
      { courseId: "basic-mathematics", layer: "current" },
      { courseId: "career-design-1", layer: "planned" },
    ]);
    expect(result.totalCredits).toMatchObject({
      earnedCredits: 2,
      currentIncludedCredits: 4,
      plannedIncludedCredits: 5,
    });
  });

  it("earnedがcurrent/plannedの重複より優先される", () => {
    const result = calculate([
      { courseId: "study-skills", layer: "planned" },
      { courseId: "study-skills", layer: "current" },
      { courseId: "study-skills", layer: "earned" },
    ]);
    expect(result.totalCredits).toMatchObject({
      earnedCredits: 2,
      currentIncludedCredits: 2,
      plannedIncludedCredits: 2,
    });
  });

  it.each(symbolCourseIds)("%s科目をcurriculum記号で集計する", (symbol, courseId) => {
    const item = calculate([{ courseId, layer: "earned" }]).requirementGroups.find(
      (progress) => progress.symbol === symbol,
    );
    expect(item?.earnedCredits).toBe(2);
  });

  it("同一の選択必修科目を合計へ二重計上しない", () => {
    const result = calculate([
      { courseId: "computer-architecture", layer: "planned" },
      { courseId: "computer-architecture", layer: "planned" },
    ]);
    expect(result.selectableRequired.plannedIncludedCredits).toBe(2);
  });

  it("必修全科目をplannedで覆うと計画上到達", () => {
    const requiredIds = curriculumCourses
      .filter((course) => course.requirementType === "required")
      .map((course) => course.courseId);
    const result = calculate(placements(requiredIds, "planned"));
    expect(result.requiredCourses).toMatchObject({
      totalCourses: 36,
      plannedIncludedCourses: 36,
      plannedIncludedCredits: 74,
      status: "projected_satisfied",
    });
  });

  it("必修全科目earnedで達成", () => {
    const requiredIds = curriculumCourses
      .filter((course) => course.requirementType === "required")
      .map((course) => course.courseId);
    expect(calculate(placements(requiredIds, "earned")).requiredCourses.status).toBe("satisfied");
  });

  it("未配置必修をcourseId付きで返す", () => {
    const result = calculate([{ courseId: "study-skills", layer: "earned" }]);
    expect(result.requiredCourses.unplannedCourses).not.toContainEqual(
      expect.objectContaining({ courseId: "study-skills" }),
    );
    expect(result.requiredCourses.unplannedCourses).toContainEqual(
      expect.objectContaining({ courseId: "career-design-1" }),
    );
  });

  it("基礎科目の選択科目を直接集計する", () => {
    const result = calculate([{ courseId: "british-american-culture-seminar", layer: "planned" }]);
    expect(result.electiveRequirements.find((item) => item.id === "basic-elective")).toMatchObject({
      plannedIncludedCredits: 2,
      status: "projected_satisfied",
    });
  });

  it("選択必修36超過分を可視化し選択区分へ自動配分しない", () => {
    const ids = curriculumCourses
      .filter((course) => course.requirementType === "required_elective")
      .slice(0, 19)
      .map((course) => course.courseId);
    const result = calculate(placements(ids, "planned"));
    expect(result.selectableRequiredExcess.plannedIncludedCredits).toBe(2);
    expect(result.electiveRequirements.find((item) => item.id === "professional-elective")?.status).toBe("unknown");
  });

  it("特殊科目を総単位・選択科目へ加算しない", () => {
    const result = calculate([
      { courseId: "innovation-lecture-a", layer: "earned" },
      { courseId: "innovation-method-a", layer: "current" },
    ]);
    expect(result.totalCredits.plannedIncludedCredits).toBe(0);
    expect(result.excludedSpecialCourses.map((course) => course.courseId)).toContain("innovation-lecture-a");
  });

  it("複数記号所属が存在する場合は安全に判定保留", () => {
    const base = curriculumCourses.find((course) => course.courseId === "computer-architecture")!;
    const ambiguous: CurriculumCourse = { ...base, requirementGroups: ["■", "□"] };
    const result = calculate([{ courseId: ambiguous.courseId, layer: "planned" }], [ambiguous]);
    expect(result.requirementGroups.find((item) => item.symbol === "■")?.status).toBe("unknown");
    expect(result.warnings).toContain(
      "複数の要件記号に属する科目があり、総合判定では重複算入ルールの確認が必要です。",
    );
  });

  it("計画上不足している要件だけを一覧化する", () => {
    const shortfalls = getGraduationRequirementShortfalls(calculate());
    expect(shortfalls).toContainEqual({
      id: "total-credits",
      label: "総卒業単位",
      amount: 128,
      unit: "単位",
    });
    expect(shortfalls).toContainEqual({
      id: "required-courses",
      label: "未計画の必修科目",
      amount: 36,
      unit: "科目",
    });
  });
});

describe("Phase 12C state integration and regression", () => {
  it("前期earnedのみ修得済みへ入れる", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "earned" },
    });
    expect(selectGraduationRequirementProgress(state).totalCredits.earnedCredits).toBe(2);
  });

  it.each(["failed", "not_taken", "unknown"] as const)(
    "前期%sを修得済みへ入れない",
    (status) => {
      const state = appReducer(createInitialState(), {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId: "study-skills", status },
      });
      expect(selectGraduationRequirementProgress(state).totalCredits.earnedCredits).toBe(0);
    },
  );

  it("前期unknownを注意として返す", () => {
    const state = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "study-skills", status: "unknown" },
    });
    expect(selectGraduationRequirementProgress(state).warnings).toContain(
      "1年前期に修得状況未確認の科目があります。実際の進捗は表示より多い可能性があります。",
    );
  });

  it("前期未回答を注意として返す", () => {
    const progress = selectGraduationRequirementProgress(createInitialState());

    expect(progress.totalCredits.earnedCredits).toBe(0);
    expect(progress.warnings).toContain(
      "1年前期に修得状況未確認の科目があります。実際の進捗は表示より多い可能性があります。",
    );
  });

  it("1年後期必修は今学期含むだけを増やす", () => {
    const progress = selectGraduationRequirementProgress(configuredState());
    expect(progress.totalCredits.earnedCredits).toBe(0);
    expect(progress.totalCredits.currentIncludedCredits).toBe(14);
    expect(progress.totalCredits.plannedIncludedCredits).toBe(14);
  });

  it("won+confirmed通常抽選をcurrentとして1回だけ集計する", () => {
    const state: AppState = {
      ...withDatabaseWonConfirmed(configuredState()),
      graduationPlan: { entries: [{ courseId: "database", semesterId: "year2-spring" }] },
    };
    const progress = selectGraduationRequirementProgress(state);
    expect(progress.totalCredits.currentIncludedCredits).toBe(16);
    expect(progress.totalCredits.plannedIncludedCredits).toBe(16);
    expect(progress.requirementGroups.find((item) => item.symbol === "■")?.currentIncludedCredits).toBe(2);
  });

  it("planned追加・削除で即時再計算する", () => {
    const added = appReducer(createInitialState(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "esports", semesterId: "year2-spring" },
    });
    expect(selectGraduationRequirementProgress(added).requirementGroups.find((item) => item.symbol === "◆")?.plannedIncludedCredits).toBe(2);
    const removed = appReducer(added, {
      type: "REMOVE_GRADUATION_PLAN_COURSE",
      payload: "esports",
    });
    expect(selectGraduationRequirementProgress(removed).requirementGroups.find((item) => item.symbol === "◆")?.plannedIncludedCredits).toBe(0);
  });

  it("進捗・不足・warningをLocalStorageへ保存しない", () => {
    const state = configuredState();
    selectGraduationRequirementProgress(state);
    selectGraduationRequirementShortfalls(state);
    saveState(state);
    const raw = localStorage.getItem("iu-course-support:v1") ?? "";
    expect(raw).not.toContain("projectedShortfall");
    expect(raw).not.toContain("requirementProgress");
    expect(raw).not.toContain("projected_satisfied");
  });

  it("前提科目warningとschemaVersion 5を維持する", () => {
    const state: AppState = {
      ...createInitialState(),
      graduationPlan: {
        entries: [{ courseId: "pre-internship-guidance", semesterId: "year2-spring" }],
      },
    };
    expect(selectGraduationPrerequisiteChecks(state).get("pre-internship-guidance")?.status).toBe("not_satisfied");
    expect(state.schemaVersion).toBe(5);
  });

  it("卒業要件計算でstateを変更しない", () => {
    const state = configuredState();
    const before = structuredClone(state);
    selectGraduationRequirementProgress(state);
    expect(state).toEqual(before);
  });
});

describe("Phase 12C UI", () => {
  it("公式卒業要件を3段階で表示する", () => {
    renderPlanner(configuredState());
    const region = screen.getByRole("region", { name: "卒業要件の進捗" });
    expect(within(region).getAllByText("総卒業単位").length).toBeGreaterThan(0);
    expect(within(region).getByText("必要 128単位")).toBeInTheDocument();
    expect(within(region).getAllByText("修得済み").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("今学期含む").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("計画含む").length).toBeGreaterThan(0);
  });

  it("7つの記号をすべて表示する", () => {
    renderPlanner(createInitialState());
    const region = screen.getByRole("region", { name: "卒業要件の進捗" });
    for (const [symbol] of symbolRequirements) {
      expect(within(region).getByText(symbol)).toBeInTheDocument();
    }
  });

  it("未計画必修を折りたたみ表示する", () => {
    renderPlanner(createInitialState());
    expect(screen.getByText("未計画の必修科目 36科目")).toBeInTheDocument();
  });

  it("特殊科目除外と卒業非保証を明示する", () => {
    renderPlanner(createInitialState());
    const region = screen.getByRole("region", { name: "卒業要件の進捗" });
    expect(within(region).getByText(/卒業を保証するものではありません/)).toBeInTheDocument();
    expect(within(region).getAllByText(/特殊科目の一部は/).length).toBeGreaterThan(0);
  });
});
