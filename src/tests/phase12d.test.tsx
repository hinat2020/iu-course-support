import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { curriculumCoursesById, curriculumCourses } from "../data/2026/curriculum";
import { officialGraduationRequirements } from "../data/2026/graduationRequirements";
import type { GraduationYearCapResult } from "../domain/graduationCap";
import {
  calculateGraduationPlanChecks,
  sortGraduationPlanChecks,
  type GraduationPlanCheck,
} from "../domain/graduationPlanChecks";
import type { GraduationBoardCourse } from "../domain/graduationPlanning";
import type { PrerequisiteCheckResult } from "../domain/graduationPrerequisites";
import {
  calculateGraduationRequirementProgress,
  type GraduationRequirementProgress,
} from "../domain/graduationRequirements";
import { GraduationPlanPage, PlanCheckSection } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import {
  selectGraduationPlanChecks,
  selectGraduationRequirementProgress,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { saveState, STORAGE_KEY } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function course(courseId: string) {
  const value = curriculumCoursesById.get(courseId);
  if (!value) throw new Error(`Missing curriculum fixture: ${courseId}`);
  return value;
}

function placement(
  courseId: string,
  semesterId: GraduationBoardCourse["semesterId"],
  source: GraduationBoardCourse["source"] = "graduation_plan",
  status: GraduationBoardCourse["status"] = "planned",
): GraduationBoardCourse {
  return {
    course: course(courseId),
    semesterId,
    source,
    status,
    editable: source === "graduation_plan",
  };
}

function cap(
  grade: 1 | 2 | 3 | 4,
  status: GraduationYearCapResult["status"] = "within_limit",
): GraduationYearCapResult {
  const limit = grade === 1 ? 46 : 42;
  const annualCredits = status === "unknown"
    ? null
    : status === "over_limit"
      ? limit + 2
      : status === "at_limit"
        ? limit
        : limit - 2;
  return {
    grade,
    springCredits: annualCredits === null ? null : annualCredits,
    fallCredits: annualCredits === null ? null : 0,
    annualCredits,
    limit,
    status,
    sourceConfirmed: true,
    warnings: status === "unknown" ? ["履修登録状況が未確認です。"] : [],
  };
}

function emptyRequirementProgress() {
  return calculateGraduationRequirementProgress({
    curriculum: curriculumCourses,
    placements: [],
    requirements: officialGraduationRequirements,
  });
}

function clearRequirementProgress(): GraduationRequirementProgress {
  const base = emptyRequirementProgress();
  const clearCredit = <T extends { requiredCredits: number }>(item: T) => ({
    ...item,
    earnedCredits: item.requiredCredits,
    currentIncludedCredits: item.requiredCredits,
    plannedIncludedCredits: item.requiredCredits,
    earnedShortfall: 0,
    projectedShortfall: 0,
    status: "satisfied" as const,
  });
  return {
    ...base,
    totalCredits: clearCredit(base.totalCredits),
    requiredCourses: {
      ...base.requiredCourses,
      earnedCourses: base.requiredCourses.totalCourses,
      currentIncludedCourses: base.requiredCourses.totalCourses,
      plannedIncludedCourses: base.requiredCourses.totalCourses,
      unplannedCourses: [],
      earnedCredits: base.requiredCourses.requiredCredits,
      currentIncludedCredits: base.requiredCourses.requiredCredits,
      plannedIncludedCredits: base.requiredCourses.requiredCredits,
      status: "satisfied",
    },
    selectableRequired: clearCredit(base.selectableRequired),
    requirementGroups: base.requirementGroups.map(clearCredit),
    electiveRequirements: base.electiveRequirements.map(clearCredit),
    selectableRequiredExcess: {
      ...base.selectableRequiredExcess,
      earnedCredits: 0,
      currentIncludedCredits: 0,
      plannedIncludedCredits: 0,
    },
    hasUnknownFirstSemesterStatus: false,
    warnings: [],
  };
}

function planChecks(options: {
  requirements?: GraduationRequirementProgress;
  caps?: GraduationYearCapResult[];
  prerequisites?: ReadonlyMap<string, PrerequisiteCheckResult>;
  placements?: GraduationBoardCourse[];
  special?: boolean;
} = {}) {
  return calculateGraduationPlanChecks({
    requirementProgress: options.requirements ?? clearRequirementProgress(),
    capResults: options.caps ?? [cap(1), cap(2), cap(3), cap(4)],
    prerequisiteChecks: options.prerequisites ?? new Map(),
    placements: options.placements ?? [],
    hasSpecialCourseUncertainty: options.special ?? false,
  });
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

describe("Phase 12D Plan Check engine", () => {
  it("既知checkがすべてclearならwarning 0", () => {
    const result = planChecks();
    expect(result.checks).toEqual([]);
    expect(result.reviewState).toBe("no_detected_warnings");
  });

  it("attention・unknown・category件数を集計する", () => {
    const result = planChecks({
      requirements: emptyRequirementProgress(),
      caps: [cap(1, "unknown"), cap(2), cap(3), cap(4)],
      special: true,
    });
    expect(result.attentionCount).toBeGreaterThan(0);
    expect(result.unknownCount).toBe(2);
    expect(result.countsByCategory.requirement).toBeGreaterThan(0);
    expect(result.countsByCategory.cap).toBe(1);
    expect(result.countsByCategory.special_course).toBe(1);
  });

  it("stable idと安定順序を維持する", () => {
    const checks: GraduationPlanCheck[] = [
      { id: "requirement:z", category: "requirement", severity: "attention", title: "z", message: "z" },
      { id: "cap:year:2", category: "cap", severity: "attention", title: "cap", message: "cap" },
      { id: "data:first", category: "data_uncertainty", severity: "unknown", title: "data", message: "data" },
    ];
    expect(sortGraduationPlanChecks(checks).map((item) => item.id)).toEqual([
      "data:first",
      "cap:year:2",
      "requirement:z",
    ]);
    expect(sortGraduationPlanChecks(checks)).toEqual(sortGraduationPlanChecks(checks));
  });

  it("重複placementから同じcheckを重複生成しない", () => {
    const duplicate = placement("esports", "year2-fall");
    const result = planChecks({ placements: [duplicate, duplicate] });
    const ids = result.checks.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ["total-credits", "総卒業単位"],
    ["selectable-required-total", "選択必修 合計"],
    ["modern-society", "◆ 現代社会理解"],
    ["basic-elective", "基礎科目 選択"],
  ] as const)("%sのprojected shortfallをattentionにする", (id, title) => {
    const result = planChecks({ requirements: emptyRequirementProgress() });
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: `requirement:${id}`,
      severity: "attention",
      title,
    }));
  });

  it("同名の記号別要件をPlan Check上で区別する", () => {
    const result = planChecks({ requirements: emptyRequirementProgress() });
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "requirement:ict-primary", title: "■ 情報通信技術科目" }),
      expect.objectContaining({ id: "requirement:ict-secondary", title: "□ 情報通信技術科目" }),
      expect.objectContaining({ id: "requirement:multicultural-primary", title: "★ 多文化・国際化社会理解" }),
      expect.objectContaining({ id: "requirement:multicultural-secondary", title: "☆ 多文化・国際化社会理解" }),
    ]));
  });

  it("projected satisfiedの要件はattentionにしない", () => {
    expect(planChecks().checks.some((item) => item.category === "requirement")).toBe(false);
  });

  it("未計画必修を1件のstructured checkにする", () => {
    const result = planChecks({ requirements: emptyRequirementProgress() });
    expect(result.checks.filter((item) => item.id === "requirement:required-courses")).toHaveLength(1);
  });

  it.each([
    ["within_limit", undefined],
    ["at_limit", "info"],
    ["over_limit", "attention"],
    ["unknown", "unknown"],
  ] as const)("CAP %sを%sへ変換", (status, expected) => {
    const result = planChecks({ caps: [cap(1, status), cap(2), cap(3), cap(4)] });
    const check = result.checks.find((item) => item.category === "cap");
    expect(check?.severity).toBe(expected);
  });

  it.each([
    ["satisfied", "earned", undefined],
    ["warning", "current_unconfirmed", "unknown"],
    ["not_satisfied", "planned_same_semester", "attention"],
    ["not_satisfied", "planned_after", "attention"],
    ["not_satisfied", "missing", "attention"],
  ] as const)("前提%s/%sを%sへ変換", (status, requirementStatus, expected) => {
    const prerequisites = new Map<string, PrerequisiteCheckResult>([[
      "basic-project-1",
      {
        courseId: "basic-project-1",
        status,
        requirements: [{
          prerequisiteCourseId: "project-introduction",
          prerequisiteCourseName: "プロジェクト入門",
          status: requirementStatus,
        }],
      },
    ]]);
    const result = planChecks({
      prerequisites,
      placements: [placement("basic-project-1", "year2-spring")],
    });
    expect(result.checks.find((item) => item.category === "prerequisite")?.severity)
      .toBe(expected);
  });

  it("配当年次と学期の両方の不一致を別checkにする", () => {
    const result = planChecks({ placements: [placement("esports", "year2-fall")] });
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "placement:year:esports" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "placement:semester:esports" }));
  });

  it("前期unknownと特殊科目をunknownにする", () => {
    const requirements = { ...clearRequirementProgress(), hasUnknownFirstSemesterStatus: true };
    const result = planChecks({ requirements, special: true });
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "data:first-semester-status", severity: "unknown" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "special:credit-treatment", severity: "unknown" }));
  });

  it("選択必修超過をinfoとし自動配分しない", () => {
    const requirements = clearRequirementProgress();
    requirements.selectableRequiredExcess.plannedIncludedCredits = 4;
    const result = planChecks({ requirements });
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: "requirement:selectable-required-excess",
      severity: "info",
    }));
  });

  it("要件到達とCAP超過を独立して保持する", () => {
    const result = planChecks({ caps: [cap(1), cap(2), cap(3, "over_limit"), cap(4)] });
    expect(result.checks.some((item) => item.category === "requirement")).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ id: "cap:year:3", severity: "attention" }));
  });

  it("要件不足とCAP上限内を独立して保持する", () => {
    const result = planChecks({ requirements: emptyRequirementProgress() });
    expect(result.checks.some((item) => item.category === "requirement")).toBe(true);
    expect(result.checks.some((item) => item.category === "cap")).toBe(false);
  });
});

