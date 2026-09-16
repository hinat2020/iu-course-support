import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  curriculumCourses,
  curriculumCoursesById,
} from "../data/2026/curriculum";
import { officialGraduationRequirements } from "../data/2026/graduationRequirements";
import { courseCatalog } from "../data/2026/requiredTimetable";
import {
  filterGraduationCandidates,
  getCandidateConstraintSummary,
  getCandidateReasons,
  getCandidatesForRequirement,
  isTotalOnlyCandidateSearchAvailable,
  previewCandidatePlacement,
} from "../domain/graduationCandidates";
import type { GraduationYearCapResult } from "../domain/graduationCap";
import type {
  CurriculumCourse,
  GraduationSemesterId,
} from "../domain/graduationPlanning";
import type { PrerequisiteCheckResult } from "../domain/graduationPrerequisites";
import {
  calculateGraduationRequirementProgress,
  type GraduationRequirementLayer,
  type GraduationRequirementPlacement,
} from "../domain/graduationRequirements";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import {
  selectGraduationCandidatePreview,
  selectGraduationCandidatesForRequirement,
  selectGraduationRequirementProgress,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { STORAGE_KEY } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function placements(
  ids: readonly string[],
  layer: GraduationRequirementLayer,
): GraduationRequirementPlacement[] {
  return ids.map((courseId) => ({ courseId, layer }));
}

function progress(entries: readonly GraduationRequirementPlacement[] = []) {
  return calculateGraduationRequirementProgress({
    curriculum: curriculumCourses,
    placements: entries,
    requirements: officialGraduationRequirements,
  });
}

function candidatesFor(
  requirementId: string,
  entries: readonly GraduationRequirementPlacement[] = [],
) {
  return getCandidatesForRequirement({
    curriculum: curriculumCourses,
    placements: entries,
    progress: progress(entries),
    requirements: officialGraduationRequirements,
    requirementId,
  });
}

function cap(
  grade: 1 | 2 | 3 | 4,
  annualCredits: number | null,
  status: GraduationYearCapResult["status"],
): GraduationYearCapResult {
  return {
    grade,
    springCredits: annualCredits,
    fallCredits: annualCredits === null ? null : 0,
    annualCredits,
    limit: grade === 1 ? 46 : 42,
    status,
    sourceConfirmed: true,
    warnings: [],
  };
}

function prerequisite(
  status: PrerequisiteCheckResult["status"],
  requirementStatus: PrerequisiteCheckResult["requirements"][number]["status"] = "missing",
): PrerequisiteCheckResult {
  return {
    courseId: "internship-preparation",
    status,
    requirements: status === "not_applicable" ? [] : [{
      prerequisiteCourseId: "ict-introduction",
      prerequisiteCourseName: "ICT入門",
      status: requirementStatus,
    }],
  };
}

function knownConfiguredState() {
  let state = appReducer(
    appReducer(createInitialState(), { type: "SET_TIMETABLE_MODEL", payload: "C" }),
    { type: "SET_ENGLISH_TRACK", payload: "normal" },
  );
  for (const course of [
    ...firstSemesterRequiredCourses,
    ...firstSemesterElectiveCourses,
  ]) {
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: course.id, status: "not_taken" },
    });
  }
  return state;
}

