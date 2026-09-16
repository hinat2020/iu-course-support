import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import routerSource from "../app/router.tsx?raw";
import { AppNavigation } from "../components/AppNavigation";
import { firstSemesterElectiveCourses, firstSemesterRequiredCourses } from "../data/2026/setup";
import { GraduationPlanningIntroPage } from "../pages/GraduationPlanningIntroPage";
import { HomePage } from "../pages/HomePage";
import { RegistrationHomePage } from "../pages/RegistrationHomePage";
import { AppStateContext } from "../state/appStateContextValue";
import { selectCourseDetail } from "../state/courseDetailSelector";
import { getRootDestination } from "../state/dashboardSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { migrateState } from "../storage/migrations";

function readyState(): AppState {
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
  state = appReducer(state, {
    type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
    payload: false,
  });
  return appReducer(state, { type: "SET_SETUP_COMPLETED", payload: true });
}

function renderWithState(state: AppState, initialEntry: string, children: React.ReactNode) {
  return render(
    <AppStateContext.Provider value={{ state, dispatch: vi.fn() }}>
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    </AppStateContext.Provider>,
  );
}

afterEach(() => cleanup());

describe("Phase 10 top-level structure", () => {
  it("setup未完了時のroot挙動を維持する", () => {
    expect(getRootDestination(false)).toBeNull();
    expect(getRootDestination(true)).toBe("/home");
  });

  it("setup未完了でApp Homeへ直接アクセスすると基本設定へ案内する", () => {
    renderWithState(
      createInitialState(),
      "/home",
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/setup" element={<h1>基本設定</h1>} />
      </Routes>,
    );
    expect(screen.getByRole("heading", { name: "基本設定" })).toBeInTheDocument();
  });

  it("setup完了後のApp Homeに2つの主要機能を表示する", () => {
    renderWithState(readyState(), "/home", <HomePage />);
    expect(screen.getByRole("heading", { name: "履修サポート" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /1年後期 履修登録/ })).toHaveAttribute(
      "href",
      "/registration/2026-fall",
    );
    expect(screen.getByRole("link", { name: /卒業設計/ })).toHaveAttribute(
      "href",
      "/graduation",
    );
  });

  it("App HomeからRegistration Homeへ遷移できる", () => {
    renderWithState(
      readyState(),
      "/home",
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/registration/2026-fall" element={<RegistrationHomePage />} />
      </Routes>,
    );
    fireEvent.click(screen.getByRole("link", { name: /1年後期 履修登録/ }));
    expect(screen.getByRole("heading", { name: /1年後期 履修登録/ })).toBeInTheDocument();
    expect(screen.getByText("やること")).toBeInTheDocument();
  });

  it("App HomeからGraduation Introへ遷移できる", () => {
    renderWithState(
      readyState(),
      "/home",
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/graduation" element={<GraduationPlanningIntroPage />} />
      </Routes>,
    );
    fireEvent.click(screen.getByRole("link", { name: /卒業設計/ }));
    expect(screen.getByRole("heading", { name: "卒業設計" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByText(/Phase 11/)).not.toBeInTheDocument();
  });
});

describe("Phase 10 navigation and compatibility", () => {
  it("主要ナビゲーションを4項目に整理し、既存詳細ルートを履修登録の現在地にする", () => {
    renderWithState(readyState(), "/lottery/results", <AppNavigation />);
    const navigation = screen.getByRole("navigation", { name: "主要ナビゲーション" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(4);
    expect(within(navigation).getByRole("link", { name: "1年後期履修登録" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("新旧の主要ルート定義を維持する", () => {
    const paths = [
      "/home",
      "/registration/2026-fall",
      "/graduation",
      "/timetable",
      "/plan",
      "/lottery",
      "/lottery/results",
      "/special",
      "/review",
      "/settings",
      "/courses/:courseId",
    ];
    for (const path of paths) {
      expect(routerSource).toContain(`path="${path}"`);
    }
  });

  it("Phase 9のシラバス参照を維持する", () => {
    expect(selectCourseDetail(readyState(), "database")?.syllabus).toMatchObject({
      academicYear: 2026,
      courseName: "データベース",
    });
  });

  it("schemaVersion 5とcurrent state migrationの同一性を維持する", () => {
    const state = readyState();
    expect(state.schemaVersion).toBe(5);
    expect(migrateState(structuredClone(state))).toEqual(state);
  });
});
