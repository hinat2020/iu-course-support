import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { curriculumCourses } from "../data/2026/curriculum";
import { registrationRules } from "../data/2026/coursePlanning";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { calculateCap } from "../domain/cap";
import {
  calculateGraduationCapPlan,
  calculateGraduationYearCap,
  getGraduationCapWarnings,
  type GraduationCapCourse,
} from "../domain/graduationCap";
import type {
  GraduationPlanEntry,
  GraduationSemesterId,
} from "../domain/graduationPlanning";
import { GraduationPlanPage } from "../pages/GraduationPlanPage";
import { AppStateContext } from "../state/appStateContextValue";
import {
  selectGraduationCapPlan,
  selectGraduationPrerequisiteChecks,
  selectProspectiveGraduationCap,
} from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { saveState } from "../storage/localStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const allFirstSemesterCourses = [
  ...firstSemesterRequiredCourses,
  ...firstSemesterElectiveCourses,
];

function semesterInput(
  semesterId: GraduationSemesterId,
  credits: number[],
  creditsKnown = true,
) {
  return {
    semesterId,
    courses: credits.map((value, index) => ({
      courseId: `${semesterId}-${index}`,
      credits: value,
    })),
    creditsKnown,
  };
}

function configuredState() {
  return appReducer(
    appReducer(createInitialState(), { type: "SET_TIMETABLE_MODEL", payload: "C" }),
    { type: "SET_ENGLISH_TRACK", payload: "normal" },
  );
}

function knownFirstSemester(
  overrides: Record<string, "earned" | "failed" | "not_taken" | "unknown"> = {},
) {
  let state = configuredState();
  for (const course of allFirstSemesterCourses) {
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: {
        courseId: course.id,
        status: overrides[course.id] ?? "not_taken",
      },
    });
  }
  return state;
}

function withDatabaseLottery(
  state: AppState,
  resultStatus: "pending" | "won" | "lost" | null,
  registrationConfirmation: "unconfirmed" | "confirmed" = "unconfirmed",
) {
  return {
    ...state,
    plannedCourses: { ...state.plannedCourses, database: { selected: true } },
    lotteries: {
      ...state.lotteries,
      database: {
        courseId: "database",
        applicationStatus: "applied" as const,
        preferences: [],
        resultStatus,
        wonOfferingId: resultStatus === "won" ? "2026-second-database-C" : null,
        wonScheduleOptionId: null,
        registrationConfirmation,
      },
    },
  } satisfies AppState;
}

function resultForGrade(state: AppState, grade: 1 | 2 | 3 | 4) {
  const result = selectGraduationCapPlan(state).find((item) => item.grade === grade);
  if (!result) throw new Error(`CAP result missing for grade ${grade}`);
  return result;
}

function entriesForGrade(
  grade: number,
  minimumCredits: number,
  excludedIds: ReadonlySet<string> = new Set(),
) {
  let credits = 0;
  const entries: GraduationPlanEntry[] = [];
  for (const course of curriculumCourses) {
    if (
      credits >= minimumCredits ||
      course.planningAvailability !== "standard" ||
      !course.recommendedYears.includes(grade) ||
      excludedIds.has(course.courseId)
    ) continue;
    entries.push({
      courseId: course.courseId,
      semesterId: `year${grade}-${course.availableSemesters[0]}` as GraduationSemesterId,
    });
    credits += course.credits;
  }
  if (credits < minimumCredits) throw new Error(`Insufficient test credits for grade ${grade}`);
  return entries;
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

describe("Phase 12B official CAP data", () => {
  it("公式CAPルールを年間・1年46・2〜4年42として保持する", () => {
    expect(registrationRules.capRules).toEqual([
      { grade: 1, period: "annual", limit: 46, sourceConfirmed: true },
      { grade: 2, period: "annual", limit: 42, sourceConfirmed: true },
      { grade: 3, period: "annual", limit: 42, sourceConfirmed: true },
      { grade: 4, period: "annual", limit: 42, sourceConfirmed: true },
    ]);
    expect(registrationRules.source).toMatchObject({
      documentName: "02_2026年度学生便覧.pdf",
      page: 20,
    });
  });

  it("例外ルールは根拠として保持するがautomaticにしない", () => {
    expect(registrationRules.capExceptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "required-course-retake",
        additionalPerSemester: 4,
        additionalAnnual: 8,
        automatic: false,
      }),
      expect.objectContaining({
        id: "excellent-academic-performance",
        additionalPerSemester: 4,
        additionalAnnual: 6,
        automatic: false,
      }),
    ]));
  });
});