function renderPlanner(initial: AppState = knownConfiguredState()) {
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

describe("Phase 13 candidate engine", () => {
  it("112科目のcurriculumを候補sourceとして使用し、特殊4科目を除外する", () => {
    expect(curriculumCourses).toHaveLength(112);
    const result = candidatesFor("selectable-required-total");
    expect(result.every((item) => item.course.planningAvailability === "standard")).toBe(true);
    expect(result.some((item) => item.courseId.startsWith("innovation-"))).toBe(false);
  });

  it.each([
    ["earned", "earned"],
    ["current", "current"],
    ["planned", "planned"],
  ] as const)("%s科目を候補から除外する", (_label, layer) => {
    const courseId = "operations-management";
    const target = officialGraduationRequirements.requirements.find(
      (item) => item.symbol === "▲",
    )!;
    expect(
      candidatesFor(target.id, placements([courseId], layer)).some(
        (item) => item.courseId === courseId,
      ),
    ).toBe(false);
  });

  it.each(["◆", "▲", "■", "□", "◎", "★", "☆"] as const)(
    "%s候補は公式curriculumの同記号だけを返す",
    (symbol) => {
      const requirement = officialGraduationRequirements.requirements.find(
        (item) => item.symbol === symbol,
      )!;
      const result = candidatesFor(requirement.id);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((item) => item.course.requirementGroups.includes(symbol))).toBe(true);
    },
  );

  it("選択必修合計はrequired_electiveだけを候補にする", () => {
    const result = candidatesFor("selectable-required-total");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.course.requirementType === "required_elective")).toBe(true);
  });

  it("基礎科目選択は基礎科目の選択科目だけを候補にする", () => {
    const result = candidatesFor("basic-elective");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) =>
      item.course.requirementType === "elective" &&
      item.course.curriculumCategory.startsWith("基礎科目")
    )).toBe(true);
  });

  it("職業専門科目選択は一般配置可能な該当科目がなければ空で返す", () => {
    expect(candidatesFor("professional-elective")).toEqual([]);
  });

  it("未計画必修はrequired科目として抽出する", () => {
    const result = candidatesFor("required-courses");
    expect(result).toHaveLength(36);
    expect(result.every((item) => item.course.requirementType === "required")).toBe(true);
  });

  it("候補理由を重複せず複数保持する", () => {
    const course = curriculumCoursesById.get("operations-management")!;
    const reasons = getCandidateReasons({
      course,
      progress: progress(),
      requirements: officialGraduationRequirements,
    });
    expect(reasons.map((item) => item.type)).toEqual(
      expect.arrayContaining(["requirement_group", "selectable_required_total"]),
    );
    expect(new Set(reasons.map((item) => item.requirementId)).size).toBe(reasons.length);
  });

  it("候補の並び順は年次・学期・科目名でstable", () => {
    const result = candidatesFor("selectable-required-total");
    const second = candidatesFor("selectable-required-total");
    expect(result.map((item) => item.courseId)).toEqual(second.map((item) => item.courseId));
    expect(result[0].recommendedYears[0]).toBeLessThanOrEqual(
      result.at(-1)!.recommendedYears[0],
    );
  });

  it("検索・年次・学期・記号・区分・カテゴリでfilterできる", () => {
    const source = candidatesFor("selectable-required-total");
    const selected = source.find((item) => item.course.requirementGroups.length > 0)!;
    const filtered = filterGraduationCandidates(source, {
      query: selected.course.name,
      year: selected.recommendedYears[0],
      semester: selected.availableSemesters[0],
      requirementGroup: selected.course.requirementGroups[0],
      requirementType: "required_elective",
      curriculumCategoryPrefix: selected.course.curriculumCategory.split("／")[0],
    });
    expect(filtered.map((item) => item.courseId)).toContain(selected.courseId);
  });

  it("total候補は他のカテゴリ要件が計画上到達した場合だけ有効", () => {
    const empty = progress();
    expect(isTotalOnlyCandidateSearchAvailable(empty)).toBe(false);
    expect(candidatesFor("total-credits")).toEqual([]);

    const fulfilledExceptTotal = {
      ...empty,
      requiredCourses: { ...empty.requiredCourses, status: "projected_satisfied" as const },
      selectableRequired: { ...empty.selectableRequired, status: "projected_satisfied" as const },
      requirementGroups: empty.requirementGroups.map((item) => ({
        ...item,
        status: "projected_satisfied" as const,
      })),
      electiveRequirements: empty.electiveRequirements.map((item) => ({
        ...item,
        status: "projected_satisfied" as const,
      })),
    };
    expect(isTotalOnlyCandidateSearchAvailable(fulfilledExceptTotal)).toBe(true);
    const result = getCandidatesForRequirement({
      curriculum: curriculumCourses,
      placements: [],
      progress: fulfilledExceptTotal,
      requirements: officialGraduationRequirements,
      requirementId: "total-credits",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.course.planningAvailability === "standard")).toBe(true);
  });
});

