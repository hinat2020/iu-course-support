import { beforeEach, describe, expect, it } from "vitest";
import {
  candidateCourses,
  candidateOfferings,
  graduationRequirements,
  registrationRules,
} from "../data/2026/coursePlanning";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import { calculateCap, type CapResult } from "../domain/cap";
import type { Course } from "../domain/course";
import {
  evaluateCandidateCourse,
  evaluateScheduleOptions,
  resolveCandidateOffering,
  type ScheduledCourse,
} from "../domain/coursePlanning";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import {
  calculateRequirementContribution,
  calculateRequirementProgress,
} from "../domain/requirements";
import type {
  CourseOffering,
  TimeSlot,
  TimetableModel,
} from "../domain/timetable";
import type {
  FirstSemesterState,
  PreviousCourseStatus,
} from "../domain/user";
import { createInitialState } from "../state/initialState";
import { appReducer } from "../state/reducer";
import { loadState, saveState } from "../storage/localStorage";

function makeCourse(
  id: string,
  credits = 2,
  requirementGroups: string[] = [],
): Course {
  return {
    id,
    name: id,
    credits,
    requirementType: "required_elective",
    requirementGroups,
    grade: 1,
    semester: "first",
    category: { major: "test" },
  };
}

function makeFirstSemester(
  courses: readonly Course[],
  status: PreviousCourseStatus,
): FirstSemesterState {
  return {
    requiredCoursesConfirmed: true,
    courses: Object.fromEntries(
      courses.map((course) => [
        course.id,
        {
          courseId: course.id,
          status,
          confirmedByUser: true,
        },
      ]),
    ),
    innovationMethod: {
      registeredInFirstSemester: "unknown",
      moduleType: null,
      confirmedByUser: false,
    },
  };
}

function getRequiredCourses(
  model: TimetableModel = "A",
  track: "normal" | "advanced" = "normal",
) {
  return generateRequiredTimetable({
    timetableModel: model,
    englishTrack: track,
    academicYear: 2026,
    grade: 1,
    semester: "second",
    courses: courseCatalog,
    offerings: courseOfferings,
  });
}

function knownCap(maximumAnnualCredits = 38): CapResult {
  return {
    firstSemesterRegistered: 24,
    secondSemesterConfirmed: 14,
    candidateCredits: maximumAnnualCredits - 38,
    wonCredits: 0,
    confirmedAnnualCredits: 38,
    maximumAnnualCredits,
    resultReflectedAnnualCredits: 38,
    limit: 46,
    exceeded: maximumAnnualCredits > 46,
    resultExceeded: false,
  };
}

function requiredSchedules(
  model: TimetableModel,
  track: "normal" | "advanced",
): ScheduledCourse[] {
  return getRequiredCourses(model, track).courses.map(
    ({ course, offering }) => ({
      courseId: course.id,
      courseName: course.name,
      slots: offering.slots,
    }),
  );
}

function candidateOffering(courseId: string, model: TimetableModel) {
  return resolveCandidateOffering({
    courseId,
    timetableModel: model,
    academicYear: 2026,
    semester: "second",
    offerings: candidateOfferings,
  });
}