describe("Phase 12B graduation CAP domain", () => {
  it("前期と後期を年間で合算する", () => {
    const result = calculateGraduationYearCap({
      grade: 2,
      spring: semesterInput("year2-spring", [20, 2]),
      fall: semesterInput("year2-fall", [18, 2]),
      rule: registrationRules.capRules[1],
    });
    expect(result).toMatchObject({ springCredits: 22, fallCredits: 20, annualCredits: 42, status: "at_limit" });
  });

  it.each([
    [45, "within_limit"],
    [46, "at_limit"],
    [47, "over_limit"],
  ] as const)("1年次%d/46を%sと判定する", (credits, status) => {
    const result = calculateGraduationYearCap({
      grade: 1,
      spring: semesterInput("year1-spring", [credits]),
      fall: semesterInput("year1-fall", []),
      rule: registrationRules.capRules[0],
    });
    expect(result.status).toBe(status);
  });

  it("未確認limitはunknown", () => {
    const result = calculateGraduationYearCap({
      grade: 2,
      spring: semesterInput("year2-spring", [20]),
      fall: semesterInput("year2-fall", [20]),
      rule: { grade: 2, period: "annual", limit: null, sourceConfirmed: false },
    });
    expect(result).toMatchObject({ annualCredits: 40, limit: null, status: "unknown" });
    expect(result.warnings).toContain("CAP上限の公式情報を確認できないため判定できません。");
  });

  it("履修登録単位が未確認ならunknownで0補完しない", () => {
    const result = calculateGraduationYearCap({
      grade: 1,
      spring: semesterInput("year1-spring", [2], false),
      fall: semesterInput("year1-fall", [14]),
      rule: registrationRules.capRules[0],
    });
    expect(result).toMatchObject({ springCredits: null, fallCredits: 14, annualCredits: null, status: "unknown" });
  });

  it("同一courseIdを年間で二重計上しない", () => {
    const duplicate: GraduationCapCourse = { courseId: "database", credits: 2 };
    const result = calculateGraduationYearCap({
      grade: 1,
      spring: { semesterId: "year1-spring", courses: [duplicate], creditsKnown: true },
      fall: { semesterId: "year1-fall", courses: [duplicate], creditsKnown: true },
      rule: registrationRules.capRules[0],
    });
    expect(result.annualCredits).toBe(2);
  });

  it("4学年分を一括計算する", () => {
    const results = calculateGraduationCapPlan({
      semesters: [semesterInput("year2-spring", [20]), semesterInput("year2-fall", [20])],
      rules: registrationRules.capRules,
    });
    expect(results).toHaveLength(4);
    expect(results.find((item) => item.grade === 2)?.annualCredits).toBe(40);
  });

  it("warning一覧へ学年を付ける", () => {
    const results = calculateGraduationCapPlan({
      semesters: [semesterInput("year1-spring", [47]), semesterInput("year1-fall", [])],
      rules: registrationRules.capRules,
    });
    expect(getGraduationCapWarnings(results)).toContain(
      "1年次: 計画上、年間履修上限を1単位超えています。",
    );
  });
});