describe("Phase 13 placement preview", () => {
  const course = curriculumCoursesById.get("organizational-behavior")!;

  it("配当年次・学期一致、前提なし、CAP内ならclear", () => {
    const result = previewCandidatePlacement({
      course,
      semesterId: "year2-spring",
      prerequisiteResult: prerequisite("not_applicable"),
      capBefore: cap(2, 10, "within_limit"),
      capAfter: cap(2, 12, "within_limit"),
    });
    expect(result).toMatchObject({
      yearPlacement: "match",
      semesterPlacement: "match",
      prerequisite: "clear",
      status: "clear",
      cap: { beforeCredits: 10, afterCredits: 12, status: "within_limit" },
    });
  });

  it.each([
    ["year1-spring", "mismatch", "match"],
    ["year2-fall", "match", "mismatch"],
  ] as const)("%sの配当差をpreviewする", (semesterId, year, semester) => {
    const result = previewCandidatePlacement({
      course,
      semesterId,
      prerequisiteResult: prerequisite("not_applicable"),
      capBefore: cap(2, 10, "within_limit"),
      capAfter: cap(2, 12, "within_limit"),
    });
    expect(result.yearPlacement).toBe(year);
    expect(result.semesterPlacement).toBe(semester);
    expect(result.status).toBe("attention");
  });

  it.each([
    ["satisfied", "earned", "clear"],
    ["not_satisfied", "missing", "attention"],
    ["warning", "current_unconfirmed", "unknown"],
  ] as const)("前提科目%sを%sとしてpreviewする", (status, requirementStatus, expected) => {
    const result = previewCandidatePlacement({
      course,
      semesterId: "year2-spring",
      prerequisiteResult: prerequisite(status, requirementStatus),
      capBefore: cap(2, 10, "within_limit"),
      capAfter: cap(2, 12, "within_limit"),
    });
    expect(result.prerequisite).toBe(expected);
  });

  it.each([
    [40, "within_limit"],
    [42, "at_limit"],
    [44, "over_limit"],
    [null, "unknown"],
  ] as const)("CAP追加後%sを%sとしてpreviewする", (credits, status) => {
    const result = previewCandidatePlacement({
      course,
      semesterId: "year2-spring",
      prerequisiteResult: prerequisite("not_applicable"),
      capBefore: cap(2, 38, "within_limit"),
      capAfter: cap(2, credits, status),
    });
    expect(result.cap.status).toBe(status);
  });

  it("constraint summaryをrankせず件数集計する", () => {
    const previews = ["clear", "attention", "unknown"] as const;
    const summary = getCandidateConstraintSummary(previews.map((status, index) => ({
      courseId: `course-${index}`,
      semesterId: "year2-spring" as GraduationSemesterId,
      yearPlacement: "match" as const,
      semesterPlacement: "match" as const,
      prerequisite: status,
      cap: { beforeCredits: 0, afterCredits: 2, limit: 42, status: "within_limit" as const },
      status,
      messages: [],
    })));
    expect(summary).toEqual({ total: 3, clear: 1, attention: 1, unknown: 1 });
  });

  it("selector previewはAppStateとLocalStorageを書き換えない", () => {
    const state = knownConfiguredState();
    const snapshot = structuredClone(state);
    localStorage.setItem(STORAGE_KEY, "unchanged");
    expect(selectGraduationCandidatePreview(
      state,
      "organizational-behavior",
      "year2-spring",
    )).not.toBeNull();
    expect(state).toEqual(snapshot);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("unchanged");
  });
});