describe("Phase 12D double counting and derived selectors", () => {
  it("総128進捗はunique course creditsで二重計上しない", () => {
    const result = calculateGraduationRequirementProgress({
      curriculum: curriculumCourses,
      placements: [
        { courseId: "esports", layer: "earned" },
        { courseId: "esports", layer: "current" },
        { courseId: "esports", layer: "planned" },
      ],
      requirements: officialGraduationRequirements,
    });
    expect(result.totalCredits.plannedIncludedCredits).toBe(2);
  });

  it("選択必修超過は総単位へ別加算しない", () => {
    const selectable = curriculumCourses
      .filter((item) => item.requirementType === "required_elective")
      .slice(0, 21);
    const elective = curriculumCourses
      .filter((item) => item.requirementType === "elective" && item.planningAvailability === "standard")
      .slice(0, 2);
    const unique = [...selectable, ...elective];
    const result = calculateGraduationRequirementProgress({
      curriculum: curriculumCourses,
      placements: unique.map((item) => ({ courseId: item.courseId, layer: "planned" as const })),
      requirements: officialGraduationRequirements,
    });
    expect(result.totalCredits.plannedIncludedCredits).toBe(
      unique.reduce((sum, item) => sum + item.credits, 0),
    );
    expect(result.selectableRequiredExcess.plannedIncludedCredits).toBeGreaterThan(0);
  });

  it("move/removeでplacement checkをderived再計算する", () => {
    const initial: AppState = {
      ...createInitialState(),
      graduationPlan: { entries: [{ courseId: "esports", semesterId: "year2-fall" }] },
    };
    expect(selectGraduationPlanChecks(initial).checks.some((item) => item.id === "placement:semester:esports")).toBe(true);
    const moved = appReducer(initial, {
      type: "MOVE_GRADUATION_PLAN_COURSE",
      payload: { courseId: "esports", semesterId: "year1-spring" },
    });
    expect(selectGraduationPlanChecks(moved).checks.some((item) => item.id === "placement:semester:esports")).toBe(false);
    const removed = appReducer(moved, { type: "REMOVE_GRADUATION_PLAN_COURSE", payload: "esports" });
    expect(selectGraduationPlanChecks(removed).checks.some((item) => item.courseId === "esports")).toBe(false);
  });

  it("firstSemester変更でunknown checkを再計算する", () => {
    const initial = createInitialState();
    expect(selectGraduationPlanChecks(initial).checks.some((item) => item.id === "data:first-semester-status")).toBe(true);
    const confirmed = [...curriculumCourses]
      .filter((item) => item.recommendedYears.includes(1) && item.availableSemesters.includes("spring"))
      .reduce((state, item) => appReducer(state, {
        type: "SET_PREVIOUS_COURSE_STATUS",
        payload: { courseId: item.courseId, status: "not_taken" },
      }), initial);
    expect(selectGraduationRequirementProgress(confirmed).hasUnknownFirstSemesterStatus).toBe(false);
  });

  it("抽選確認変更でcurrent layerを再計算する", () => {
    const base: AppState = {
      ...createInitialState(),
      user: { ...createInitialState().user, timetableModel: "C", englishTrack: "normal" },
      plannedCourses: { database: { selected: true } },
      lotteries: {
        database: {
          courseId: "database",
          applicationStatus: "applied",
          preferences: [],
          resultStatus: "won",
          wonOfferingId: "2026-second-database-C",
          wonScheduleOptionId: null,
          registrationConfirmation: "unconfirmed",
        },
      },
    };
    const before = selectGraduationRequirementProgress(base).totalCredits.currentIncludedCredits;
    const after = selectGraduationRequirementProgress({
      ...base,
      lotteries: {
        database: { ...base.lotteries.database, registrationConfirmation: "confirmed" },
      },
    }).totalCredits.currentIncludedCredits;
    expect(after - before).toBe(2);
  });

  it("Plan CheckをLocalStorageへ保存しない", () => {
    const state = createInitialState();
    selectGraduationPlanChecks(state);
    saveState(state);
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).not.toContain("planChecks");
    expect(stored).not.toContain("attentionCount");
    expect(state.schemaVersion).toBe(5);
  });
});

