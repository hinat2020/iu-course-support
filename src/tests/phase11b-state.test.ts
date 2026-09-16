import { afterEach, describe, expect, it } from "vitest";
import { curriculumCourses } from "../data/2026/curriculum";
import {
  addPlannedCourse,
  canAddCourseToPlan,
  createEmptyGraduationPlan,
  movePlannedCourse,
  removePlannedCourse,
  type GraduationSemesterId,
} from "../domain/graduationPlanning";
import { selectDashboardSummary } from "../state/dashboardSelectors";
import { selectGraduationBoard } from "../state/graduationSelectors";
import { createInitialState, type AppState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { loadState, STORAGE_KEY } from "../storage/localStorage";
import { migrateState } from "../storage/migrations";

const validCourseIds = new Set(
  curriculumCourses
    .filter((course) => course.planningAvailability === "standard")
    .map((course) => course.courseId),
);
const plannedEntry = {
  courseId: "data-science-foundations",
  semesterId: "year2-spring" as const,
};

afterEach(() => localStorage.clear());

function existingUserState(): AppState {
  const initial = createInitialState();
  return {
    ...initial,
    setupCompleted: true,
    user: {
      ...initial.user,
      timetableModel: "C",
      englishTrack: "advanced",
    },
    firstSemester: {
      ...initial.firstSemester,
      requiredCoursesConfirmed: true,
      courses: {
        "study-skills": {
          courseId: "study-skills",
          status: "earned",
          confirmedByUser: true,
        },
      },
      innovationMethod: {
        registeredInFirstSemester: true,
        moduleType: "lecture",
        confirmedByUser: true,
      },
    },
    plannedCourses: { database: { selected: true } },
    lotteries: {
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
    innovationLecture: {
      ...initial.innovationLecture,
      previousEarnedCount: 1,
    },
    innovationMethod: {
      ...initial.innovationMethod,
      previousEarnedCount: 1,
    },
  };
}

describe("Phase 11B graduation plan state and migration", () => {
  it("uses schema v5, an empty plan, and the unchanged storage key", () => {
    expect(createInitialState().schemaVersion).toBe(5);
    expect(createInitialState().graduationPlan).toEqual({ entries: [] });
    expect(STORAGE_KEY).toBe("iu-course-support:v1");
  });

  it("migrates v4 without changing any existing user input", () => {
    const state = existingUserState();
    const { graduationPlan: _plan, ...withoutPlan } = state;
    void _plan;
    const migrated = migrateState({ ...withoutPlan, schemaVersion: 4 });
    expect(migrated).toEqual({ ...state, graduationPlan: { entries: [] } });
  });

  it("does not copy first-semester records into the stored plan", () => {
    const state = existingUserState();
    const { graduationPlan: _plan, ...withoutPlan } = state;
    void _plan;
    expect(migrateState({ ...withoutPlan, schemaVersion: 4 }).graduationPlan.entries).toEqual([]);
    expect(selectGraduationBoard(state)[0].courses.find((course) =>
      course.course.courseId === "study-skills",
    )?.status).toBe("earned");
  });

  it.each(["failed", "not_taken", "unknown"] as const)(
    "does not turn first-semester %s into earned",
    (status) => {
      const state = existingUserState();
      state.firstSemester.courses["study-skills"].status = status;
      expect(selectGraduationBoard(state)[0].courses.some((course) =>
        course.course.courseId === "study-skills" && course.status === "earned",
      )).toBe(false);
      expect(state.graduationPlan.entries).toEqual([]);
    },
  );

  it("loads a valid v5 state idempotently", () => {
    const state = {
      ...existingUserState(),
      graduationPlan: { entries: [plannedEntry] },
    };
    expect(migrateState(structuredClone(state))).toEqual(state);
  });

  it("repairs a wholly corrupt plan without resetting any other field", () => {
    const state = existingUserState();
    const migrated = migrateState({ ...state, graduationPlan: null });
    expect(migrated).toEqual({ ...state, graduationPlan: { entries: [] } });
  });

  it("preserves old input when LocalStorage contains a corrupt graduation plan", () => {
    const state = existingUserState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      graduationPlan: { entries: [
        plannedEntry,
        { courseId: "unknown-course", semesterId: "year2-fall" },
      ] },
    }));
    expect(loadState()).toEqual({
      ...state,
      graduationPlan: { entries: [plannedEntry] },
    });
  });

  it("keeps the first valid entry and drops duplicate, unknown, and invalid entries", () => {
    const state = existingUserState();
    const migrated = migrateState({
      ...state,
      graduationPlan: { entries: [
        plannedEntry,
        { ...plannedEntry, semesterId: "year2-fall" },
        { courseId: "not-in-curriculum", semesterId: "year2-spring" },
        { courseId: "career-design-1", semesterId: "year9-spring" },
        { courseId: "career-design-2", semesterId: "year3-fall", status: "earned" },
      ] },
    });
    expect(migrated.graduationPlan.entries).toEqual([plannedEntry]);
    expect(migrated.user).toEqual(state.user);
    expect(migrated.firstSemester).toEqual(state.firstSemester);
    expect(migrated.lotteries).toEqual(state.lotteries);
    expect(migrated.innovationLecture).toEqual(state.innovationLecture);
    expect(migrated.innovationMethod).toEqual(state.innovationMethod);
  });

  it("adds a known course exactly once", () => {
    const empty = createEmptyGraduationPlan();
    const once = addPlannedCourse(empty, plannedEntry, validCourseIds);
    expect(once.entries).toEqual([plannedEntry]);
    expect(addPlannedCourse(once, { ...plannedEntry, semesterId: "year2-fall" }, validCourseIds)).toBe(once);
  });

  it("moves an entry without creating a second copy", () => {
    const once = addPlannedCourse(createEmptyGraduationPlan(), plannedEntry, validCourseIds);
    expect(movePlannedCourse(once, plannedEntry.courseId, "year2-fall", validCourseIds).entries)
      .toEqual([{ ...plannedEntry, semesterId: "year2-fall" }]);
  });

  it("removes an entry", () => {
    const once = addPlannedCourse(createEmptyGraduationPlan(), plannedEntry, validCourseIds);
    expect(removePlannedCourse(once, plannedEntry.courseId).entries).toEqual([]);
  });

  it("rejects unknown IDs and special a/b courses", () => {
    const empty = createEmptyGraduationPlan();
    expect(canAddCourseToPlan(empty, "not-in-curriculum", validCourseIds)).toBe(false);
    expect(addPlannedCourse(empty, { courseId: "not-in-curriculum", semesterId: "year2-spring" }, validCourseIds)).toBe(empty);
    expect(addPlannedCourse(empty, { courseId: "innovation-lecture-a", semesterId: "year2-spring" }, validCourseIds)).toBe(empty);
  });

  it("rejects invalid semester IDs on add and move", () => {
    const invalid = "year9-spring" as GraduationSemesterId;
    const empty = createEmptyGraduationPlan();
    expect(addPlannedCourse(empty, { courseId: plannedEntry.courseId, semesterId: invalid }, validCourseIds)).toBe(empty);
    const once = addPlannedCourse(empty, plannedEntry, validCourseIds);
    expect(movePlannedCourse(once, plannedEntry.courseId, invalid, validCourseIds)).toBe(once);
  });

  it("rejects invalid reducer actions without touching existing user state", () => {
    const state = existingUserState();
    const invalid = "year9-spring" as GraduationSemesterId;
    expect(appReducer(state, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: "not-in-curriculum", semesterId: "year2-spring" },
    })).toBe(state);
    expect(appReducer(state, {
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: plannedEntry.courseId, semesterId: invalid },
    })).toBe(state);
    expect(appReducer(state, {
      type: "MOVE_GRADUATION_PLAN_COURSE",
      payload: { courseId: plannedEntry.courseId, semesterId: invalid },
    })).toBe(state);
  });

  it("leaves lottery, CAP, timetable, and special summaries unchanged", () => {
    const before = existingUserState();
    const after = appReducer(before, {
      type: "ADD_GRADUATION_PLAN_COURSE", payload: plannedEntry,
    });
    expect(after.graduationPlan.entries).toEqual([plannedEntry]);
    expect(after.lotteries).toEqual(before.lotteries);
    expect(after.innovationLecture).toEqual(before.innovationLecture);
    expect(after.innovationMethod).toEqual(before.innovationMethod);
    expect(selectDashboardSummary(after)).toEqual(selectDashboardSummary(before));
  });
});
