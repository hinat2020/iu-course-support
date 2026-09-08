import type { ScheduleOptionsEvaluation } from "./coursePlanning";
import type { CourseOffering } from "./timetable";

export type LotteryApplicationStatus = "not_applied" | "applied";

export type LotteryResultStatus = "pending" | "won" | "lost";

export type RegistrationConfirmationStatus = "unconfirmed" | "confirmed";

export type LotteryPreference = {
  offeringId: string;
  scheduleOptionId?: string | null;
  rank: number;
};

export type LotteryApplication = {
  courseId: string;
  applicationStatus: LotteryApplicationStatus;
  preferences: LotteryPreference[];
  resultStatus: LotteryResultStatus | null;
  wonOfferingId: string | null;
  wonScheduleOptionId: string | null;
  registrationConfirmation: RegistrationConfirmationStatus;
};

export type LotterySchedule = {
  timezone: "Asia/Tokyo";
  applicationStartsAt: string;
  applicationDeadline: string;
  resultPublishedAt: string;
  confirmationStartsAt: string;
  confirmationDeadline: string;
};

export type LotteryCourseRule = {
  courseId: string;
  maxPreferences: number;
};

export type LotteryData = {
  academicYear: 2026;
  semester: "second";
  schedule: LotterySchedule;
  courses: LotteryCourseRule[];
};

export type LotteryPhase =
  | "before_application"
  | "application_open"
  | "waiting_for_result"
  | "result_available"
  | "confirmation_period"
  | "finished";

export type LotteryValidationIssueCode =
  | "result_without_application"
  | "confirmation_without_application"
  | "preferences_required"
  | "offering_mismatch"
  | "schedule_option_required"
  | "schedule_option_unknown"
  | "duplicate_schedule_option"
  | "duplicate_rank"
  | "schedule_option_unavailable"
  | "won_offering_required"
  | "won_offering_mismatch"
  | "won_schedule_option_required"
  | "won_option_not_preferred"
  | "won_option_unavailable"
  | "lost_has_won_offering"
  | "non_won_has_won_offering"
  | "confirmation_without_win";

export type LotteryValidationIssue = {
  code: LotteryValidationIssueCode;
  message: string;
  scheduleOptionId?: string;
};

export type ValidateLotteryApplicationInput = {
  application: LotteryApplication;
  offering: CourseOffering;
  scheduleEvaluation: ScheduleOptionsEvaluation;
};

export function createEmptyLotteryApplication(
  courseId: string,
): LotteryApplication {
  return {
    courseId,
    applicationStatus: "not_applied",
    preferences: [],
    resultStatus: null,
    wonOfferingId: null,
    wonScheduleOptionId: null,
    registrationConfirmation: "unconfirmed",
  };
}

export function normalizeLotteryPreferences(
  preferences: readonly LotteryPreference[],
): LotteryPreference[] {
  const ranks = new Set<number>();
  const scheduleOptions = new Set<string>();

  return [...preferences]
    .filter((preference) => {
      if (!Number.isInteger(preference.rank) || preference.rank < 1) {
        return false;
      }
      if (ranks.has(preference.rank)) return false;

      const optionId = preference.scheduleOptionId;
      if (optionId && scheduleOptions.has(optionId)) return false;

      ranks.add(preference.rank);
      if (optionId) scheduleOptions.add(optionId);
      return true;
    })
    .sort((left, right) => left.rank - right.rank)
    .map((preference) => ({ ...preference }));
}

export function hasLotteryActivity(
  application: LotteryApplication | undefined,
): boolean {
  return (
    application?.applicationStatus === "applied" ||
    application?.resultStatus !== null
  );
}

export function getLotteryStatusLabel(
  application: LotteryApplication | undefined,
): string {
  if (!application || application.applicationStatus === "not_applied") {
    return "抽選 未申込";
  }
  if (application.resultStatus === "won") {
    return application.registrationConfirmation === "confirmed"
      ? "当選・UNIPA確認済み"
      : "当選・UNIPA未確認";
  }
  if (application.resultStatus === "lost") return "落選";
  return "抽選 申込済み";
}

function toTimestamp(value: Date | string): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error("Invalid lottery date: " + String(value));
  }

  return timestamp;
}

export function getLotteryPhase(
  now: Date | string,
  schedule: LotterySchedule,
): LotteryPhase {
  const current = toTimestamp(now);
  const applicationStartsAt = toTimestamp(schedule.applicationStartsAt);
  const applicationDeadline = toTimestamp(schedule.applicationDeadline);
  const resultPublishedAt = toTimestamp(schedule.resultPublishedAt);
  const confirmationStartsAt = toTimestamp(schedule.confirmationStartsAt);
  const confirmationDeadline = toTimestamp(schedule.confirmationDeadline);

  if (current < applicationStartsAt) return "before_application";
  if (current <= applicationDeadline) return "application_open";
  if (current < resultPublishedAt) return "waiting_for_result";
  if (current < confirmationStartsAt) return "result_available";
  if (current <= confirmationDeadline) return "confirmation_period";
  return "finished";
}

export function formatLotteryDateTime(
  value: string,
  timeZone: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid lottery date: " + value);
  }

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return (
    part("month") +
    "月" +
    part("day") +
    "日 " +
    part("hour") +
    ":" +
    part("minute")
  );
}

