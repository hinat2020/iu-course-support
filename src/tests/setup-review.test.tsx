import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { SetupCompletePage } from "../pages/SetupCompletePage";
import { RequiredTimetablePage } from "../pages/RequiredTimetablePage";
import { SetupReviewPage } from "../pages/SetupReviewPage";
import { AppStateProvider } from "../state/AppStateContext";
import { createInitialState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { loadState, saveState } from "../storage/localStorage";

function createReviewReadyState() {
  let state = appReducer(createInitialState(), {
    type: "SET_TIMETABLE_MODEL",
    payload: "B",
  });
  state = appReducer(state, {
    type: "SET_ENGLISH_TRACK",
    payload: "normal",
  });
  for (const course of firstSemesterElectiveCourses) {
    state = appReducer(state, {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: course.id, status: "not_taken" },
    });
  }
  state = appReducer(state, {
    type: "SET_ALL_REQUIRED_COURSES_EARNED",
    payload: {
      courseIds: firstSemesterRequiredCourses.map((course) => course.id),
    },
  });
  state = appReducer(state, {
    type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
    payload: false,
  });
  return state;
}

describe("SetupReviewPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("完了ボタンを押した場合だけsetupCompleted=trueにする", async () => {
    saveState(createReviewReadyState());

    render(
      <AppStateProvider>
        <MemoryRouter initialEntries={["/setup/review"]}>
          <Routes>
            <Route path="/setup/review" element={<SetupReviewPage />} />
            <Route path="/setup/complete" element={<SetupCompletePage />} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>,
    );

    expect(loadState().setupCompleted).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "この内容で設定を完了" }),
    );

    expect(
      await screen.findByRole("heading", { name: "初期設定が完了しました。" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "後期必修時間割を確認する" }),
    ).toHaveAttribute("href", "/timetable");
    await waitFor(() => expect(loadState().setupCompleted).toBe(true));
  });

  it("基本設定が未入力なら時間割から設定画面へ案内する", async () => {
    render(
      <AppStateProvider>
        <MemoryRouter initialEntries={["/timetable"]}>
          <Routes>
            <Route path="/timetable" element={<RequiredTimetablePage />} />
            <Route path="/setup" element={<p>基本設定の案内先</p>} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>,
    );

    expect(await screen.findByText("基本設定の案内先")).toBeInTheDocument();
  });
});
