import { describe, expect, it } from "vitest";
import courses from "../data/2026/courses.json";
import graduationRequirements from "../data/2026/graduation-requirements.json";
import timetable from "../data/2026/timetable.json";
import {
  candidateCourses,
  candidateOfferings,
  coursePlanningData,
} from "../data/2026/coursePlanning";
import { regularLotteryData } from "../data/2026/lottery";
import { specialCoursesData } from "../data/2026/specialCourses";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
  firstSemesterSetupData,
} from "../data/2026/setup";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import {
  generateRequiredTimetable,
  type GeneratedRequiredTimetable,
} from "../domain/requiredTimetable";
import { resolveCandidateOffering } from "../domain/coursePlanning";
import type {
  CourseOffering,
  TimeSlot,
  TimetableModel,
} from "../domain/timetable";
import type { EnglishTrack } from "../domain/user";

const models: readonly TimetableModel[] = ["A", "B", "C", "D", "E"];
const tracks: readonly EnglishTrack[] = ["normal", "advanced"];
const requiredCourseIds = [
  "english-core-skills-2",
  "basic-mathematics",
  "corporate-law-basics",
  "accounting-introduction",
  "prototyping-practicum",
  "project-introduction",
  "business-english-practicum-2a",
  "business-english-practicum-2b",
] as const;
const englishCourseIds = new Set([
  "english-core-skills-2",
  "business-english-practicum-2a",
  "business-english-practicum-2b",
]);
const expectedNormalSlots: Record<
  TimetableModel,
  Record<(typeof requiredCourseIds)[number], TimeSlot[]>
> = {
  A: {
    "english-core-skills-2": [{ day: "fri", period: 3 }],
    "basic-mathematics": [{ day: "thu", period: 3 }],
    "corporate-law-basics": [{ day: "tue", period: 2 }],
    "accounting-introduction": [{ day: "wed", period: 2 }],
    "prototyping-practicum": [
      { day: "mon", period: 1 },
      { day: "mon", period: 2 },
    ],
    "project-introduction": [{ day: "tue", period: 1 }],
    "business-english-practicum-2a": [{ day: "tue", period: 3 }],
    "business-english-practicum-2b": [{ day: "thu", period: 2 }],
  },
  B: {
    "english-core-skills-2": [{ day: "wed", period: 2 }],
    "basic-mathematics": [{ day: "tue", period: 3 }],
    "corporate-law-basics": [{ day: "wed", period: 1 }],
    "accounting-introduction": [{ day: "fri", period: 1 }],
    "prototyping-practicum": [
      { day: "mon", period: 3 },
      { day: "mon", period: 4 },
    ],
    "project-introduction": [{ day: "thu", period: 2 }],
    "business-english-practicum-2a": [{ day: "tue", period: 2 }],
    "business-english-practicum-2b": [{ day: "thu", period: 3 }],
  },
  C: {
    "english-core-skills-2": [{ day: "fri", period: 2 }],
    "basic-mathematics": [{ day: "mon", period: 2 }],
    "corporate-law-basics": [{ day: "wed", period: 2 }],
    "accounting-introduction": [{ day: "thu", period: 2 }],
    "prototyping-practicum": [
      { day: "thu", period: 3 },
      { day: "thu", period: 4 },
    ],
    "project-introduction": [{ day: "tue", period: 3 }],
    "business-english-practicum-2a": [{ day: "tue", period: 2 }],
    "business-english-practicum-2b": [{ day: "thu", period: 1 }],
  },
  D: {
    "english-core-skills-2": [{ day: "tue", period: 2 }],
    "basic-mathematics": [{ day: "mon", period: 3 }],
    "corporate-law-basics": [{ day: "tue", period: 3 }],
    "accounting-introduction": [{ day: "fri", period: 2 }],
    "prototyping-practicum": [
      { day: "wed", period: 1 },
      { day: "wed", period: 2 },
    ],
    "project-introduction": [{ day: "thu", period: 3 }],
    "business-english-practicum-2a": [{ day: "tue", period: 1 }],
    "business-english-practicum-2b": [{ day: "thu", period: 2 }],
  },
  E: {
    "english-core-skills-2": [{ day: "thu", period: 2 }],
    "basic-mathematics": [{ day: "mon", period: 4 }],
    "corporate-law-basics": [{ day: "thu", period: 3 }],
    "accounting-introduction": [{ day: "wed", period: 1 }],
    "prototyping-practicum": [
      { day: "tue", period: 1 },
      { day: "tue", period: 2 },
    ],
    "project-introduction": [{ day: "thu", period: 4 }],
    "business-english-practicum-2a": [{ day: "mon", period: 3 }],
    "business-english-practicum-2b": [{ day: "fri", period: 3 }],
  },
};
const expectedCandidateSlots: Record<
  TimetableModel,
  Record<string, TimeSlot[]>