describe("Phase 12B state integration", () => {
  it.each(["earned", "failed"] as const)("前期%sをCAP登録単位へ加算する", (status) => {
    const result = resultForGrade(knownFirstSemester({ "study-skills": status }), 1);
    expect(result).toMatchObject({ springCredits: 2, fallCredits: 14, annualCredits: 16 });
  });

  it("前期not_takenはCAPへ加算しない", () => {
    expect(resultForGrade(knownFirstSemester(), 1)).toMatchObject({ springCredits: 0, annualCredits: 14 });
  });

  it("前期unknownは1年次CAPをunknownにする", () => {
    expect(resultForGrade(knownFirstSemester({ "study-skills": "unknown" }), 1)).toMatchObject({
      springCredits: null,
      annualCredits: null,
      status: "unknown",
    });
  });

  it("後期必修8科目14単位を1年後期へ加算する", () => {
    expect(resultForGrade(knownFirstSemester(), 1).fallCredits).toBe(14);
  });

  it("selectedだけの候補は確定CAPへ入れない", () => {
    const state: AppState = {
      ...knownFirstSemester(),
      plannedCourses: { database: { selected: true } },
    };
    expect(resultForGrade(state, 1).fallCredits).toBe(14);
  });

  it.each([null, "pending", "lost"] as const)("抽選結果%sは確定CAPへ入れない", (status) => {
    expect(resultForGrade(withDatabaseLottery(knownFirstSemester(), status), 1).fallCredits).toBe(14);
  });

  it("wonかつUNIPA確認済みを1年後期へ加算する", () => {
    const state = withDatabaseLottery(knownFirstSemester(), "won", "confirmed");
    expect(resultForGrade(state, 1).fallCredits).toBe(16);
  });

  it("won未確認は1年後期へ加算しない", () => {
    expect(resultForGrade(withDatabaseLottery(knownFirstSemester(), "won"), 1).fallCredits).toBe(14);
  });

  it("現在対象と同一courseIdの手動planを二重計上しない", () => {
    const state: AppState = {
      ...withDatabaseLottery(knownFirstSemester(), "won", "confirmed"),
      graduationPlan: { entries: [{ courseId: "database", semesterId: "year1-spring" }] },
    };
    expect(resultForGrade(state, 1).annualCredits).toBe(16);
  });

  it("将来plannedを対象学年へ加算する", () => {
    const state: AppState = {
      ...knownFirstSemester(),
      graduationPlan: { entries: [{ courseId: "data-science-foundations", semesterId: "year2-spring" }] },
    };
    expect(resultForGrade(state, 2)).toMatchObject({ springCredits: 8, annualCredits: 14, status: "within_limit" });
  });

  it("moveで旧学年から減り新学年へ加算する", () => {
    const initial = appReducer(knownFirstSemester(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    const moved = appReducer(initial, {
      type: "MOVE_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year3-fall" },
    });
    expect(resultForGrade(moved, 2).annualCredits).toBe(12);
    expect(resultForGrade(moved, 3).annualCredits).toBe(27);
  });

  it("removeで計画単位を減算する", () => {
    const initial = appReducer(knownFirstSemester(), {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "data-science-foundations", semesterId: "year2-spring" },
    });
    const removed = appReducer(initial, {
      type: "REMOVE_GRADUATION_PLAN_COURSE",
      payload: "data-science-foundations",
    });
    expect(resultForGrade(removed, 2).annualCredits).toBe(12);
  });

  it("prospective CAP warningをstate変更なしでderived計算する", () => {
    const entries = entriesForGrade(2, 42, new Set(["data-science-foundations"]));
    const state: AppState = { ...knownFirstSemester(), graduationPlan: { entries } };
    const before = structuredClone(state);
    const preview = selectProspectiveGraduationCap(state, "data-science-foundations", "year2-spring");
    expect(preview?.status).toBe("over_limit");
    expect(state).toEqual(before);
  });

  it("CAP warningをLocalStorageへ保存しない", () => {
    const state: AppState = {
      ...knownFirstSemester(),
      graduationPlan: { entries: entriesForGrade(2, 43) },
    };
    expect(resultForGrade(state, 2).status).toBe("over_limit");
    saveState(state);
    const raw = localStorage.getItem("iu-course-support:v1") ?? "";
    expect(raw).not.toContain("over_limit");
    expect(raw).not.toContain("annualCredits");
  });

  it("特殊科目状態を通常CAPへ加算しない", () => {
    const base = knownFirstSemester();
    const state: AppState = {
      ...base,
      innovationLecture: {
        ...base.innovationLecture,
        resultStatus: "won",
        wonClassId: "kang-hanna-2026-fall",
        registrationConfirmation: "confirmed",
      },
    };
    expect(selectGraduationCapPlan(state)).toEqual(selectGraduationCapPlan(base));
  });

  it("schemaVersion 5とmigration対象stateを変更しない", () => {
    const state = knownFirstSemester();
    const before = structuredClone(state);
    selectGraduationCapPlan(state);
    expect(state).toEqual(before);
    expect(state.schemaVersion).toBe(5);
  });

  it("既存CAP計算の1年次46単位ルールを維持する", () => {
    const state = knownFirstSemester({ "study-skills": "earned" });
    const result = calculateCap({
      firstSemester: state.firstSemester,
      firstSemesterCourses: allFirstSemesterCourses,
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: registrationRules.annualCap,
    });
    expect(registrationRules.annualCap).toBe(46);
    expect(result.firstSemesterRegistered).toBe(2);
  });

  it("Phase 12A前提科目warningを維持する", () => {
    const state: AppState = {
      ...knownFirstSemester(),
      graduationPlan: { entries: [{ courseId: "pre-internship-guidance", semesterId: "year2-spring" }] },
    };
    expect(selectGraduationPrerequisiteChecks(state).get("pre-internship-guidance")?.status)
      .toBe("satisfied");
  });
});