describe("Phase 12D integrated UI", () => {
  it("計画チェック見出し・カテゴリ件数・詳細を表示する", () => {
    renderPlanner(createInitialState());
    expect(screen.getByRole("heading", { name: "計画チェック" })).toBeInTheDocument();
    expect(screen.getByText(/確認が必要 \d+件/)).toBeInTheDocument();
    expect(screen.getByText(/判定保留 \d+件/)).toBeInTheDocument();
    expect(screen.getByText(/卒業要件 \d+件/)).toBeInTheDocument();
    expect(screen.getByText(/確認事項の詳細を見る/).closest("details")).not.toHaveAttribute("open");
  });

  it("該当箇所を見るでtargetへfocusを移す", () => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    renderPlanner(createInitialState());
    fireEvent.click(screen.getAllByRole("button", { name: "該当箇所を見る" })[0]);
    expect(document.activeElement?.id).toBe("graduation-requirement-total-credits");
  });

  it("warning 0時は限定表現を使い卒業保証しない", () => {
    render(
      <PlanCheckSection
        summary={planChecks()}
        requirementsProjected
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText(/現在確認できる範囲の既知チェック項目に警告はありません/)).toBeInTheDocument();
    expect(screen.getByText(/卒業可能を保証するものではありません/)).toBeInTheDocument();
    expect(screen.queryByText("卒業できます")).not.toBeInTheDocument();
    expect(screen.queryByText("卒業可能です")).not.toBeInTheDocument();
  });
});
