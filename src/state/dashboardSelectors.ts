import {
  candidateCourses,
  candidateOfferings,
  graduationRequirements,
  registrationRules,
} from "../data/2026/coursePlanning";
import { regularLotteryData } from "../data/2026/lottery";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { specialCoursesData } from "../data/2026/specialCourses";
import { calculateCap, type CapResult } from "../domain/cap";
import type { Course } from "../domain/course";
import {
  evaluateCandidateCourse,
  getOfferingSlots,
  type CandidateCourseDecision,
  type ScheduledCourse,
} from "../domain/coursePlanning";
import {
  calculateInnovationMethodLectureProgress,
  getInnovationCreditLabel,
  getInnovationMethodEnrollmentMode,
} from "../domain/innovation";
import { validateLotteryApplication } from "../domain/lottery";
import { buildLotteryCourseContexts } from "../domain/lotteryPlanning";
import {
  calculateRequirementProgress,
  type RequirementProgress,
} from "../domain/requirements";
import {
  generateRequiredTimetable,
  type GeneratedRequiredTimetable,
} from "../domain/requiredTimetable";
import type { AppState } from "./initialState";

export type HomeTaskSeverity = "info" | "warning" | "important";

export type HomeTask = {
  id: string;
  title: string;
  description?: string;
  href: string;
  severity: HomeTaskSeverity;
};

export type AppWarning = {
  id: string;
  code: string;
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  href?: string;
};

export type LotterySummaryCounts = {
  notApplied: number;
  applied: number;
  pending: number;
  won: number;
  lost: number;
  unconfirmed: number;
};

export type SpecialCourseSummary = {
  lecture: string;
  method: string;
};

export type DashboardSummary = {
  tasks: HomeTask[];
  warnings: AppWarning[];
  cap: CapResult | null;
  requiredTimetable: GeneratedRequiredTimetable | null;
  selectedCandidates: Course[];
  candidateTotal: number;
  candidateConflictCount: number;
  candidateDecisions: Record<string, CandidateCourseDecision>;
  lottery: LotterySummaryCounts;
  requirements: RequirementProgress[];
  special: SpecialCourseSummary;
};

export type FinalReviewSummary = DashboardSummary & {
  normalLottery: {
    won: Course[];
    confirmed: Course[];
    unconfirmed: Course[];
    lost: Course[];
    pending: Course[];
    notApplied: Course[];
  };
};

const firstSemesterCourses = [
  ...firstSemesterRequiredCourses,
  ...firstSemesterElectiveCourses,
];

export function getRootDestination(setupCompleted: boolean): "/home" | null {
  return setupCompleted ? "/home" : null;
}

function summarizeInnovationLecture(state: AppState): string {
  const lecture = state.innovationLecture;
  const next = getInnovationCreditLabel(lecture.previousEarnedCount);
  if (next === "completed") return "a/b修得済み";
  if (lecture.resultStatus === "won") {
    return lecture.registrationConfirmation === "confirmed"
      ? `特講${next} 当選・UNIPA確認済み`
      : `特講${next} 当選・UNIPA未確認`;
  }
  if (lecture.resultStatus === "lost") return `特講${next} 落選`;
  if (lecture.applicationStatus === "applied") return `特講${next} 結果待ち`;
  return `次は特講${next}・未申込`;
}

function summarizeInnovationMethod(state: AppState): string {
  const first = state.firstSemester.innovationMethod;
  const mode = getInnovationMethodEnrollmentMode(
    first.registeredInFirstSemester,
  );
  const next = getInnovationCreditLabel(
    state.innovationMethod.previousEarnedCount,
  );
  if (next === "completed") return "a/b修得済み";
  if (mode === "needs_confirmation") return "前期登録状況を要確認";
  if (mode === "new_second_semester") {
    const application = state.innovationMethod.newLectureApplication;
    if (application.resultStatus === "won") {
      return application.registrationConfirmation === "confirmed"
        ? "後期講座系 当選・UNIPA確認済み"
        : "後期講座系 当選・UNIPA未確認";
    }
    if (application.resultStatus === "lost") return "後期講座系 落選";
    return application.applicationStatus === "applied"
      ? "後期講座系 結果待ち"
      : "後期講座系 新規申込";
  }
  if (first.moduleType === "event") {
    const hours = state.innovationMethod.eventModule.estimatedHours;
    return `前期から継続・イベント系${hours === undefined ? "" : ` ${hours}時間（参考）`}`;
  }
  if (first.moduleType !== "lecture") return "前期モジュールを要確認";

  const progress = calculateInnovationMethodLectureProgress({
    academicYear: specialCoursesData.academicYear,
    targetCredit: next,
    records: state.innovationMethod.lectureModule.miniCourses,
    miniCourses: specialCoursesData.innovationMethod.lecture.miniCourses,
    requiredSessionCount:
      specialCoursesData.innovationMethod.lecture.requiredPassedSessionCount,
  });
  return `前期から継続・合格した講座 ${progress.passedSessionCount} / ${progress.requiredSessionCount}回`;
}

