import { describe, expect, it } from "vitest";
import { createInitialState, initialState } from "../state/initialState";
import { appReducer } from "../state/reducer";

describe("appReducer", () => {
  it("timetableModelを変更できる", () => {
    const result = appReducer(createInitialState(), {
      type: "SET_TIMETABLE_MODEL",
      payload: "A",
    });

    expect(result.user.timetableModel).toBe("A");
  });

  it("englishTrackを変更できる", () => {
    const result = appReducer(createInitialState(), {
      type: "SET_ENGLISH_TRACK",
      payload: "advanced",
    });

    expect(result.user.englishTrack).toBe("advanced");
  });

  it("前期科目statusを変更できる", () => {
    const result = appReducer(createInitialState(), {
      type: "SET_PREVIOUS_COURSE_STATUS",
      payload: { courseId: "business-introduction", status: "earned" },
    });

    expect(result.firstSemester.courses["business-introduction"]).toEqual({
      courseId: "business-introduction",
      status: "earned",
      confirmedByUser: true,
    });
  });

  it("lottery application statusを変更できる", () => {
    const result = appReducer(createInitialState(), {
      type: "SET_LOTTERY_APPLICATION_STATUS",
      payload: {
        courseId: "database",
        status: "applied",
        preferences: [
          {
            offeringId: "2026-second-database-A",
            scheduleOptionId: null,
            rank: 1,
          },
        ],
      },
    });

    expect(result.lotteries.database.applicationStatus).toBe("applied");
    expect(result.lotteries.database.resultStatus).toBe("pending");
  });

  it("RESET_APPでinitialStateへ戻る", () => {
    const changed = appReducer(createInitialState(), {
      type: "SET_SETUP_COMPLETED",
      payload: true,
    });

    const result = appReducer(changed, { type: "RESET_APP" });

    expect(result).toEqual(initialState);
    expect(result).not.toBe(initialState);
  });
});