> = {
  A: {
    "market-innovation": [{ day: "fri", period: 1 }],
    "operating-systems-intro": [{ day: "fri", period: 4 }],
    "applied-information-mathematics-b": [{ day: "mon", period: 3 }],
    database: [{ day: "thu", period: 4 }],
    "network-technology": [{ day: "thu", period: 1 }],
    "social-research-methods": [{ day: "fri", period: 2 }],
  },
  B: {
    "market-innovation": [{ day: "mon", period: 1 }],
    "operating-systems-intro": [{ day: "fri", period: 4 }],
    "applied-information-mathematics-b": [{ day: "mon", period: 2 }],
    database: [{ day: "thu", period: 4 }],
    "network-technology": [{ day: "tue", period: 1 }],
    "social-research-methods": [{ day: "fri", period: 2 }],
  },
  C: {
    "market-innovation": [{ day: "fri", period: 1 }],
    "operating-systems-intro": [{ day: "fri", period: 4 }],
    "applied-information-mathematics-b": [{ day: "mon", period: 3 }],
    database: [{ day: "mon", period: 1 }],
    "network-technology": [{ day: "tue", period: 1 }],
    "social-research-methods": [{ day: "fri", period: 3 }],
  },
  D: {
    "market-innovation": [{ day: "mon", period: 1 }],
    "operating-systems-intro": [{ day: "fri", period: 4 }],
    "applied-information-mathematics-b": [{ day: "mon", period: 2 }],
    database: [{ day: "thu", period: 4 }],
    "network-technology": [{ day: "thu", period: 1 }],
    "social-research-methods": [{ day: "fri", period: 3 }],
  },
  E: {
    "market-innovation": [{ day: "fri", period: 1 }],
    "operating-systems-intro": [{ day: "fri", period: 4 }],
    "applied-information-mathematics-b": [{ day: "mon", period: 2 }],
    database: [{ day: "mon", period: 1 }],
    "network-technology": [{ day: "thu", period: 1 }],
    "social-research-methods": [{ day: "fri", period: 2 }],
  },
};

function generate(
  model: TimetableModel,
  track: EnglishTrack,
  offerings: readonly CourseOffering[] = courseOfferings,
): GeneratedRequiredTimetable {
  return generateRequiredTimetable({
    timetableModel: model,
    englishTrack: track,
    academicYear: 2026,
    grade: 1,
    semester: "second",
    courses: courseCatalog,
    offerings,
  });
}

function slotsFor(
  generated: GeneratedRequiredTimetable,
  courseId: string,
): TimeSlot[] {
  const generatedCourse = generated.courses.find(
    ({ course }) => course.id === courseId,
  );

  if (!generatedCourse) throw new Error(`Generated course not found: ${courseId}`);
  return generatedCourse.offering.slots;
}