describe("Phase 4 CAP", () => {
  it("earned 2単位を前期CAPへ加算する", () => {
    const courses = [makeCourse("earned")];
    const result = calculateCap({
      firstSemester: makeFirstSemester(courses, "earned"),
      firstSemesterCourses: courses,
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: 46,
    });

    expect(result.firstSemesterRegistered).toBe(2);
  });

  it("failed 2単位を前期CAPへ加算し修得単位へ加算しない", () => {
    const courses = [makeCourse("failed", 2, ["ict-primary"])];
    const firstSemester = makeFirstSemester(courses, "failed");
    const cap = calculateCap({
      firstSemester,
      firstSemesterCourses: courses,
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: 46,
    });
    const progress = calculateRequirementProgress({
      firstSemester,
      firstSemesterCourses: courses,
      requirements: graduationRequirements.requirements,
    });

    expect(cap.firstSemesterRegistered).toBe(2);
    expect(
      progress.find((item) => item.groupId === "ict-primary")?.earnedCredits,
    ).toBe(0);
  });

  it("not_takenは前期CAPへ加算しない", () => {
    const courses = [makeCourse("not-taken")];
    const result = calculateCap({
      firstSemester: makeFirstSemester(courses, "not_taken"),
      firstSemesterCourses: courses,
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: 46,
    });

    expect(result.firstSemesterRegistered).toBe(0);
  });

  it("unknownがある場合はCAPの年次合計をnullにする", () => {
    const courses = [makeCourse("unknown")];
    const result = calculateCap({
      firstSemester: makeFirstSemester(courses, "unknown"),
      firstSemesterCourses: courses,
      requiredSecondSemesterCourses: [],
      selectedCandidateCourses: [],
      capLimit: 46,
    });

    expect(result).toMatchObject({
      firstSemesterRegistered: null,
      confirmedAnnualCredits: null,
      maximumAnnualCredits: null,
      exceeded: null,
    });
  });

  it("前期24単位と後期必修14単位で確定38 / 46になる", () => {
    const firstCourses = Array.from({ length: 12 }, (_, index) =>
      makeCourse("first-" + index),
    );
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses, "earned"),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: getRequiredCourses().courses.map(
        ({ course }) => course,
      ),
      selectedCandidateCourses: [],
      capLimit: registrationRules.annualCap,
    });

    expect(result.confirmedAnnualCredits).toBe(38);
    expect(result.limit).toBe(46);
  });

  it("確定38単位に2単位候補を加えると最大40 / 46になる", () => {
    const firstCourses = Array.from({ length: 12 }, (_, index) =>
      makeCourse("first-" + index),
    );
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses, "earned"),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: getRequiredCourses().courses.map(
        ({ course }) => course,
      ),
      selectedCandidateCourses: [makeCourse("candidate")],
      capLimit: 46,
    });

    expect(result.maximumAnnualCredits).toBe(40);
    expect(result.exceeded).toBe(false);
  });

  it("候補を含めて46単位を超える場合はexceeded=trueになる", () => {
    const firstCourses = Array.from({ length: 16 }, (_, index) =>
      makeCourse("first-" + index),
    );
    const result = calculateCap({
      firstSemester: makeFirstSemester(firstCourses, "earned"),
      firstSemesterCourses: firstCourses,
      requiredSecondSemesterCourses: getRequiredCourses().courses.map(
        ({ course }) => course,
      ),
      selectedCandidateCourses: [makeCourse("candidate")],
      capLimit: 46,
    });

    expect(result.maximumAnnualCredits).toBe(48);
    expect(result.exceeded).toBe(true);
  });
});

describe("Phase 4 timetable conflicts", () => {
  it("Aモデルの情報系数学応用B 月3は必修の月1・2と衝突しない", () => {
    const result = evaluateScheduleOptions(
      candidateOffering("applied-information-mathematics-b", "A"),
      requiredSchedules("A", "normal"),
    );

    expect(result.hasAnyConflict).toBe(false);
  });

  it("Bモデルのネットワーク技術 火1はB必修と衝突しない", () => {
    const result = evaluateScheduleOptions(
      candidateOffering("network-technology", "B"),
      requiredSchedules("B", "normal"),
    );

    expect(result.hasAnyConflict).toBe(false);
  });

  it("C + Advancedのインタラクションデザインは水3利用可能・火4衝突になる", () => {
    const result = evaluateScheduleOptions(
      candidateOffering("interaction-design-intro", "C"),
      requiredSchedules("C", "advanced"),
    );
    const wed3 = result.options.find((option) => option.id === "wed3");
    const tue4 = result.options.find((option) => option.id === "tue4");

    expect(wed3?.hasConflict).toBe(false);
    expect(tue4?.conflictsWith).toEqual([
      {
        courseId: "business-english-practicum-2b",
        courseName: "ビジネス英語実習Ⅱb",
      },
    ]);
    expect(result.allOptionsConflict).toBe(false);
  });

  it("normalのインタラクションデザインはモデル必修に応じて両枠を評価する", () => {
    const result = evaluateScheduleOptions(
      candidateOffering("interaction-design-intro", "E"),
      requiredSchedules("E", "normal"),
    );

    expect(result.options.map((option) => option.id)).toEqual(["wed3", "tue4"]);
    expect(result.availableOptions).toEqual(["wed3", "tue4"]);
  });

  it("選択済み候補同士が同時限なら相互に衝突する", () => {
    const courseA: ScheduledCourse = {
      courseId: "candidate-a",
      courseName: "候補A",
      slots: [{ day: "mon", period: 1 }],
    };
    const courseB: ScheduledCourse = {
      courseId: "candidate-b",
      courseName: "候補B",
      slots: [{ day: "mon", period: 1 }],
    };
    const offeringA: CourseOffering = {
      id: "offering-a",
      courseId: "candidate-a",
      academicYear: 2026,
      semester: "second",
      model: "ALL",
      slots: courseA.slots as TimeSlot[],
      registrationMethod: "lottery",
    };
    const offeringB: CourseOffering = {
      ...offeringA,
      id: "offering-b",
      courseId: "candidate-b",
    };

    expect(evaluateScheduleOptions(offeringA, [courseB]).conflictsWith).toEqual([
      "candidate-b",
    ]);
    expect(evaluateScheduleOptions(offeringB, [courseA]).conflictsWith).toEqual([
      "candidate-a",
    ]);
  });

  it("一部scheduleOptionのみ衝突する場合はeligibleになる", () => {
    const course = candidateCourses.find(
      (item) => item.id === "interaction-design-intro",
    );
    if (!course) throw new Error("test candidate not found");
    const decision = evaluateCandidateCourse({
      course,
      offering: candidateOffering(course.id, "C"),
      existingCourses: [
        {
          courseId: "advanced-english",
          courseName: "Advanced英語",
          slots: [{ day: "tue", period: 4 }],
        },
      ],
      cap: knownCap(),
      requirementProgress: [],
      isSelected: false,
    });

    expect(decision.timetable.hasAnyConflict).toBe(true);
    expect(decision.timetable.allOptionsConflict).toBe(false);
    expect(decision.eligibility).toBe("eligible");
  });

  it("全scheduleOptionが衝突する場合はineligibleになる", () => {
    const course = candidateCourses.find(
      (item) => item.id === "interaction-design-intro",
    );
    if (!course) throw new Error("test candidate not found");
    const decision = evaluateCandidateCourse({
      course,
      offering: candidateOffering(course.id, "A"),
      existingCourses: [
        {
          courseId: "block-wed3",
          courseName: "水3科目",
          slots: [{ day: "wed", period: 3 }],
        },
        {
          courseId: "block-tue4",
          courseName: "火4科目",
          slots: [{ day: "tue", period: 4 }],
        },
      ],
      cap: knownCap(),
      requirementProgress: [],
      isSelected: false,
    });

    expect(decision.timetable.allOptionsConflict).toBe(true);
    expect(decision.eligibility).toBe("ineligible");
  });

  it("モデル変更後は候補Offeringを新しいモデルから再解決する", () => {
    expect(candidateOffering("market-innovation", "A").slots).toEqual([
      { day: "fri", period: 1 },
    ]);
    expect(candidateOffering("market-innovation", "B").slots).toEqual([
      { day: "mon", period: 1 },
    ]);
  });

  it("normalからadvancedへ変えるとInteraction Design火4を再判定する", () => {
    const offering = candidateOffering("interaction-design-intro", "C");
    const normal = evaluateScheduleOptions(
      offering,
      requiredSchedules("C", "normal"),
    );
    const advanced = evaluateScheduleOptions(
      offering,
      requiredSchedules("C", "advanced"),
    );

    expect(normal.conflictingOptions).not.toContain("tue4");
    expect(advanced.conflictingOptions).toContain("tue4");
  });
});