describe("Phase 13 candidate integration and UI", () => {
  it("selectorは追加後に候補から除外し、削除後に候補へ戻す", () => {
    let state = knownConfiguredState();
    const requirement = officialGraduationRequirements.requirements.find(
      (item) => item.symbol === "▲",
    )!;
    expect(selectGraduationCandidatesForRequirement(state, requirement.id).some(
      (item) => item.courseId === "organizational-behavior",
    )).toBe(true);
    state = appReducer(state, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "organizational-behavior", semesterId: "year2-spring" },
    });
    expect(selectGraduationCandidatesForRequirement(state, requirement.id).some(
      (item) => item.courseId === "organizational-behavior",
    )).toBe(false);
    state = appReducer(state, {
      type: "REMOVE_GRADUATION_PLAN_COURSE",
      payload: "organizational-behavior",
    });
    expect(selectGraduationCandidatesForRequirement(state, requirement.id).some(
      (item) => item.courseId === "organizational-behavior",
    )).toBe(true);
  });

  it("追加後に卒業要件progressへ反映し、schema/state形状を増やさない", () => {
    const state = knownConfiguredState();
    const before = selectGraduationRequirementProgress(state);
    const next = appReducer(state, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "organizational-behavior", semesterId: "year2-spring" },
    });
    const after = selectGraduationRequirementProgress(next);
    const beforeGroup = before.requirementGroups.find((item) => item.symbol === "▲")!;
    const afterGroup = after.requirementGroups.find((item) => item.symbol === "▲")!;
    expect(afterGroup.plannedIncludedCredits).toBe(beforeGroup.plannedIncludedCredits + 2);
    expect(next.schemaVersion).toBe(5);
    expect(Object.keys(next)).not.toContain("graduationCandidates");
  });

  it("shortfallカードから候補dialogを開き、▲科目だけを表示する", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    expect(screen.getByRole("dialog", { name: "不足を埋める科目を探す" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/候補は推薦や順位ではありません/)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/▲/).length).toBeGreaterThan(0);
  });

  it("候補dialogで配置学期を選択しconstraint previewを表示する", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "組織行動論" },
    });
    const candidate = screen.getByText("組織行動論").closest("article")!;
    expect(within(candidate).getByText("✓ 配当年次一致")).toBeInTheDocument();
    expect(within(candidate).getByText("✓ 開講学期一致")).toBeInTheDocument();
    expect(within(candidate).getByText(/CAP上限内/)).toBeInTheDocument();
  });

  it("warningなし候補は明示操作で直接planへ追加する", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "組織行動論" },
    });
    const candidate = screen.getByText("組織行動論").closest("article")!;
    fireEvent.click(within(candidate).getByRole("button", { name: "この学期に追加" }));
    expect(screen.queryByRole("dialog", { name: "不足を埋める科目を探す" })).not.toBeInTheDocument();
    const spring = screen.getByRole("heading", { name: "2年前期" }).closest("section")!;
    expect(within(spring).getByText("組織行動論")).toBeInTheDocument();
  });

  it("warning付き候補は確認後なら追加できる", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "マーケット・イノベーション" },
    });
    const candidate = screen.getByText("マーケット・イノベーション").closest("article")!;
    fireEvent.click(within(candidate).getByRole("button", { name: "この学期に追加" }));
    expect(within(candidate).getByText("この配置には確認事項があります")).toBeInTheDocument();
    expect(within(candidate).getByRole("button", { name: "キャンセル" })).toHaveFocus();
    fireEvent.click(within(candidate).getByRole("button", { name: "追加する" }));
    const spring = screen.getByRole("heading", { name: "2年前期" }).closest("section")!;
    expect(within(spring).getByText("マーケット・イノベーション")).toBeInTheDocument();
  });

  it("候補0件は安全なempty stateを表示する", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "存在しない候補" },
    });
    expect(screen.getByText(/この条件に一致する未配置科目がありません/)).toBeInTheDocument();
    expect(screen.queryByText("要件を満たせません")).not.toBeInTheDocument();
  });

  it("職業専門科目選択の一般候補0件では超過単位と特殊科目の確認を案内する", () => {
    renderPlanner();
    const card = screen
      .getByRole("heading", { name: "職業専門科目 選択" })
      .closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    expect(
      screen.getByText(/直接この区分に該当する一般候補科目を確認できません/),
    ).toBeInTheDocument();
    expect(screen.getByText(/選択必修超過単位や特殊科目の扱い/)).toBeInTheDocument();
  });

  it("Escapeでdialogを閉じ、起点へfocusを戻す", () => {
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    const trigger = within(card).getByRole("button", { name: "候補科目を見る" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "不足を埋める科目を探す" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "不足を埋める科目を探す" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("curriculum-only候補はNot Foundリンクを表示しない", () => {
    const curriculumOnly = curriculumCoursesById.get("organizational-behavior") as CurriculumCourse;
    expect(courseCatalog.some((course) => course.id === curriculumOnly.courseId)).toBe(false);
    renderPlanner();
    const card = screen.getByRole("heading", { name: "経営科目" }).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "候補科目を見る" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: curriculumOnly.name },
    });
    const candidate = screen.getByText(curriculumOnly.name).closest("article")!;
    expect(within(candidate).queryByRole("link", { name: curriculumOnly.name })).not.toBeInTheDocument();
    expect(within(candidate).getByText(/curriculumデータのみ/)).toBeInTheDocument();
    expect(screen.getByText(/特殊科目は別の履修ルール/)).toBeInTheDocument();
  });
});
