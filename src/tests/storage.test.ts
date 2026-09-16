import { createElement, StrictMode } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../state/AppStateContext";
import { createInitialState, initialState } from "../state/initialState";
import {
  loadState,
  saveState,
  STORAGE_KEY,
} from "../storage/localStorage";

describe("LocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正常なAppStateを保存・読み込みできる", () => {
    const state = createInitialState();
    state.user.timetableModel = "A";
    state.user.englishTrack = "advanced";
    state.setupCompleted = true;

    saveState(state);

    expect(loadState()).toEqual(state);
  });

  it("壊れたJSONが入っていても初期状態を返す", () => {
    window.localStorage.setItem(STORAGE_KEY, "{broken-json");

    expect(loadState()).toEqual(initialState);
  });

  it("未対応schemaVersionでも初期状態へ戻る", () => {
    const unsupportedState = {
      ...createInitialState(),
      schemaVersion: 999,
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(unsupportedState),
    );

    expect(loadState()).toEqual(initialState);
  });

  it("Phase 1のschemaVersion 1を現行schemaへ移行する", () => {
    const state = createInitialState();
    const legacyInnovationMethod = {
      registeredInFirstSemester:
        state.firstSemester.innovationMethod.registeredInFirstSemester,
      moduleType: state.firstSemester.innovationMethod.moduleType,
    };
    const legacyState = {
      ...state,
      schemaVersion: 1,
      lotteries: {},
      innovationLecture: {
        lotteryStatus: "candidate",
        preferences: [],
        wonClassId: null,
        previousEarnedCount: 0,
      },
      innovationMethod: {
        moduleType: null,
        enrollmentSource: null,
        lotteryStatus: null,
        targetCredit: null,
      },
      firstSemester: {
        ...state.firstSemester,
        innovationMethod: legacyInnovationMethod,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState));

    const loaded = loadState();

    expect(loaded.schemaVersion).toBe(5);
    expect(loaded.firstSemester.innovationMethod.confirmedByUser).toBe(false);
    expect(loaded.firstSemester.innovationMethod.moduleType).toBeNull();
  });

  it("必須プロパティが壊れている場合も初期状態へ戻る", () => {
    const invalidState = {
      ...createInitialState(),
      user: { academicYear: 2026 },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invalidState));

    expect(loadState()).toEqual(initialState);
  });

  it("初回mountだけでは保存済みstateを上書きしない", () => {
    const savedState = createInitialState();
    savedState.user.timetableModel = "C";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      createElement(
        StrictMode,
        null,
        createElement(AppStateProvider, null),
      ),
    );

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(loadState().user.timetableModel).toBe("C");
  });
});