describe("Phase 4 requirements and persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("前期に■4単位earnedなら■ progressは4 / 8になる", () => {
    const courses = [
      makeCourse("ict-a", 2, ["ict-primary"]),
      makeCourse("ict-b", 2, ["ict-primary"]),
    ];
    const progress = calculateRequirementProgress({
      firstSemester: makeFirstSemester(courses, "earned"),
      firstSemesterCourses: courses,
      requirements: graduationRequirements.requirements,
    });

    expect(
      progress.find((item) => item.groupId === "ict-primary"),
    ).toMatchObject({
      earnedCredits: 4,
      requiredCredits: 8,
      remainingCredits: 4,
      completed: false,
    });
  });

  it("■4単位earnedと2単位■候補で修得した場合は6 / 8になる", () => {
    const earnedCourses = [
      makeCourse("ict-a", 2, ["ict-primary"]),
      makeCourse("ict-b", 2, ["ict-primary"]),
    ];
    const progress = calculateRequirementProgress({
      firstSemester: makeFirstSemester(earnedCourses, "earned"),
      firstSemesterCourses: earnedCourses,
      requirements: graduationRequirements.requirements,
    });
    const contribution = calculateRequirementContribution(
      makeCourse("database", 2, ["ict-primary"]),
      progress,
    );

    expect(contribution[0]).toMatchObject({
      currentCredits: 4,
      creditsIfEarned: 6,
      requiredCredits: 8,
    });
  });

  it("failedの■科目をrequirement progressへ加算しない", () => {
    const courses = [makeCourse("ict-failed", 2, ["ict-primary"])];
    const progress = calculateRequirementProgress({
      firstSemester: makeFirstSemester(courses, "failed"),
      firstSemesterCourses: courses,
      requirements: graduationRequirements.requirements,
    });

    expect(
      progress.find((item) => item.groupId === "ict-primary")?.earnedCredits,
    ).toBe(0);
  });

  it("plannedCourseのselected切替を保存・再読込できる", () => {
    const state = appReducer(createInitialState(), {
      type: "SELECT_COURSE",
      payload: "database",
    });
    saveState(state);

    expect(loadState().plannedCourses.database).toEqual({ selected: true });
  });
});
