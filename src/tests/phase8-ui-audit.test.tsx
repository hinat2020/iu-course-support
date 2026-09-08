import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { LotteryResultPage } from "../pages/LotteryResultPage";
import { AppStateContext } from "../state/appStateContextValue";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";

afterEach(() => cleanup());

function readyNormalState(): AppState {
  let state = appReducer(createInitialState(), {
    type: "SET_TIMETABLE_MODEL",
    payload: "C",
  });
  state = appReducer(state, {
    type: "SET_ENGLISH_TRACK",
    payload: "normal",
  });
  state = appReducer(state, {
    type: "SET_ALL_REQUIRED_COURSES_EARNED",
    payload: {
      courseIds: firstSemesterRequiredCourses.map((course) => course.id),
    },
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
  return appReducer(state, {
    type: "SET_SETUP_COMPLETED",
    payload: true,
  });
}

describe("Phase 8 lottery-result UI audit", () => {
  it("設定変更で無効になった保存済み当選枠を別の枠として表示しない", () => {
    let state = appReducer(readyNormalState(), {
      type: "SELECT_COURSE",
      payload: "interaction-design-intro",
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: {
        courseId: "interaction-design-intro",
        status: "applied",
        preferences: [
          {
            offeringId: "2026-second-interaction-design-intro-ALL",
            scheduleOptionId: "wed3",
            rank: 1,
          },
          {
            offeringId: "2026-second-interaction-design-intro-ALL",
            scheduleOptionId: "tue4",
            rank: 2,
          },
        ],
      },
    });
    state = appReducer(state, {
      type: "SET_LOTTERY_RESULT",
      payload: {
        courseId: "interaction-design-intro",
        result: "won",
        wonOfferingId: "2026-second-interaction-design-intro-ALL",
        wonScheduleOptionId: "tue4",
      },
    });
    state = appReducer(state, {
      type: "SET_ENGLISH_TRACK",
      payload: "advanced",
    });

    expect(
      state.lotteries["interaction-design-intro"].wonScheduleOptionId,
    ).toBe("tue4");

    render(
      <AppStateContext.Provider value={{ state, dispatch: vi.fn() }}>
        <MemoryRouter>
          <LotteryResultPage />
        </MemoryRouter>
      </AppStateContext.Provider>,
    );

    expect(
      screen.getByRole("combobox", { name: "当選した授業枠" }),
    ).toHaveValue("");
    expect(
      screen.getByText(
        "保存済みの抽選希望枠が現在の設定では利用できません。抽選内容を確認してください。",
      ),
    ).toBeInTheDocument();
  });
});