describe("2026年度大学データ", () => {
  it("courseIdが重複していない", () => {
    const courseIds = courses.map((course) => course.id);

    expect(new Set(courseIds).size).toBe(courseIds.length);
  });

  it("CourseOfferingのcourseIdが存在するCourseを参照している", () => {
    const courseIds = new Set(courses.map((course) => course.id));

    for (const offering of timetable) {
      expect(courseIds.has(offering.courseId), offering.id).toBe(true);
    }
  });

  it("graduation requirementのIDが重複していない", () => {
    const requirementIds = graduationRequirements.requirements.map(
      (requirement) => requirement.id,
    );

    expect(new Set(requirementIds).size).toBe(requirementIds.length);
  });

  it("creditsが0以下のCourseがない", () => {
    expect(courses.every((course) => course.credits > 0)).toBe(true);
  });

  it("CourseのrequirementGroupsが定義済み要件を参照している", () => {
    const requirementIds = new Set(
      graduationRequirements.requirements.map((requirement) => requirement.id),
    );

    for (const course of courses) {
      for (const groupId of course.requirementGroups) {
        expect(requirementIds.has(groupId), `${course.id}: ${groupId}`).toBe(true);
      }
    }
  });

  it("Phase 2の前期必修10科目を正式なセットアップデータとして参照する", () => {
    expect(firstSemesterRequiredCourses.map((course) => course.name)).toEqual([
      "イノベーションの志",
      "ビジネス入門",
      "英語コア・スキルズⅠ",
      "スタディスキル",
      "マネジメント（経営学基礎）",
      "マーケティング基礎",
      "ICT入門",
      "プログラミング基礎実習",
      "ビジネス英語実習Ⅰa",
      "ビジネス英語実習Ⅰb",
    ]);
    expect(firstSemesterSetupData.firstSemester.requiredCourses).toHaveLength(
      10,
    );
  });

  it("Phase 3で指定された前期選択必修・選択5科目を参照する", () => {
    expect(
      firstSemesterElectiveCourses.map((course) => ({
        id: course.id,
        name: course.name,
        credits: course.credits,
        requirementType: course.requirementType,
        requirementGroups: course.requirementGroups,
      })),
    ).toEqual([
      {
        id: "computer-architecture",
        name: "コンピュータアーキテクチャ",
        credits: 2,
        requirementType: "required_elective",
        requirementGroups: ["ict-primary"],
      },
      {
        id: "data-structures-and-processing",
        name: "データ構造と処理法",
        credits: 2,
        requirementType: "required_elective",
        requirementGroups: ["ict-primary"],
      },
      {
        id: "applied-information-mathematics-a",
        name: "情報系数学応用A",
        credits: 2,
        requirementType: "required_elective",
        requirementGroups: ["ict-primary"],
      },
      {
        id: "design-introduction",
        name: "デザイン入門",
        credits: 2,
        requirementType: "required_elective",
        requirementGroups: ["ict-primary"],
      },
      {
        id: "esports",
        name: "eスポーツ",
        credits: 2,
        requirementType: "elective",
        requirementGroups: ["modern-society"],
      },
    ]);
  });

  it("CourseOfferingのidが重複していない", () => {
    const offeringIds = courseOfferings.map((offering) => offering.id);
    expect(new Set(offeringIds).size).toBe(offeringIds.length);
  });

  it("Phase 4対象7科目を重複なく参照する", () => {
    expect(candidateCourses.map((course) => course.id)).toEqual(
      coursePlanningData.candidateCourseIds,
    );
    expect(candidateCourses).toHaveLength(7);
    expect(new Set(candidateCourses.map((course) => course.id)).size).toBe(7);
    expect(candidateCourses.every((course) => course.credits > 0)).toBe(true);
    expect(candidateCourses.every((course) => !course.specialCourseType)).toBe(
      true,
    );
  });

  it.each(models)(
    "%sモデルでPhase 4対象7科目のOfferingを解決できる",
    (model) => {
      for (const course of candidateCourses) {
        const offering = resolveCandidateOffering({
          courseId: course.id,
          timetableModel: model,
          academicYear: 2026,
          semester: "second",
          offerings: candidateOfferings,
        });

        expect(offering.courseId).toBe(course.id);
        expect(offering.registrationMethod).toBe("lottery");
      }
    },
  );

  it.each(models)(
    "%sモデルのPhase 4固定枠が指定どおりである",
    (model) => {
      for (const [courseId, slots] of Object.entries(
        expectedCandidateSlots[model],
      )) {
        const offering = resolveCandidateOffering({
          courseId,
          timetableModel: model,
          academicYear: 2026,
          semester: "second",
          offerings: candidateOfferings,
        });

        expect(offering.slots, courseId).toEqual(slots);
      }
    },
  );

  it("インタラクションデザイン入門は水3・火4の独立した候補枠を持つ", () => {
    const offering = resolveCandidateOffering({
      courseId: "interaction-design-intro",
      timetableModel: "A",
      academicYear: 2026,
      semester: "second",
      offerings: candidateOfferings,
    });

    expect(offering.scheduleOptions).toEqual([
      {
        id: "wed3",
        label: "水曜3限",
        slots: [{ day: "wed", period: 3 }],
      },
      {
        id: "tue4",
        label: "火曜4限",
        slots: [{ day: "tue", period: 4 }],
      },
    ]);
  });

  it.each(models)(
    "%sモデルのネットワーク技術は特殊授業形式の注意を持つ",
    (model) => {
      const offering = resolveCandidateOffering({
        courseId: "network-technology",
        timetableModel: model,
        academicYear: 2026,
        semester: "second",
        offerings: candidateOfferings,
      });

      expect(offering.notes).toEqual([
        "対面授業 + VOD形式",
        "初回授業は対面",
      ]);
    },
  );

  it("Phase 4対象Offeringはすべて抽選対象でCourseを参照する", () => {
    const courseIds = new Set(courses.map((course) => course.id));

    expect(candidateOfferings.length).toBeGreaterThan(0);
    for (const offering of candidateOfferings) {
      expect(courseIds.has(offering.courseId), offering.id).toBe(true);
      expect(offering.registrationMethod, offering.id).toBe("lottery");
    }
  });

  it("Phase 4候補のrequirementGroupは卒業要件データに存在する", () => {
    const groupIds = new Set(
      graduationRequirements.requirements.map((requirement) => requirement.id),
    );

    for (const course of candidateCourses) {
      for (const groupId of course.requirementGroups) {
        expect(groupIds.has(groupId), course.id + ": " + groupId).toBe(true);
      }
    }
  });

  it("通常抽選データはPhase 4候補7科目だけを参照する", () => {
    expect(regularLotteryData.courses.map((rule) => rule.courseId)).toEqual(
      candidateCourses.map((course) => course.id),
    );
    expect(regularLotteryData.courses).toHaveLength(7);
    expect(
      regularLotteryData.courses.every((rule) => rule.maxPreferences > 0),
    ).toBe(true);
    expect(
      regularLotteryData.courses.some((rule) =>
        rule.courseId.startsWith("innovation-"),
      ),
    ).toBe(false);
  });

  it("2026年度通常抽選日程はAsia/Tokyo付きISO文字列である", () => {
    expect(regularLotteryData.schedule).toEqual({
      timezone: "Asia/Tokyo",
      applicationStartsAt: "2026-09-15T18:00:00+09:00",
      applicationDeadline: "2026-09-18T23:59:00+09:00",
      resultPublishedAt: "2026-09-21T18:00:00+09:00",
      confirmationStartsAt: "2026-09-21T18:00:00+09:00",
      confirmationDeadline: "2026-09-22T18:00:00+09:00",
    });
  });

  it("特殊科目は通常抽選7科目へ混入せずspecial_lotteryを使用する", () => {
    const regularIds = new Set(
      regularLotteryData.courses.map((item) => item.courseId),
    );
    const specialIds = [
      ...specialCoursesData.innovationLecture.courseIds,
      ...specialCoursesData.innovationMethod.courseIds,
    ];

    expect(specialIds.every((courseId) => !regularIds.has(courseId))).toBe(true);
    expect(specialCoursesData.specialLottery.registrationMethod).toBe(
      "special_lottery",
    );
    expect(specialCoursesData.innovationLecture.registrationMethod).toBe(
      "special_lottery",
    );
    expect(specialCoursesData.innovationMethod.registrationMethod).toBe(
      "special_lottery",
    );
  });

  it("特講2クラスは担当者を持ちschedule未確定である", () => {
    expect(
      specialCoursesData.innovationLecture.classes.map((item) => ({
        instructor: item.instructor,
        schedule: item.schedule,
      })),
    ).toEqual([
      { instructor: "康翰娜", schedule: null },
      { instructor: "髙原幸一郎", schedule: null },
    ]);
  });

  it("2026年度後期の講座系12件を登録し回数を年度データに保持する", () => {
    const miniCourses =
      specialCoursesData.innovationMethod.lecture.miniCourses;
    expect(miniCourses).toHaveLength(12);
    expect(miniCourses.every((course) => course.sessionCount > 0)).toBe(true);
    expect(miniCourses.every((course) => course.academicYear === 2026)).toBe(
      true,
    );
    expect(
      miniCourses.find((course) => course.id === "boga-lms-innovation")?.dates,
    ).toBeNull();
    expect(
      miniCourses.find((course) => course.id === "global-innovator-mindset-2")
        ?.dates,
    ).toContain("2027-01-05");
  });

  it("イベント系は前期継続専用で45時間を年度データに保持する", () => {
    expect(specialCoursesData.innovationMethod.event).toMatchObject({
      newSecondSemesterAvailable: false,
      requiredEstimatedHours: 45,
      events: [
        { id: "iutopia", name: "iUtopia" },
        { id: "blab-marche", name: "BLabマルシェ" },
      ],
    });
  });

  it("特殊科目Correction期間を通常抽選と分離して保持する", () => {
    expect(specialCoursesData.specialLottery.correctionPeriods).toEqual([
      {
        id: "september-correction",
        startsAt: "2026-09-28T10:00:00+09:00",
        endsAt: "2026-09-29T18:00:00+09:00",
      },
      {
        id: "winter-correction",
        startsAt: "2026-11-30T10:00:00+09:00",
        endsAt: "2026-12-07T12:00:00+09:00",
      },
    ]);
  });

  it.each(models)("%s + normalで正しい必修8科目を生成する", (model) => {
    const generated = generate(model, "normal");

    expect(generated.courses.map(({ course }) => course.id)).toEqual(
      requiredCourseIds,
    );
    for (const courseId of requiredCourseIds) {
      expect(slotsFor(generated, courseId)).toEqual(
        expectedNormalSlots[model][courseId],
      );
    }
  });

  it.each(["A", "C", "E"] as const)(
    "%s + advancedで英語3科目をAdvanced枠へ差し替える",
    (model) => {
      const generated = generate(model, "advanced");

      expect(slotsFor(generated, "business-english-practicum-2a")).toEqual([
        { day: "mon", period: 5 },
      ]);
      expect(slotsFor(generated, "business-english-practicum-2b")).toEqual([
        { day: "tue", period: 4 },
      ]);
      expect(slotsFor(generated, "english-core-skills-2")).toEqual([
        { day: "wed", period: 4 },
      ]);
    },
  );

  it.each(models)(
    "%s + advancedでも英語以外5科目はモデル固有枠を維持する",
    (model) => {
      const normal = generate(model, "normal");
      const advanced = generate(model, "advanced");

      for (const courseId of requiredCourseIds) {
        if (!englishCourseIds.has(courseId)) {
          expect(slotsFor(advanced, courseId)).toEqual(
            slotsFor(normal, courseId),
          );
        }
      }
    },
  );

  it.each(models)(
    "%sモデルのプロトタイピング実習は2つのTimeSlotを持つ",
    (model) => {
      expect(slotsFor(generate(model, "normal"), "prototyping-practicum"))
        .toHaveLength(2);
    },
  );

  it("C + advancedの全必修枠が指定どおりである", () => {
    const generated = generate("C", "advanced");

    expect(slotsFor(generated, "basic-mathematics")).toEqual([
      { day: "mon", period: 2 },
    ]);
    expect(slotsFor(generated, "project-introduction")).toEqual([
      { day: "tue", period: 3 },
    ]);
    expect(slotsFor(generated, "corporate-law-basics")).toEqual([
      { day: "wed", period: 2 },
    ]);
    expect(slotsFor(generated, "accounting-introduction")).toEqual([
      { day: "thu", period: 2 },
    ]);
    expect(slotsFor(generated, "prototyping-practicum")).toEqual([
      { day: "thu", period: 3 },
      { day: "thu", period: 4 },
    ]);
    expect(slotsFor(generated, "business-english-practicum-2a")).toEqual([
      { day: "mon", period: 5 },
    ]);
    expect(slotsFor(generated, "business-english-practicum-2b")).toEqual([
      { day: "tue", period: 4 },
    ]);
    expect(slotsFor(generated, "english-core-skills-2")).toEqual([
      { day: "wed", period: 4 },
    ]);
  });

  it.each(["A", "B", "C"] as const)(
    "%sモデルのプロジェクト入門は11月7日の特殊日程を持つ",
    (model) => {
      const generated = generate(model, "normal");
      const project = generated.courses.find(
        ({ course }) => course.id === "project-introduction",
      );

      expect(project?.offering.scheduleExceptions).toContainEqual(
        expect.objectContaining({
          type: "special_date",
          startDate: "2026-11-07",
          endDate: "2026-11-07",
        }),
      );
    },
  );

  it.each(["D", "E"] as const)(
    "%sモデルのプロジェクト入門は11月8日の特殊日程を持つ",
    (model) => {
      const generated = generate(model, "normal");
      const project = generated.courses.find(
        ({ course }) => course.id === "project-introduction",
      );

      expect(project?.offering.scheduleExceptions).toContainEqual(
        expect.objectContaining({
          type: "special_date",
          startDate: "2026-11-08",
          endDate: "2026-11-08",
        }),
      );
    },
  );

  it.each(models)(
    "%sモデルのプロジェクト入門は11月30日〜2月1日の変則日程を持つ",
    (model) => {
      const generated = generate(model, "normal");
      const project = generated.courses.find(
        ({ course }) => course.id === "project-introduction",
      );

      expect(project?.offering.scheduleExceptions).toContainEqual(
        expect.objectContaining({
          type: "variable_schedule",
          startDate: "2026-11-30",
          endDate: "2027-02-01",
        }),
      );
    },
  );

  it("必要なOfferingを削ると明確なエラーになる", () => {
    const withoutMathematicsA = courseOfferings.filter(
      (offering) =>
        !(
          offering.courseId === "basic-mathematics" && offering.model === "A"
        ),
    );

    expect(() => generate("A", "normal", withoutMathematicsA)).toThrow(
      "Required offering not found: basic-mathematics (A/normal)",
    );
  });

  it.each(models.flatMap((model) => tracks.map((track) => [model, track] as const)))(
    "%s + %sは必修8科目・合計14単位になる",
    (model, track) => {
      const generated = generate(model, track);
      expect(generated.courses).toHaveLength(8);
      expect(generated.totalCredits).toBe(14);
    },
  );
});