function addTask(tasks: HomeTask[], task: HomeTask) {
  if (!tasks.some((item) => item.id === task.id)) tasks.push(task);
}

export function selectDashboardSummary(state: AppState): DashboardSummary {
  const tasks: HomeTask[] = [];
  const requirements = calculateRequirementProgress({
    firstSemester: state.firstSemester,
    firstSemesterCourses,
    requirements: graduationRequirements.requirements,
  });
  const special = {
    lecture: summarizeInnovationLecture(state),
    method: summarizeInnovationMethod(state),
  };
  const emptyLottery: LotterySummaryCounts = {
    notApplied: 0,
    applied: 0,
    pending: 0,
    won: 0,
    lost: 0,
    unconfirmed: 0,
  };

  const hasUnknownFirstSemester = firstSemesterCourses.some((course) => {
    const record = state.firstSemester.courses[course.id];
    return !record || !record.confirmedByUser || record.status === "unknown";
  });
  if (hasUnknownFirstSemester) {
    addTask(tasks, {
      id: "first-semester-unknown",
      title: "前期履修状況を確認してください",
      description: "未回答または「わからない」の科目があります。",
      href: "/settings",
      severity: "important",
    });
  }
  if (state.firstSemester.innovationMethod.registeredInFirstSemester === "unknown") {
    addTask(tasks, {
      id: "innovation-method-registration-unknown",
      title: "イノベーション技法の前期登録状況を確認してください",
      href: "/setup/innovation-method",
      severity: "important",
    });
  }
  if (
    state.innovationLecture.resultStatus === "won" &&
    state.innovationLecture.registrationConfirmation === "unconfirmed"
  ) {
    addTask(tasks, {
      id: "innovation-lecture-unconfirmed",
      title: "イノベーション特講の履修登録を確認してください",
      href: "/special/innovation-lecture",
      severity: "important",
    });
  }

  const { timetableModel, englishTrack } = state.user;
  if (timetableModel === null || englishTrack === null) {
    addTask(tasks, {
      id: "basic-setup-missing",
      title: "基本設定を確認してください",
      description: "時間割モデルと英語トラックの設定が必要です。",
      href: "/setup",
      severity: "important",
    });
    return {
      tasks,
      warnings: tasks.map(taskToWarning),
      cap: null,
      requiredTimetable: null,
      selectedCandidates: [],
      candidateTotal: candidateCourses.length,
      candidateConflictCount: 0,
      candidateDecisions: {},
      lottery: emptyLottery,
      requirements,
      special,
    };
  }

  const requiredTimetable = generateRequiredTimetable({
    timetableModel,
    englishTrack,
    academicYear: state.user.academicYear,
    grade: state.user.grade,
    semester: state.user.semester,
    courses: courseCatalog,
    offerings: courseOfferings,
  });
  const selectedCandidates = candidateCourses.filter(
    (course) => state.plannedCourses[course.id]?.selected === true,
  );
  const wonCandidates = selectedCandidates.filter(
    (course) => {
      const application = state.lotteries[course.id];
      return (
        application?.applicationStatus === "applied" &&
        application.resultStatus === "won"
      );
    },
  );
  const cap = calculateCap({
    firstSemester: state.firstSemester,
    firstSemesterCourses,
    requiredSecondSemesterCourses: requiredTimetable.courses.map(
      ({ course }) => course,
    ),
    selectedCandidateCourses: selectedCandidates,
    wonCandidateCourses: wonCandidates,
    capLimit: registrationRules.annualCap,
  });
  const requiredSchedules: ScheduledCourse[] = requiredTimetable.courses.map(
    ({ course, offering }) => ({
      courseId: course.id,
      courseName: course.name,
      slots: offering.slots,
    }),
  );
  const contexts = buildLotteryCourseContexts({
    courses: selectedCandidates,
    offerings: candidateOfferings,
    requiredCourses: requiredTimetable.courses,
    timetableModel,
    academicYear: state.user.academicYear,
    semester: state.user.semester,
  });
  const contextByCourseId = new Map(
    contexts.map((context) => [context.course.id, context]),
  );
  const candidateDecisions: Record<string, CandidateCourseDecision> = {};

  for (const context of contexts) {
    const otherSelected: ScheduledCourse[] = contexts
      .filter((item) => item.course.id !== context.course.id)
      .map((item) => ({
        courseId: item.course.id,
        courseName: item.course.name,
        slots: getOfferingSlots(item.offering),
      }));
    candidateDecisions[context.course.id] = evaluateCandidateCourse({
      course: context.course,
      offering: context.offering,
      existingCourses: [...requiredSchedules, ...otherSelected],
      cap,
      requirementProgress: requirements,
      isSelected: true,
    });
  }

  const lottery = { ...emptyLottery };
  let hasLotteryValidationIssue = false;
  for (const course of selectedCandidates) {
    const application = state.lotteries[course.id];
    const context = contextByCourseId.get(course.id);
    if (
      application &&
      context &&
      validateLotteryApplication({
        application,
        offering: context.offering,
        scheduleEvaluation: context.scheduleEvaluation,
      }).length > 0
    ) {
      hasLotteryValidationIssue = true;
    }

    if (!application || application.applicationStatus === "not_applied") {
      lottery.notApplied += 1;
      continue;
    }
    lottery.applied += 1;
    if (application.resultStatus === "pending") lottery.pending += 1;
    if (application.resultStatus === "won") {
      lottery.won += 1;
      if (application.registrationConfirmation === "unconfirmed") {
        lottery.unconfirmed += 1;
      }
    }
    if (application.resultStatus === "lost") lottery.lost += 1;

  }

  if (lottery.notApplied > 0) {
    addTask(tasks, {
      id: "lottery-not-applied",
      title: "抽選申込状況を確認してください",
      description: `履修候補のうち${lottery.notApplied}科目が未申込です。`,
      href: "/lottery",
      severity: "important",
    });
  }
  if (lottery.pending > 0) {
    addTask(tasks, {
      id: "lottery-pending",
      title: "抽選結果を確認してください",
      description: `${lottery.pending}科目が結果待ちです。`,
      href: "/lottery/results",
      severity: "important",
    });
  }
  if (lottery.unconfirmed > 0) {
    addTask(tasks, {
      id: "lottery-unipa-unconfirmed",
      title: "UNIPAの履修登録内容を確認してください",
      description: `当選した${lottery.unconfirmed}科目が未確認です。`,
      href: "/lottery/results",
      severity: "important",
    });
  }
  if (hasLotteryValidationIssue) {
    addTask(tasks, {
      id: "lottery-validation",
      title: "抽選希望枠を再確認してください",
      description: "保存済みの抽選内容が現在の設定と一致していません。",
      href: "/lottery",
      severity: "important",
    });
  }
  if (cap.exceeded === true) {
    addTask(tasks, {
      id: "cap-exceeded",
      title: "年間履修上限を超える可能性があります",
      description: `全候補を含めると${cap.maximumAnnualCredits} / ${cap.limit}単位です。`,
      href: "/plan",
      severity: "important",
    });
  }

  const candidateConflictCount = Object.values(candidateDecisions).filter(
    (decision) => decision.timetable.hasAnyConflict,
  ).length;
  if (candidateConflictCount > 0) {
    addTask(tasks, {
      id: "candidate-conflicts",
      title: "履修候補の時間割重複を確認してください",
      description: `${candidateConflictCount}科目に重複または利用できない枠があります。`,
      href: "/plan",
      severity: "warning",
    });
  }

  const warnings = tasks.map(taskToWarning);
  warnings.push(
    {
      id: "special-cap-unconfirmed",
      code: "SPECIAL_CAP_UNCONFIRMED",
      severity: "info",
      title: "特殊科目のCAP上の扱いは未確定です",
      message: "イノベーション特講・技法は現在のCAPへ自動加算していません。公式資料を確認してください。",
      href: "/special",
    },
    {
      id: "official-final-check",
      code: "OFFICIAL_FINAL_CHECK_REQUIRED",
      severity: "info",
      title: "最終確認は公式情報で行ってください",
      message: "このアプリはUNIPAへ接続せず、履修登録完了を自動判定しません。",
      href: "/review",
    },
  );

  return {
    tasks,
    warnings,
    cap,
    requiredTimetable,
    selectedCandidates,
    candidateTotal: candidateCourses.length,
    candidateConflictCount,
    candidateDecisions,
    lottery,
    requirements,
    special,
  };
}