describe("Phase 12B UI", () => {
  it("学年別の履修登録単位と確認済み上限を表示する", () => {
    renderPlanner(knownFirstSemester({ "study-skills": "earned" }));
    const region = screen.getByRole("region", { name: "学年別CAP（履修登録単位の計画）" });
    expect(within(region).getByText("1年次")).toBeInTheDocument();
    expect(within(region).getByText("計画上の履修登録単位：16単位 / 46単位")).toBeInTheDocument();
    expect(within(region).getByText("2年次")).toBeInTheDocument();
    expect(within(region).getByText("計画上の履修登録単位：12単位 / 42単位")).toBeInTheDocument();
    expect(within(region).getByText("計画上の履修登録単位：25単位 / 42単位")).toBeInTheDocument();
    expect(within(region).getByText("計画上の履修登録単位：5単位 / 42単位")).toBeInTheDocument();
  });

  it("前期unknownを問題なし表示にしない", () => {
    renderPlanner(knownFirstSemester({ "study-skills": "unknown" }));
    const region = screen.getByRole("region", { name: "学年別CAP（履修登録単位の計画）" });
    const firstYear = within(region).getByText("1年次").closest("li");
    expect(within(firstYear!).getByText("? 判定できません")).toBeInTheDocument();
    expect(within(firstYear!).getByText(/未確認項目/)).toBeInTheDocument();
  });

  it("追加前にCAP超過をsoft warningとして表示し配置を許可する", () => {
    const state: AppState = {
      ...knownFirstSemester(),
      graduationPlan: {
        entries: entriesForGrade(2, 42, new Set(["data-science-foundations"])),
      },
    };
    renderPlanner(state);
    fireEvent.click(screen.getByRole("button", { name: "科目を追加" }));
    fireEvent.change(screen.getByLabelText("科目名検索"), {
      target: { value: "データサイエンス基礎" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /データサイエンス基礎/ }));
    fireEvent.change(screen.getByLabelText("配置する学期"), {
      target: { value: "year2-spring" },
    });
    expect(screen.getByText("⚠ この配置では年間CAPを超えます")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この学期に追加" })).toBeEnabled();
  });

  it("前提不足とCAP超過のwarningを同時表示する", () => {
    const entries = entriesForGrade(2, 43, new Set(["basic-project-1"]));
    const state: AppState = {
      ...knownFirstSemester(),
      graduationPlan: {
        entries: [
          ...entries,
          { courseId: "basic-project-1", semesterId: "year2-spring" },
        ],
      },
    };
    renderPlanner(state);
    const semester = screen.getByRole("heading", { name: "2年前期" }).closest("section")!;
    const card = within(semester).getByText("基礎プロジェクトⅠ").closest("li");
    expect(within(card!).getByText("⚠ 前提科目を確認")).toBeInTheDocument();
    expect(within(card!).getByText("⚠ CAPを確認")).toBeInTheDocument();
  });
});