export function getLotteryPhaseLabel(phase: LotteryPhase): string {
  const labels: Record<LotteryPhase, string> = {
    before_application: "申込開始前",
    application_open: "申込期間中",
    waiting_for_result: "抽選結果待ち",
    result_available: "結果公開済み",
    confirmation_period: "履修登録内容の確認期間",
    finished: "確認期間終了",
  };

  return labels[phase];
}

function countValues(values: readonly (string | number)[]) {
  const counts = new Map<string | number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function validateLotteryApplication({
  application,
  offering,
  scheduleEvaluation,
}: ValidateLotteryApplicationInput): LotteryValidationIssue[] {
  const issues: LotteryValidationIssue[] = [];
  const scheduleOptions = offering.scheduleOptions ?? [];
  const requiresScheduleOption = scheduleOptions.length > 0;
  const optionIds = new Set(scheduleOptions.map((option) => option.id));
  const conflictingOptionIds = new Set(
    scheduleEvaluation.conflictingOptions,
  );
  const selectedOptionIds = application.preferences
    .map((preference) => preference.scheduleOptionId)
    .filter((value): value is string => typeof value === "string");

  if (
    application.applicationStatus === "not_applied" &&
    application.resultStatus !== null
  ) {
    issues.push({
      code: "result_without_application",
      message: "未申込の科目に抽選結果が残っています。抽選内容を確認してください。",
    });
  }

  if (
    application.applicationStatus === "not_applied" &&
    application.registrationConfirmation === "confirmed"
  ) {
    issues.push({
      code: "confirmation_without_application",
      message: "未申込の科目にUNIPA確認済みの記録が残っています。",
    });
  }

  if (
    application.applicationStatus === "applied" &&
    application.preferences.length === 0
  ) {
    issues.push({
      code: "preferences_required",
      message: requiresScheduleOption
        ? "申込済みですが希望枠が登録されていません。"
        : "申込済みですが対象の開講情報が登録されていません。",
    });
  }

  for (const [rank, count] of countValues(
    application.preferences.map((preference) => preference.rank),
  )) {
    if (count > 1) {
      issues.push({
        code: "duplicate_rank",
        message: "第" + rank + "希望が重複しています。",
      });
    }
  }

  for (const [optionId, count] of countValues(selectedOptionIds)) {
    if (count > 1) {
      issues.push({
        code: "duplicate_schedule_option",
        message: "同じ授業枠を複数の希望順位へ登録できません。",
        scheduleOptionId: String(optionId),
      });
    }
  }

  for (const preference of application.preferences) {
    if (preference.offeringId !== offering.id) {
      issues.push({
        code: "offering_mismatch",
        message: "保存済みの希望が現在の開講情報と一致しません。",
        scheduleOptionId: preference.scheduleOptionId ?? undefined,
      });
    }

    if (!requiresScheduleOption) continue;

    if (!preference.scheduleOptionId) {
      issues.push({
        code: "schedule_option_required",
        message: "希望順位には授業枠の選択が必要です。",
      });
      continue;
    }

    if (!optionIds.has(preference.scheduleOptionId)) {
      issues.push({
        code: "schedule_option_unknown",
        message: "保存済みの希望枠が現在の開講情報にありません。",
        scheduleOptionId: preference.scheduleOptionId,
      });
    } else if (conflictingOptionIds.has(preference.scheduleOptionId)) {
      issues.push({
        code: "schedule_option_unavailable",
        message:
          "保存済みの抽選希望枠が現在の設定では利用できません。抽選内容を確認してください。",
        scheduleOptionId: preference.scheduleOptionId,
      });
    }
  }

  if (application.resultStatus === "won") {
    if (!application.wonOfferingId) {
      issues.push({
        code: "won_offering_required",
        message: "当選した開講情報が設定されていません。",
      });
    } else if (application.wonOfferingId !== offering.id) {
      issues.push({
        code: "won_offering_mismatch",
        message: "当選した開講情報が現在の科目と一致しません。",
      });
    }

    if (requiresScheduleOption) {
      const wonOptionId = application.wonScheduleOptionId;
      if (!wonOptionId) {
        issues.push({
          code: "won_schedule_option_required",
          message: "当選した授業枠を選択してください。",
        });
      } else {
        if (!selectedOptionIds.includes(wonOptionId)) {
          issues.push({
            code: "won_option_not_preferred",
            message: "希望していない授業枠を当選枠にはできません。",
            scheduleOptionId: wonOptionId,
          });
        }
        if (conflictingOptionIds.has(wonOptionId)) {
          issues.push({
            code: "won_option_unavailable",
            message: "当選枠が現在の必修時間割と重複しています。",
            scheduleOptionId: wonOptionId,
          });
        }
      }
    }
  }

  if (
    application.resultStatus === "lost" &&
    (application.wonOfferingId !== null ||
      application.wonScheduleOptionId !== null)
  ) {
    issues.push({
      code: "lost_has_won_offering",
      message: "落選状態に古い当選枠が残っています。",
    });
  } else if (
    application.resultStatus !== "won" &&
    (application.wonOfferingId !== null ||
      application.wonScheduleOptionId !== null)
  ) {
    issues.push({
      code: "non_won_has_won_offering",
      message: "当選以外の状態に古い当選枠が残っています。",
    });
  }

  if (
    application.registrationConfirmation === "confirmed" &&
    application.resultStatus !== "won"
  ) {
    issues.push({
      code: "confirmation_without_win",
      message: "当選科目以外はUNIPA最終確認の対象にできません。",
    });
  }

  return issues;
}
