import { describe, expect, it } from "vitest";
import { curriculumCourses, curriculumData } from "../data/2026/curriculum";
import courseMaster from "../data/2026/courses.json";

const byId = new Map(curriculumCourses.map((course) => [course.courseId, course]));

describe("Phase 11A official curriculum data", () => {
  it("has 112 unique course IDs and official course names", () => {
    expect(curriculumCourses).toHaveLength(112);
    expect(new Set(curriculumCourses.map((course) => course.courseId)).size).toBe(112);
    expect(new Set(curriculumCourses.map((course) => course.name)).size).toBe(112);
  });

  it("records the 2026 handbook as the source of every course row", () => {
    expect(curriculumData.metadata.academicYear).toBe(2026);
    expect(curriculumData.metadata.applicableAdmissionYears).toBe("2025年度以降入学者");
    expect(curriculumData.metadata.documentName).toBe("02_2026年度学生便覧.pdf");
    for (const course of curriculumCourses) {
      expect(course.sourcePage).toBeGreaterThanOrEqual(30);
      expect(course.sourcePage).toBeLessThanOrEqual(35);
    }
  });

  it("has nonnegative credits and only officially allocated years and semesters", () => {
    for (const course of curriculumCourses) {
      expect(course.credits).toBeGreaterThanOrEqual(0);
      expect(course.recommendedYears.length).toBeGreaterThan(0);
      expect(course.recommendedYears.every((year) => year >= 1 && year <= 4)).toBe(true);
      expect(course.availableSemesters.length).toBeGreaterThan(0);
      expect(course.availableSemesters.every((term) => term === "spring" || term === "fall")).toBe(true);
    }
    expect([1, 2, 3, 4].map((year) =>
      curriculumCourses.filter((course) => course.recommendedYears[0] === year).length,
    )).toEqual([34, 40, 19, 19]);
  });

  it("uses only the seven official requirement symbols", () => {
    const symbols = ["◆", "▲", "■", "□", "◎", "★", "☆"] as const;
    const allowed = new Set<string>(symbols);
    expect(curriculumCourses.every((course) =>
      course.requirementGroups.every((symbol) => allowed.has(symbol)),
    )).toBe(true);
    expect(Object.fromEntries(symbols.map((symbol) => [
      symbol,
      curriculumCourses.filter((course) => course.requirementGroups.includes(symbol)).length,
    ]))).toEqual({ "◆": 4, "▲": 16, "■": 30, "□": 3, "◎": 7, "★": 6, "☆": 4 });
    expect(curriculumCourses.filter((course) => course.requirementType === "required")).toHaveLength(36);
    expect(curriculumCourses.filter((course) => course.requirementType === "required_elective")).toHaveLength(70);
    expect(curriculumCourses.filter((course) => course.requirementType === "elective")).toHaveLength(6);
  });

  it("keeps every prerequisite reference within the curriculum", () => {
    const prerequisites = curriculumCourses.filter((course) => course.prerequisites.length > 0);
    expect(prerequisites).toHaveLength(8);
    for (const course of prerequisites) {
      expect(course.prerequisites.every((prerequisite) => byId.has(prerequisite))).toBe(true);
    }
    expect(Object.fromEntries(prerequisites.map((course) => [
      course.courseId, course.prerequisites,
    ]))).toEqual({
      "basic-project-1": ["project-introduction"],
      "basic-project-2": ["basic-project-1"],
      "pre-internship-guidance": ["business-introduction", "ict-introduction"],
      "clinical-internship": ["pre-internship-guidance"],
      "post-internship-guidance": ["clinical-internship"],
      "project-practice-seminar-1": ["basic-project-2"],
      "project-practice-seminar-2": ["project-practice-seminar-1"],
      "project-practice-seminar-3": ["project-practice-seminar-2"],
    });
  });

  it("reuses all existing course master IDs rather than creating duplicates", () => {
    expect(courseMaster).toHaveLength(34);
    for (const course of courseMaster) {
      expect(byId.has(course.id)).toBe(true);
    }
  });

  it("keeps the four special a/b courses out of the standard planning catalog", () => {
    const special = curriculumCourses.filter((course) => course.planningAvailability === "managed_elsewhere");
    expect(special.map((course) => course.courseId).sort()).toEqual([
      "innovation-lecture-a", "innovation-lecture-b",
      "innovation-method-a", "innovation-method-b",
    ]);
  });
});