function taskToWarning(task: HomeTask): AppWarning {
  return {
    id: task.id,
    code: task.id.toUpperCase().replaceAll("-", "_"),
    severity:
      task.severity === "important"
        ? "error"
        : task.severity === "warning"
          ? "warning"
          : "info",
    title: task.title,
    message: task.description ?? task.title,
    href: task.href,
  };
}

export function selectHomeTasks(state: AppState): HomeTask[] {
  return selectDashboardSummary(state).tasks;
}

export function selectAppWarnings(state: AppState): AppWarning[] {
  return selectDashboardSummary(state).warnings;
}

export function selectFinalReviewSummary(state: AppState): FinalReviewSummary {
  const dashboard = selectDashboardSummary(state);
  const normalLottery = {
    won: [] as Course[],
    confirmed: [] as Course[],
    unconfirmed: [] as Course[],
    lost: [] as Course[],
    pending: [] as Course[],
    notApplied: [] as Course[],
  };

  for (const course of dashboard.selectedCandidates) {
    const application = state.lotteries[course.id];
    if (!application || application.applicationStatus === "not_applied") {
      normalLottery.notApplied.push(course);
    } else if (application.resultStatus === "won") {
      normalLottery.won.push(course);
      if (application.registrationConfirmation === "confirmed") {
        normalLottery.confirmed.push(course);
      } else {
        normalLottery.unconfirmed.push(course);
      }
    } else if (application.resultStatus === "lost") {
      normalLottery.lost.push(course);
    } else {
      normalLottery.pending.push(course);
    }
  }

  return { ...dashboard, normalLottery };
}

export { regularLotteryData };
