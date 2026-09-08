import type { LotteryData } from "../../domain/lottery";
import { candidateCourses } from "./coursePlanning";
import lotteryJson from "./lottery.json";

export const regularLotteryData = lotteryJson as LotteryData;

const candidateCourseIds = new Set(candidateCourses.map((course) => course.id));

for (const rule of regularLotteryData.courses) {
  if (!candidateCourseIds.has(rule.courseId)) {
    throw new Error(
      "Regular lottery course is not a Phase 4 candidate: " + rule.courseId,
    );
  }
}
