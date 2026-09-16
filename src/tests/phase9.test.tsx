import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import auditJson from "../data/2026/syllabus-audit.json";
import { courseCatalog } from "../data/2026/requiredTimetable";
import { firstSemesterElectiveCourses, firstSemesterRequiredCourses } from "../data/2026/setup";
import { getSyllabusByCourseId, syllabusCatalog } from "../data/2026/syllabus";
import syllabusSource from "../data/2026/syllabus.json?raw";
import { CourseDetailPage } from "../pages/CourseDetailPage";
import { AppStateContext } from "../state/appStateContextValue";
import { selectDashboardSummary } from "../state/dashboardSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";

function configuredState(): AppState {
  let state = appReducer(createInitialState(), { type: "SET_TIMETABLE_MODEL", payload: "C" });
  state = appReducer(state, { type: "SET_ENGLISH_TRACK", payload: "advanced" });
  state = appReducer(state, {
    type: "SET_ALL_REQUIRED_COURSES_EARNED",
    payload: { courseIds: firstSemesterRequiredCourses.map((course) => course.id) },
  });
  for (const course of firstSemesterElectiveCourses) {
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: course.id, status: "not_taken" },
    });
  }
  return state;
}

function renderCourse(courseId: string) {
  render(
    <AppStateContext.Provider value={{ state: configuredState(), dispatch: vi.fn() }}>
      <MemoryRouter initialEntries={[`/courses/${courseId}`]}>
        <Routes>
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppStateContext.Provider>,
  );
}

afterEach(() => cleanup());

describe("Phase 9 syllabus data", () => {
  it("syllabusデータに重複courseIdがない", () => {
    const topLevelIds = [...syllabusSource.matchAll(/^ {2}"([^"]+)": \{$/gm)].map((match) => match[1]);
    expect(topLevelIds).toHaveLength(Object.keys(syllabusCatalog).length);
    expect(new Set(topLevelIds).size).toBe(topLevelIds.length);
  });

  it("syllabus側の全courseIdがcourse masterに存在する", () => {
    const masterIds = new Set(courseCatalog.map((course) => course.id));
    expect(Object.keys(syllabusCatalog).every((courseId) => masterIds.has(courseId))).toBe(true);
  });

  it("全件が2026年度で単位数が負数ではない", () => {
    for (const syllabus of Object.values(syllabusCatalog)) {
      expect(syllabus.academicYear).toBe(2026);
      expect(syllabus.source.academicYear).toBe(2026);
      expect(syllabus.source.type).toBe("official_syllabus");
      expect(syllabus.credits === null || syllabus.credits >= 0).toBe(true);
    }
  });

  it("lessonPlanが連番の有効な構造になっている", () => {
    for (const syllabus of Object.values(syllabusCatalog)) {
      expect(Array.isArray(syllabus.lessonPlan)).toBe(true);
      syllabus.lessonPlan?.forEach((lesson, index) => {
        expect(lesson.number).toBe(index + 1);
        expect(lesson.topic === null || typeof lesson.topic === "string").toBe(true);
        expect(lesson.content === null || typeof lesson.content === "string").toBe(true);
      });
    }
  });

  it("courseId selectorで登録済み・未登録を区別する", () => {
    expect(getSyllabusByCourseId("database")?.courseCode).toBe("DBM1340001");
    expect(getSyllabusByCourseId("innovation-method-a")).toBeNull();
  });

  it("照合監査はmatched 30・unmatched 2・ambiguous 2", () => {
    expect(auditJson.filter((item) => item.status === "matched")).toHaveLength(30);
    expect(auditJson.filter((item) => item.status === "unmatched")).toHaveLength(2);
    expect(auditJson.filter((item) => item.status === "ambiguous")).toHaveLength(2);
  });

  it("course master全件が重複なく照合監査に含まれる", () => {
    const masterIds = courseCatalog.map((course) => course.id).sort();
    const auditIds = auditJson.map((item) => item.courseId).sort();

    expect(auditIds).toEqual(masterIds);
    expect(new Set(auditIds).size).toBe(auditIds.length);
  });
});

describe("Phase 9 CourseDetail", () => {
  it("登録済みシラバスの概要・担当教員・授業計画を表示する", () => {
    renderCourse("database");
    expect(screen.getByRole("heading", { name: "シラバス" })).toBeInTheDocument();
    expect(screen.getByText("片桐 雅二")).toBeInTheDocument();
    expect(screen.getByText("授業計画（15回）")).toBeInTheDocument();
    expect(screen.getByText(/2026年度公式シラバスをもとに表示しています/)).toBeInTheDocument();
  });

  it("未登録科目は存在しないと断定せず未登録表示にする", () => {
    renderCourse("innovation-method-a");
    expect(screen.getByText("2026年度シラバスデータ未登録")).toBeInTheDocument();
    expect(screen.getByText(/未登録は、科目が存在しない・開講されないことを意味しません/)).toBeInTheDocument();
  });

  it("存在しないcourseIdは既存Not Foundを維持する", () => {
    renderCourse("not-a-course");
    expect(screen.getByRole("heading", { name: "科目が見つかりません" })).toBeInTheDocument();
  });
});

describe("Phase 9 regression", () => {
  it("syllabus追加がCAP・lottery・timetableの状態や計算を変更しない", () => {
    const state = configuredState();
    const before = structuredClone(state);
    const summary = selectDashboardSummary(state);
    getSyllabusByCourseId("database");

    expect(summary.requiredTimetable?.courses).toHaveLength(8);
    expect(summary.requiredTimetable?.totalCredits).toBe(14);
    expect(summary.cap?.secondSemesterConfirmed).toBe(14);
    expect(state.lotteries).toEqual({});
    expect(state).toEqual(before);
    expect("syllabus" in state).toBe(false);
    expect(state.schemaVersion).toBe(5);
  });
});
