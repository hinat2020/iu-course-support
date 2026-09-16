import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { courseCatalog } from "../data/2026/requiredTimetable";
import { curriculumCourses } from "../data/2026/curriculum";
import {
  getPlacementWarnings,
  graduationSemesters,
  type CurriculumRequirementSymbol,
  type CurriculumRequirementType,
  type CurriculumSemester,
  type GraduationCourseStatus,
  type GraduationSemesterId,
} from "../domain/graduationPlanning";
import type {
  PrerequisiteCheckResult,
  PrerequisiteRequirementStatus,
} from "../domain/graduationPrerequisites";
import type {
  GraduationCapStatus,
  GraduationYearCapResult,
} from "../domain/graduationCap";
import type {
  CreditRequirementProgress,
  RequirementProgressStatus,
} from "../domain/graduationRequirements";
import {
  getCandidateConstraintSummary,
  isTotalOnlyCandidateSearchAvailable,
  type CandidatePlacementPreview,
  type GraduationCourseCandidate,
} from "../domain/graduationCandidates";
import {
  graduationPlanCheckCategoryLabels,
  type GraduationPlanCheck,
  type GraduationPlanCheckSummary,
} from "../domain/graduationPlanChecks";
import {
  selectGraduationBoard,
  selectGraduationCapPlan,
  selectGraduationCandidateSituations,
  selectGraduationCandidatesForRequirement,
  selectGraduationCandidatePreview,
  selectGraduationCreditSummary,
  selectGraduationPrerequisiteChecks,
  selectGraduationPlanChecks,
  selectProspectiveGraduationCap,
  selectProspectivePrerequisiteCheck,
  selectGraduationRequirementProgress,
  selectGraduationRequirementShortfalls,
  selectGraduationSpecialSummary,
  selectSupersededGraduationPlanEntries,
  selectUnplacedCurriculumCourses,
  selectUnresolvedRequiredCourses,
  type GraduationCandidateStatus,
} from "../state/graduationSelectors";
import { useAppState } from "../state/useAppState";

const requirementSymbols: readonly CurriculumRequirementSymbol[] = [
  "◆",
  "▲",
  "■",
  "□",
  "◎",
  "★",
  "☆",
];

const requirementTypes: readonly {
  value: CurriculumRequirementType;
  label: string;
}[] = [
  { value: "required_elective", label: "選択必修" },
  { value: "elective", label: "選択" },
];

const statusLabels: Record<GraduationCourseStatus, string> = {
  earned: "✓ 修得済み",
  in_progress: "● 履修中",
  planned: "○ 履修予定",
};

const candidateStatusLabels: Record<GraduationCandidateStatus, string> = {
  considering: "履修候補として検討中",
  applied: "抽選応募済み（結果未入力）",
  pending: "抽選結果待ち",
  lost: "落選・今学期対象外",
  won_unconfirmed: "当選・UNIPA最終確認未完了",
  won_confirmed: "当選・UNIPA確認済み（今学期対象）",
  needs_confirmation: "抽選記録を再確認",
};

const capStatusLabels: Record<GraduationCapStatus, string> = {
  within_limit: "✓ 上限内",
  at_limit: "○ 上限ちょうど",
  over_limit: "⚠ 上限超過",
  unknown: "? 判定できません",
};

const requirementStatusLabels: Record<RequirementProgressStatus, string> = {
  satisfied: "✓ 達成",
  projected_satisfied: "○ 計画上到達",
  shortfall: "⚠ 計画上も不足",
  unknown: "? 判定保留",
};

const courseMasterIds = new Set(courseCatalog.map((course) => course.id));

const prerequisiteStatusLabels: Record<
  PrerequisiteRequirementStatus,
  string
> = {
  earned: "修得済み",
  planned_before: "前の学期に履修予定",
  current_unconfirmed: "現在履修対象です。単位修得はまだ確定していません",
  planned_same_semester: "同じ学期に配置されています",
  planned_after: "後の学期に配置されています",
  missing: "まだ前の学期にありません",
};

function PrerequisiteDetails({ result }: { result: PrerequisiteCheckResult }) {
  if (result.status === "not_applicable") return null;
  const isSatisfied = result.status === "satisfied";
  return (
    <details className={`graduation-prerequisite graduation-prerequisite--${isSatisfied ? "satisfied" : "warning"}`}>
      <summary>{isSatisfied ? "✓ 前提科目OK" : "⚠ 前提科目を確認"}</summary>
      <p>前提科目:</p>
      <ul>
        {result.requirements.map((requirement) => {
          const requirementSatisfied =
            requirement.status === "earned" ||
            requirement.status === "planned_before";
          return (
            <li key={requirement.prerequisiteCourseId}>
              <strong>{requirementSatisfied ? "✓" : "⚠"} {requirement.prerequisiteCourseName}</strong>
              <span> — {prerequisiteStatusLabels[requirement.status]}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function CapResultCard({ result }: { result: GraduationYearCapResult }) {
  return (
    <li
      className={`graduation-cap-card graduation-cap-card--${result.status}`}
      id={`graduation-cap-year-${result.grade}`}
      tabIndex={-1}
    >
      <div className="graduation-cap-card__heading">
        <strong>{result.grade}年次</strong>
        <span>{capStatusLabels[result.status]}</span>
      </div>
      <p>
        前期 {result.springCredits === null ? "未確認" : `${result.springCredits}単位`}
        {" / "}
        後期 {result.fallCredits === null ? "未確認" : `${result.fallCredits}単位`}
      </p>
      <p className="graduation-cap-card__total">
        計画上の履修登録単位：
        {result.annualCredits === null ? "判定できません" : `${result.annualCredits}単位`}
        {result.limit === null ? " / 上限未確認" : ` / ${result.limit}単位`}
      </p>
      {result.warnings.map((warning) => (
        <p className="graduation-cap-card__warning" key={warning}>{warning}</p>
      ))}
    </li>
  );
}

function RequirementCreditCard({
  progress,
  symbol,
  candidateEnabled = false,
  onViewCandidates,
}: {
  progress: CreditRequirementProgress;
  symbol?: string;
  candidateEnabled?: boolean;
  onViewCandidates?: (requirementId: string, trigger: HTMLButtonElement) => void;
}) {
  return (
    <article
      className={`graduation-requirement-card graduation-requirement-card--${progress.status}`}
      id={`graduation-requirement-${progress.id}`}
      tabIndex={-1}
    >
      <header>
        <div>
          {symbol && <span className="graduation-requirement-symbol">{symbol}</span>}
          <h3>{progress.label}</h3>
        </div>
        <strong>{requirementStatusLabels[progress.status]}</strong>
      </header>
      <p className="graduation-requirement-needed">必要 {progress.requiredCredits}単位</p>
      <dl>
        <div><dt>修得済み</dt><dd>{progress.earnedCredits}単位</dd></div>
        <div><dt>今学期含む</dt><dd>{progress.currentIncludedCredits}単位</dd></div>
        <div><dt>計画含む</dt><dd>{progress.plannedIncludedCredits}単位</dd></div>
      </dl>
      {progress.status === "shortfall" && (
        <p className="graduation-requirement-shortfall">
          現時点で{progress.earnedShortfall}単位不足 / 計画上も{progress.projectedShortfall}単位不足
        </p>
      )}
      {candidateEnabled && onViewCandidates && (
        <button
          className="text-button"
          type="button"
          onClick={(event) => onViewCandidates(progress.id, event.currentTarget)}
        >
          候補科目を見る
        </button>
      )}
      {progress.notes.map((note) => (
        <p className="muted-note" key={note}>{note}</p>
      ))}
    </article>
  );
}

function CandidateCourseCard({
  candidate,
  preview,
  awaitingConfirmation,
  onRequestAdd,
  onCancelConfirmation,
  onConfirmAdd,
}: {
  candidate: GraduationCourseCandidate;
  preview: CandidatePlacementPreview;
  awaitingConfirmation: boolean;
  onRequestAdd: () => void;
  onCancelConfirmation: () => void;
  onConfirmAdd: () => void;
}) {
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (awaitingConfirmation) {
      confirmationCancelRef.current?.focus();
    }
  }, [awaitingConfirmation]);

  const yearLabel = preview.yearPlacement === "match"
    ? "✓ 配当年次一致"
    : preview.yearPlacement === "mismatch"
      ? `⚠ 公式では${candidate.recommendedYears.join("・")}年次配当`
      : "? 配当年次を判定できません";
  const semesterLabel = preview.semesterPlacement === "match"
    ? "✓ 開講学期一致"
    : preview.semesterPlacement === "mismatch"
      ? `⚠ 公式では${candidate.availableSemesters.map((item) => item === "spring" ? "前期" : "後期").join("・")}配当`
      : "? 開講学期を判定できません";
  const prerequisiteLabel = preview.prerequisite === "clear"
    ? "✓ 前提科目上のwarningなし"
    : preview.prerequisite === "attention"
      ? "⚠ 前提科目を確認"
      : "? 前提科目の修得状況を確認";
  const capLabel = preview.cap.status === "within_limit"
    ? "✓ CAP上限内"
    : preview.cap.status === "at_limit"
      ? "○ CAP上限ちょうど"
      : preview.cap.status === "over_limit"
        ? "⚠ CAP上限超過"
        : "? CAP判定保留";
  return (
    <article className={`graduation-candidate-card graduation-candidate-card--${preview.status}`}>
      <header>
        <div>
          <span className="status-text">○ 候補</span>
          {courseMasterIds.has(candidate.courseId) ? (
            <Link to={`/courses/${candidate.courseId}`}>{candidate.course.name}</Link>
          ) : (
            <h3>{candidate.course.name}</h3>
          )}
        </div>
        <strong>{candidate.credits}単位</strong>
      </header>
      <p>
        公式配当：{candidate.recommendedYears.length > 0
          ? `${candidate.recommendedYears.join("・")}年次`
          : "年次未確認"}
        {" / "}
        {candidate.availableSemesters.length > 0
          ? candidate.availableSemesters.map((item) => item === "spring" ? "前期" : "後期").join("・")
          : "学期未確認"}
      </p>
      {candidate.course.requirementGroups.length > 0 && (
        <p>卒業要件記号：{candidate.course.requirementGroups.join("・")}</p>
      )}
      <div className="graduation-candidate-reasons">
        <strong>候補になった理由</strong>
        <ul>
          {candidate.reasons.map((reason) => (
            <li key={reason.requirementId}>{reason.label}</li>
          ))}
        </ul>
      </div>
      <ul className="graduation-candidate-constraints" aria-label={`${candidate.course.name}の配置確認`}>
        <li>{yearLabel}</li>
        <li>{semesterLabel}</li>
        <li>{prerequisiteLabel}</li>
        <li>
          {capLabel}（{preview.cap.beforeCredits ?? "未確認"} → {preview.cap.afterCredits ?? "未確認"}
          {preview.cap.limit === null ? " / 上限未確認" : ` / 上限${preview.cap.limit}単位`}）
        </li>
      </ul>
      {preview.messages.length > 0 && (
        <details>
          <summary>確認事項の詳細</summary>
          <ul>{preview.messages.map((message) => <li key={message}>{message}</li>)}</ul>
        </details>
      )}
      {!courseMasterIds.has(candidate.courseId) && (
        <p className="muted-note">この科目はcurriculumデータのみのため、科目詳細リンクはありません。</p>
      )}
      {awaitingConfirmation ? (
        <aside className="graduation-candidate-confirmation" role="alert">
          <strong>この配置には確認事項があります</strong>
          <p>確認事項を残したまま計画へ追加しますか？</p>
          <div>
            <button
              ref={confirmationCancelRef}
              className="button button--secondary"
              type="button"
              onClick={onCancelConfirmation}
            >
              キャンセル
            </button>
            <button className="button" type="button" onClick={onConfirmAdd}>追加する</button>
          </div>
        </aside>
      ) : (
        <button className="button" type="button" onClick={onRequestAdd}>
          この学期に追加
        </button>
      )}
    </article>
  );
}

const planCheckSeverityLabels = {
  attention: "⚠ 確認が必要",
  unknown: "? 判定保留",
  info: "ℹ 確認情報",
} as const;

export function PlanCheckSection({
  summary,
  requirementsProjected,
  onNavigate,
  candidateRequirementIds = new Set<string>(),
  onViewCandidates,
}: {
  summary: GraduationPlanCheckSummary;
  requirementsProjected: boolean;
  onNavigate: (targetId: string) => void;
  candidateRequirementIds?: ReadonlySet<string>;
  onViewCandidates?: (requirementId: string, trigger: HTMLButtonElement) => void;
}) {
  const otherAttention = summary.checks.some(
    (check) => check.severity === "attention" && check.category !== "requirement",
  );
  const visibleCategories = Object.entries(summary.countsByCategory).filter(
    ([, count]) => count > 0,
  );
  return (
    <section
      className="graduation-plan-checks"
      aria-labelledby="graduation-plan-checks-heading"
    >
      <div className="graduation-plan-checks__heading">
        <div>
          <p className="section-kicker">Plan review</p>
          <h2 id="graduation-plan-checks-heading" tabIndex={-1}>計画チェック</h2>
        </div>
        <div className="graduation-plan-checks__totals" aria-label="計画チェック件数">
          {summary.attentionCount > 0 && (
            <strong>⚠ 確認が必要 {summary.attentionCount}件</strong>
          )}
          {summary.unknownCount > 0 && (
            <strong>? 判定保留 {summary.unknownCount}件</strong>
          )}
          {summary.infoCount > 0 && <span>ℹ 確認情報 {summary.infoCount}件</span>}
        </div>
      </div>

      {summary.reviewState === "no_detected_warnings" ? (
        <p className="graduation-plan-checks__clear">
          ✓ 現在登録されている計画では、現在確認できる範囲の既知チェック項目に警告はありません。
        </p>
      ) : summary.reviewState === "has_unknowns" ? (
        <p className="graduation-plan-checks__lead">? 判定を保留している項目があります。</p>
      ) : (
        <p className="graduation-plan-checks__lead">⚠ 計画を見直す必要がある項目があります。</p>
      )}

      {requirementsProjected && otherAttention && (
        <p className="graduation-plan-checks__context">
          卒業要件は計画上到達していますが、CAP・前提科目・配置時期など、ほかの確認事項があります。
        </p>
      )}

      {visibleCategories.length > 0 && (
        <ul className="graduation-plan-checks__categories" aria-label="カテゴリ別件数">
          {visibleCategories.map(([category, count]) => (
            <li key={category}>
              {graduationPlanCheckCategoryLabels[
                category as keyof typeof graduationPlanCheckCategoryLabels
              ]} {count}件
            </li>
          ))}
        </ul>
      )}

      {summary.checks.length > 0 && (
        <details className="graduation-plan-checks__details">
          <summary>確認事項の詳細を見る（{summary.checks.length}件）</summary>
          <ol className="graduation-plan-checks__list">
            {summary.checks.map((check: GraduationPlanCheck) => (
              <li
                className={`graduation-plan-check graduation-plan-check--${check.severity}`}
                key={check.id}
              >
                <div>
                  <span>{planCheckSeverityLabels[check.severity]}</span>
                  <small>{graduationPlanCheckCategoryLabels[check.category]}</small>
                </div>
                <strong>{check.title}</strong>
                <p>{check.message}</p>
                {check.target && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onNavigate(check.target!.id)}
                  >
                    該当箇所を見る
                  </button>
                )}
                {check.category === "requirement" &&
                  check.requirementId &&
                  candidateRequirementIds.has(check.requirementId) &&
                  onViewCandidates && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={(event) =>
                        onViewCandidates(check.requirementId!, event.currentTarget)
                      }
                    >
                      候補を見る
                    </button>
                  )}
              </li>
            ))}
          </ol>
        </details>
      )}

      <p className="muted-note">
        この表示は卒業可能を保証するものではありません。判定には2026年度学生便覧、2026年度curriculum、CAPルール、卒業要件を利用しています。最新の学生便覧・UNIPA等も確認してください。
      </p>
    </section>
  );
}

export function GraduationPlanPage() {
  const { state, dispatch } = useAppState();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<CurriculumSemester | null>(null);
  const [requirementGroup, setRequirementGroup] =
    useState<CurriculumRequirementSymbol | null>(null);
  const [requirementType, setRequirementType] =
    useState<CurriculumRequirementType | null>(null);
  const [courseId, setCourseId] = useState("");
  const [semesterId, setSemesterId] =
    useState<GraduationSemesterId>("year2-spring");
  const searchRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [candidateRequirementId, setCandidateRequirementId] = useState<string | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateYear, setCandidateYear] = useState<number | null>(null);
  const [candidateSemester, setCandidateSemester] =
    useState<CurriculumSemester | null>(null);
  const [candidateRequirementGroup, setCandidateRequirementGroup] =
    useState<CurriculumRequirementSymbol | null>(null);
  const [candidateRequirementType, setCandidateRequirementType] =
    useState<CurriculumRequirementType | null>(null);
  const [candidateCategory, setCandidateCategory] = useState<string | null>(null);
  const [candidatePlacementSemesterId, setCandidatePlacementSemesterId] =
    useState<GraduationSemesterId>("year2-spring");
  const [matchingPlacementOnly, setMatchingPlacementOnly] = useState(false);
  const [candidatePendingConfirmation, setCandidatePendingConfirmation] =
    useState<string | null>(null);
  const candidateTriggerRef = useRef<HTMLButtonElement | null>(null);
  const candidateCloseRef = useRef<HTMLButtonElement>(null);

  const board = useMemo(() => selectGraduationBoard(state), [state]);
  const summary = useMemo(
    () => selectGraduationCreditSummary(state),
    [state],
  );
  const candidateSituations = useMemo(
    () => selectGraduationCandidateSituations(state),
    [state],
  );
  const requirementProgress = useMemo(
    () => selectGraduationRequirementProgress(state),
    [state],
  );
  const requirementShortfalls = useMemo(
    () => selectGraduationRequirementShortfalls(state),
    [state],
  );
  const specialSummary = useMemo(
    () => selectGraduationSpecialSummary(state),
    [state],
  );
  const supersededEntries = useMemo(
    () => selectSupersededGraduationPlanEntries(state),
    [state],
  );
  const unresolvedRequiredCourses = useMemo(
    () => selectUnresolvedRequiredCourses(),
    [],
  );
  const prerequisiteChecks = useMemo(
    () => selectGraduationPrerequisiteChecks(state),
    [state],
  );
  const capResults = useMemo(
    () => selectGraduationCapPlan(state),
    [state],
  );
  const planChecks = useMemo(
    () => selectGraduationPlanChecks(state),
    [state],
  );
  const candidateRequirementIds = useMemo(() => {
    const ids = new Set<string>();
    if (requirementProgress.selectableRequired.status === "shortfall") {
      ids.add(requirementProgress.selectableRequired.id);
    }
    for (const item of [
      ...requirementProgress.requirementGroups,
      ...requirementProgress.electiveRequirements,
    ]) {
      if (item.status === "shortfall") ids.add(item.id);
    }
    if (isTotalOnlyCandidateSearchAvailable(requirementProgress)) {
      ids.add(requirementProgress.totalCredits.id);
    }
    return ids;
  }, [requirementProgress]);
  const candidateCourses = useMemo(
    () => candidateRequirementId
      ? selectGraduationCandidatesForRequirement(state, candidateRequirementId, {
          query: candidateQuery,
          year: candidateYear,
          semester: candidateSemester,
          requirementGroup: candidateRequirementGroup,
          requirementType: candidateRequirementType,
          curriculumCategoryPrefix: candidateCategory,
          placementSemesterId: candidatePlacementSemesterId,
          matchingPlacementOnly,
        })
      : [],
    [
      candidateCategory,
      candidatePlacementSemesterId,
      candidateQuery,
      candidateRequirementGroup,
      candidateRequirementId,
      candidateRequirementType,
      candidateSemester,
      candidateYear,
      matchingPlacementOnly,
      state,
    ],
  );
  const candidatePreviews = useMemo(
    () => new Map(
      candidateCourses.flatMap((candidate) => {
        const preview = selectGraduationCandidatePreview(
          state,
          candidate.courseId,
          candidatePlacementSemesterId,
        );
        return preview ? [[candidate.courseId, preview] as const] : [];
      }),
    ),
    [candidateCourses, candidatePlacementSemesterId, state],
  );
  const candidateConstraintSummary = useMemo(
    () => getCandidateConstraintSummary([...candidatePreviews.values()]),
    [candidatePreviews],
  );
  const availableCourses = useMemo(
    () =>
      selectUnplacedCurriculumCourses(state, {
        query,
        year,
        semester,
        requirementGroup,
        requirementType,
      }),
    [query, requirementGroup, requirementType, semester, state, year],
  );
  const selectedCourse = availableCourses.find(
    (course) => course.courseId === courseId,
  );
  const placementWarnings = selectedCourse
    ? getPlacementWarnings(selectedCourse, semesterId)
    : [];
  const prospectivePrerequisiteCheck = selectedCourse
    ? selectProspectivePrerequisiteCheck(
        state,
        selectedCourse.courseId,
        semesterId,
      )
    : null;
  const prospectiveCapResult = selectedCourse
    ? selectProspectiveGraduationCap(
        state,
        selectedCourse.courseId,
        semesterId,
      )
    : null;
  const searchedCourse = query.trim()
    ? curriculumCourses.find(
        (course) =>
          course.name.toLocaleLowerCase("ja") ===
          query.trim().toLocaleLowerCase("ja"),
      )
    : undefined;
  const existingPlacement = searchedCourse
    ? board
        .flatMap((item) => item.courses)
        .find((entry) => entry.course.courseId === searchedCourse.courseId)
    : undefined;
  const existingSemesterLabel = existingPlacement
    ? graduationSemesters.find((item) => item.id === existingPlacement.semesterId)
        ?.label
    : undefined;
  const searchNotice = existingPlacement?.status === "earned"
    ? `この科目は${existingSemesterLabel}に修得済みとして表示されています。重複して配置できません。`
    : existingPlacement?.source === "graduation_plan"
      ? `この科目は${existingSemesterLabel}に履修予定として配置されています。`
      : existingPlacement?.source === "required_auto"
        ? `この必修科目は公式curriculumに基づき${existingSemesterLabel}へ自動表示されています。`
      : existingPlacement
        ? `この科目は${existingSemesterLabel}の履修登録対象として表示されています。`
        : searchedCourse?.planningAvailability === "managed_elsewhere"
          ? "特殊な履修方法の科目は現在この画面から配置できません。"
          : null;

  useEffect(() => {
    if (isPickerOpen) searchRef.current?.focus();
  }, [isPickerOpen]);

  useEffect(() => {
    if (candidateRequirementId) candidateCloseRef.current?.focus();
  }, [candidateRequirementId]);

  function closePicker() {
    setPickerOpen(false);
    setCourseId("");
    openButtonRef.current?.focus();
  }

  function addCourse() {
    if (!selectedCourse) return;
    dispatch({
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId: selectedCourse.courseId, semesterId },
    });
    closePicker();
  }

  function openCandidatePanel(
    requirementId: string,
    trigger: HTMLButtonElement,
  ) {
    candidateTriggerRef.current = trigger;
    setCandidateRequirementId(requirementId);
    setCandidateQuery("");
    setCandidateYear(null);
    setCandidateSemester(null);
    setCandidateRequirementGroup(null);
    setCandidateRequirementType(null);
    setCandidateCategory(null);
    setMatchingPlacementOnly(false);
    setCandidatePendingConfirmation(null);
  }

  function closeCandidatePanel() {
    setCandidateRequirementId(null);
    setCandidatePendingConfirmation(null);
    candidateTriggerRef.current?.focus();
  }

  function commitCandidate(courseId: string) {
    dispatch({
      type: "ADD_GRADUATION_PLAN_COURSE",
      payload: { courseId, semesterId: candidatePlacementSemesterId },
    });
    closeCandidatePanel();
  }

  function requestCandidateAdd(
    courseId: string,
    preview: CandidatePlacementPreview,
  ) {
    if (preview.status === "clear") {
      commitCandidate(courseId);
      return;
    }
    setCandidatePendingConfirmation(courseId);
  }

  function navigateWithinPlan(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }

  const requirementsProjected = [
    requirementProgress.totalCredits.status,
    requirementProgress.requiredCourses.status,
    requirementProgress.selectableRequired.status,
    ...requirementProgress.requirementGroups.map((item) => item.status),
    ...requirementProgress.electiveRequirements.map((item) => item.status),
  ].every((status) => status === "satisfied" || status === "projected_satisfied");
  const candidateRequirementLabel = candidateRequirementId === requirementProgress.totalCredits.id
      ? requirementProgress.totalCredits.label
      : candidateRequirementId === requirementProgress.selectableRequired.id
        ? requirementProgress.selectableRequired.label
        : [
            ...requirementProgress.requirementGroups,
            ...requirementProgress.electiveRequirements,
          ].find((item) => item.id === candidateRequirementId)?.label ?? "不足要件";
  const candidateShowsExcessNotice = Boolean(
    candidateRequirementId &&
    requirementProgress.electiveRequirements.some(
      (item) => item.id === candidateRequirementId,
    ) &&
    requirementProgress.selectableRequiredExcess.plannedIncludedCredits > 0,
  );

  return (
    <main className="graduation-plan-page">
      <div className="graduation-plan-shell">
        <header className="graduation-plan-header">
          <div>
            <p className="eyebrow">Graduation planning</p>
            <h1>卒業設計</h1>
            <p>卒業までに履修する科目を学期ごとに整理します。</p>
          </div>
          <Link className="button button--secondary" to="/graduation">
            卒業設計の説明へ戻る
          </Link>
        </header>

        <aside className="graduation-notice" role="note">
          <strong>予定に追加しただけでは単位修得にはなりません</strong>
          <p>
            修得済み・現在の1年後期履修対象・将来予定を分けて表示しています。将来予定は履修登録済み・単位修得済みを意味しません。この画面は卒業を保証しません。実際の開講状況・履修条件は学生便覧・UNIPA等の公式情報を確認してください。
          </p>
        </aside>

        <nav className="graduation-section-nav" aria-label="卒業設計内の移動">
          <button type="button" onClick={() => navigateWithinPlan("graduation-plan-checks-heading")}>計画チェック</button>
          <button type="button" onClick={() => navigateWithinPlan("credit-summary-heading")}>単位サマリー</button>
          <button type="button" onClick={() => navigateWithinPlan("graduation-requirements-heading")}>卒業要件</button>
          <button type="button" onClick={() => navigateWithinPlan("graduation-cap-heading")}>CAP</button>
          <button type="button" onClick={() => navigateWithinPlan("semester-board-heading")}>8学期</button>
          <button type="button" onClick={() => navigateWithinPlan("graduation-unresolved-required-heading")}>未確定事項</button>
        </nav>

        <PlanCheckSection
          summary={planChecks}
          requirementsProjected={requirementsProjected}
          onNavigate={navigateWithinPlan}
          candidateRequirementIds={candidateRequirementIds}
          onViewCandidates={openCandidatePanel}
        />

        <section className="graduation-credit-summary" aria-labelledby="credit-summary-heading">
          <h2 id="credit-summary-heading" tabIndex={-1}>計画単位の内訳</h2>
          <dl>
            <div><dt>修得済み</dt><dd>{summary.earnedCredits}単位</dd></div>
            <div><dt>今学期の履修対象</dt><dd>{summary.currentCredits}単位</dd></div>
            <div><dt>将来予定</dt><dd>{summary.plannedCredits}単位</dd></div>
            <div><dt>計画上の合計</dt><dd>{summary.totalPlannedCredits}単位</dd></div>
          </dl>
          <p className="muted-note">今学期の必修は対象科目として計上しますが、UNIPAでの登録済み・単位修得済みを意味しません。通常抽選は当選かつUNIPA確認済みのみ対象に含めます。特殊科目は集計対象外です。</p>
        </section>

        <section className="graduation-overview-section" aria-labelledby="graduation-cap-heading">
          <h2 id="graduation-cap-heading" tabIndex={-1}>学年別CAP（履修登録単位の計画）</h2>
          <p>
            前期と後期を学年ごとに合算した年間の試算です。将来予定は実際に履修登録済みであることを意味しません。
          </p>
          <ul className="graduation-cap-grid">
            {capResults.map((result) => (
              <CapResultCard key={result.grade} result={result} />
            ))}
          </ul>
          <p className="muted-note">
            通常上限は1年次46単位、2〜4年次42単位です。必修再履修・優秀成績者の例外は、申請や適用条件をこのアプリで確認できないため自動適用していません。特殊科目もこのCAP試算に含めていません。
          </p>
        </section>

        {candidateSituations.length > 0 && (
          <section className="graduation-overview-section" aria-labelledby="graduation-candidates-heading">
            <h2 id="graduation-candidates-heading">今学期の履修候補・通常抽選</h2>
            <p>検討中・応募済み・結果待ち・落選・当選後のUNIPA未確認は、今学期の履修対象単位に含めません。</p>
            <ul className="graduation-overview-list">
              {candidateSituations.map((item) => (
                <li key={item.courseId}>
                  <strong>{item.name}</strong>
                  <span>{candidateStatusLabels[item.status]}</span>
                </li>
              ))}
            </ul>
            <Link to="/lottery">通常抽選を確認する</Link>
          </section>
        )}

        {supersededEntries.length > 0 && (
          <aside className="graduation-overview-section graduation-placement-warning" role="note">
            <h2>重複する将来予定を確認してください</h2>
            <p>修得済みまたは今学期対象と重なった保存済み予定は、計画単位に二重計上していません。自動削除もしていません。</p>
            <ul>
              {supersededEntries.map((item) => (
                <li key={item.courseId}>
                  {item.name}
                  {item.source === "required_auto" ? (
                    <span> — 保存済みの必修予定は、自動表示へ統合しています（保存データは変更していません）。</span>
                  ) : (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => dispatch({ type: "REMOVE_GRADUATION_PLAN_COURSE", payload: item.courseId })}
                    >
                      {item.name}の将来予定を外す
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}

        <section aria-labelledby="semester-board-heading">
          <div className="graduation-board-heading">
            <div>
              <p className="section-kicker">Eight semesters</p>
              <h2 id="semester-board-heading" tabIndex={-1}>8学期ボード</h2>
            </div>
            <button
              ref={openButtonRef}
              className="button"
              type="button"
              onClick={() => setPickerOpen(true)}
            >
              科目を追加
            </button>
          </div>
          <p className="muted-note">必修科目は公式curriculumの配当年次・学期に基づいて自動表示され、追加候補には表示されません。</p>

          <div className="graduation-board">
            {board.map((semesterBoard) => (
              <section
                className="graduation-semester-card"
                id={`graduation-semester-${semesterBoard.id}`}
                key={semesterBoard.id}
                aria-labelledby={`${semesterBoard.id}-heading`}
                tabIndex={-1}
              >
                <header>
                  <h3 id={`${semesterBoard.id}-heading`}>{semesterBoard.label}</h3>
                  <div className="graduation-semester-credits">
                    <span>修得済み {semesterBoard.credits.earned}単位</span>
                    <span>今学期対象 {semesterBoard.credits.current}単位</span>
                    <strong>将来予定 {semesterBoard.credits.planned}単位</strong>
                  </div>
                </header>
                {semesterBoard.courses.length === 0 ? (
                  <p className="graduation-empty">表示する科目はまだありません。</p>
                ) : (
                  <ul className="graduation-course-list">
                    {semesterBoard.courses.map((entry) => {
                      const entryWarnings = getPlacementWarnings(
                        entry.course,
                        entry.semesterId,
                      );
                      const semesterYear = graduationSemesters.find(
                        (item) => item.id === entry.semesterId,
                      )?.year;
                      const entryCapResult = capResults.find(
                        (result) => result.grade === semesterYear,
                      );
                      return (
                      <li
                        className="graduation-course-card"
                        id={`graduation-course-${entry.course.courseId}`}
                        key={entry.course.courseId}
                        tabIndex={-1}
                      >
                        <span className={`status-text status-text--${entry.source === "current_registration" ? "current" : entry.status}`}>
                          {entry.source === "current_registration"
                            ? entry.registrationEvidence === "unipa_confirmed"
                              ? "● 今学期の履修対象"
                              : "● 今学期の必修"
                            : entry.source === "required_auto"
                              ? entry.firstSemesterStatus === "failed"
                                ? "△ 必修・未修得"
                                : entry.firstSemesterStatus === "not_taken"
                                  ? "□ 必修・未履修"
                                  : entry.firstSemesterStatus === "unknown"
                                    ? "？ 必修・状態未確認"
                                    : "▣ 必修・将来予定（自動表示）"
                            : statusLabels[entry.status]}
                        </span>
                        {entry.registrationEvidence === "unipa_confirmed" && (
                          <p className="muted-note">UNIPA登録確認済み（単位修得済みの判定ではありません）</p>
                        )}
                        {courseMasterIds.has(entry.course.courseId) ? (
                          <Link className="graduation-course-name" to={`/courses/${entry.course.courseId}`}>
                            {entry.course.name}
                          </Link>
                        ) : (
                          <strong className="graduation-course-name">{entry.course.name}</strong>
                        )}
                        <p>
                          {entry.course.credits}単位
                          {entry.course.requirementGroups.length > 0
                            ? ` / ${entry.course.requirementGroups.join("・")}`
                            : ""}
                        </p>
                        {entry.course.recommendedYears.length > 0 && (
                          <p>配当年次: {entry.course.recommendedYears.join("・")}年</p>
                        )}
                        {entryWarnings.length > 0 && (
                          <aside className="graduation-placement-warning" role="note">
                            <strong>公式の配当情報と異なる配置です</strong>
                            <ul>
                              {entryWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </aside>
                        )}
                        {(entry.source === "graduation_plan" || entry.source === "required_auto") && (
                          <PrerequisiteDetails
                            result={
                              prerequisiteChecks.get(entry.course.courseId) ?? {
                                courseId: entry.course.courseId,
                                status: "not_applicable",
                                requirements: [],
                              }
                            }
                          />
                        )}
                        {(entry.source === "graduation_plan" || entry.source === "required_auto") &&
                          entryCapResult?.status === "over_limit" && (
                            <aside className="graduation-cap-warning" role="note">
                              <strong>⚠ CAPを確認</strong>
                              <p>
                                {entryCapResult.grade}年次の計画上の履修登録単位は
                                {entryCapResult.annualCredits} / {entryCapResult.limit}単位です。
                              </p>
                            </aside>
                          )}
                        {!courseMasterIds.has(entry.course.courseId) && (
                          <p className="muted-note">科目詳細は卒業設計データのみです。</p>
                        )}
                        {entry.editable ? (
                          <div className="graduation-course-actions">
                            <label>
                              配置学期
                              <select
                                aria-label={`${entry.course.name}の配置学期`}
                                value={entry.semesterId}
                                onChange={(event) =>
                                  dispatch({
                                    type: "MOVE_GRADUATION_PLAN_COURSE",
                                    payload: {
                                      courseId: entry.course.courseId,
                                      semesterId: event.target.value as GraduationSemesterId,
                                    },
                                  })
                                }
                              >
                                {graduationSemesters.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="text-button text-button--danger"
                              type="button"
                              onClick={() => dispatch({ type: "REMOVE_GRADUATION_PLAN_COURSE", payload: entry.course.courseId })}
                            >
                              計画から外す
                            </button>
                          </div>
                        ) : entry.status === "earned" ? (
                          <p className="graduation-source-note">
                            修得状況は<Link to="/settings">前期設定</Link>から変更できます。
                          </p>
                        ) : entry.source === "required_auto" && entry.semesterId === "year1-spring" ? (
                          <p className="graduation-source-note">
                            修得状況は前期設定から変更できます。
                          </p>
                        ) : entry.source === "required_auto" ? (
                          <p className="graduation-source-note">
                            公式curriculumから自動表示しています。卒業設計から移動・削除はできません。
                          </p>
                        ) : (
                          <p className="graduation-source-note">
                            1年後期の状態は<Link to="/registration/2026-fall">履修登録</Link>から確認できます。
                          </p>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </section>

        <section className="graduation-overview-section graduation-requirements" aria-labelledby="graduation-requirements-heading">
          <h2 id="graduation-requirements-heading" tabIndex={-1}>卒業要件の進捗</h2>
          <p>
            「計画上到達」は、現在履修対象・履修予定の科目をすべて修得した場合の試算です。修得済みを意味せず、卒業を保証するものではありません。
          </p>

          {requirementProgress.warnings.length > 0 && (
            <aside className="graduation-requirement-notice" role="note">
              <strong>試算上の注意</strong>
              <ul>
                {requirementProgress.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}

          {requirementShortfalls.length > 0 && (
            <section className="graduation-shortfall-summary" aria-labelledby="graduation-shortfall-heading">
              <h3 id="graduation-shortfall-heading">計画上も不足している要件</h3>
              <ul>
                {requirementShortfalls.map((item) => (
                  <li key={item.id}><strong>{item.label}</strong> あと{item.amount}{item.unit}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="graduation-requirement-grid">
            <RequirementCreditCard
              progress={requirementProgress.totalCredits}
              candidateEnabled={candidateRequirementIds.has(requirementProgress.totalCredits.id)}
              onViewCandidates={openCandidatePanel}
            />

            <article
              className={`graduation-requirement-card graduation-requirement-card--${requirementProgress.requiredCourses.status}`}
              id={`graduation-requirement-${requirementProgress.requiredCourses.id}`}
              tabIndex={-1}
            >
              <header>
                <h3>{requirementProgress.requiredCourses.label}</h3>
                <strong>{requirementStatusLabels[requirementProgress.requiredCourses.status]}</strong>
              </header>
              <p className="graduation-requirement-needed">
                必修{requirementProgress.requiredCourses.totalCourses}科目 / {requirementProgress.requiredCourses.requiredCredits}単位
              </p>
              <dl>
                <div><dt>修得済み</dt><dd>{requirementProgress.requiredCourses.earnedCourses}科目</dd></div>
                <div><dt>今学期含む</dt><dd>{requirementProgress.requiredCourses.currentIncludedCourses}科目</dd></div>
                <div><dt>計画含む</dt><dd>{requirementProgress.requiredCourses.plannedIncludedCourses}科目</dd></div>
              </dl>
              <p className="muted-note">
                計画含む単位 {requirementProgress.requiredCourses.plannedIncludedCredits} / {requirementProgress.requiredCourses.requiredCredits}単位
              </p>
              <p className="muted-note">必修科目は公式curriculumから自動配置しています。</p>
            </article>

            <RequirementCreditCard
              progress={requirementProgress.selectableRequired}
              candidateEnabled={candidateRequirementIds.has(requirementProgress.selectableRequired.id)}
              onViewCandidates={openCandidatePanel}
            />
          </div>

          <h3 className="graduation-requirement-subheading">選択必修の記号別進捗</h3>
          <div className="graduation-requirement-grid">
            {requirementProgress.requirementGroups.map((item) => (
              <RequirementCreditCard
                key={item.id}
                progress={item}
                symbol={item.symbol}
                candidateEnabled={candidateRequirementIds.has(item.id)}
                onViewCandidates={openCandidatePanel}
              />
            ))}
          </div>

          <h3 className="graduation-requirement-subheading">選択科目区分</h3>
          <div className="graduation-requirement-grid">
            {requirementProgress.electiveRequirements.map((item) => (
              <RequirementCreditCard
                key={item.id}
                progress={item}
                candidateEnabled={candidateRequirementIds.has(item.id)}
                onViewCandidates={openCandidatePanel}
              />
            ))}
          </div>

          <aside className="graduation-requirement-notice" role="note">
            <strong>選択必修の超過単位</strong>
            <p>
              修得済み {requirementProgress.selectableRequiredExcess.earnedCredits}単位 / 今学期含む {requirementProgress.selectableRequiredExcess.currentIncludedCredits}単位 / 計画含む {requirementProgress.selectableRequiredExcess.plannedIncludedCredits}単位
            </p>
            <p>{requirementProgress.selectableRequiredExcess.note}</p>
          </aside>
        </section>

        <section className="graduation-overview-section" aria-labelledby="graduation-unresolved-required-heading">
          <h2 id="graduation-unresolved-required-heading" tabIndex={-1}>配置時期を自動決定できない必修科目</h2>
          {unresolvedRequiredCourses.length === 0 ? (
            <p>現在の公式curriculumでは、配置時期が一意に決まらない必修科目はありません。</p>
          ) : (
            <ul>
              {unresolvedRequiredCourses.map(({ course, reasons }) => (
                <li key={course.courseId}>
                  <strong>{course.name}</strong> — {
                    reasons.includes("managed_elsewhere")
                      ? "特殊な履修方法"
                      : reasons.includes("multiple_years")
                        ? "複数学年配当"
                        : reasons.includes("multiple_semesters")
                          ? "複数学期配当"
                          : "公式の配当情報が未確定"
                  }
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="graduation-overview-section" aria-labelledby="graduation-special-heading">
          <h2 id="graduation-special-heading" tabIndex={-1}>特殊科目（単位集計対象外）</h2>
          <p>イノベーション特講：{specialSummary.lecture}</p>
          <p>イノベーション技法：{specialSummary.method}</p>
          <p>特殊科目の単位・CAP上の扱いは公式資料で確認してください。</p>
          <Link to="/special">特殊科目を確認する</Link>
        </section>
      </div>

      {isPickerOpen && (
        <div className="graduation-dialog-backdrop">
          <section
            className="graduation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-picker-heading"
            onKeyDown={(event) => {
              if (event.key === "Escape") closePicker();
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
                ),
              );
              const first = focusable[0];
              const last = focusable.at(-1);
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <header>
              <div>
                <p className="section-kicker">Unplaced courses</p>
                <h2 id="course-picker-heading">未配置の科目を探す</h2>
              </div>
              <button className="icon-button" type="button" onClick={closePicker} aria-label="科目選択を閉じる">×</button>
            </header>
            <p className="muted-note">必修科目は公式curriculumに基づいて自動表示されるため、この検索には含まれません。</p>

            <div className="graduation-filters">
              <label>
                科目名検索
                <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <label>
                学年
                <select value={year ?? ""} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}>
                  <option value="">すべて</option>
                  {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}年</option>)}
                </select>
              </label>
              <label>
                学期
                <select value={semester ?? ""} onChange={(event) => setSemester((event.target.value || null) as CurriculumSemester | null)}>
                  <option value="">すべて</option>
                  <option value="spring">前期</option>
                  <option value="fall">後期</option>
                </select>
              </label>
              <label>
                卒業要件
                <select value={requirementGroup ?? ""} onChange={(event) => setRequirementGroup((event.target.value || null) as CurriculumRequirementSymbol | null)}>
                  <option value="">すべて</option>
                  {requirementSymbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                </select>
              </label>
              <label>
                区分
                <select
                  value={requirementType ?? ""}
                  onChange={(event) =>
                    setRequirementType(
                      (event.target.value || null) as CurriculumRequirementType | null,
                    )
                  }
                >
                  <option value="">すべて</option>
                  {requirementTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {searchNotice && <p role="status">{searchNotice}</p>}

            <fieldset className="graduation-picker-results">
              <legend>科目を選択（{availableCourses.length}件）</legend>
              {availableCourses.length === 0 ? (
                <p>条件に一致する未配置科目がありません。</p>
              ) : (
                availableCourses.map((course) => (
                  <label className="graduation-picker-option" key={course.courseId}>
                    <input type="radio" name="curriculum-course" value={course.courseId} checked={courseId === course.courseId} onChange={() => setCourseId(course.courseId)} />
                    <span>
                      <strong>{course.name}</strong>
                      <small>{course.credits}単位 / {course.recommendedYears.join("・")}年 / {course.availableSemesters.map((value) => value === "spring" ? "前期" : "後期").join("・")}</small>
                    </span>
                  </label>
                ))
              )}
            </fieldset>

            <label className="graduation-destination">
              配置する学期
              <select value={semesterId} onChange={(event) => setSemesterId(event.target.value as GraduationSemesterId)}>
                {graduationSemesters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>

            {placementWarnings.length > 0 && (
              <aside className="warning-card" role="status">
                <strong>公式の配当情報と異なる配置です</strong>
                <ul>{placementWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                <p>配当情報と異なる場合も配置できます。実際の履修可否は公式情報を確認してください。</p>
              </aside>
            )}

            {prospectivePrerequisiteCheck &&
              prospectivePrerequisiteCheck.status !== "not_applicable" && (
              <aside
                className={
                  prospectivePrerequisiteCheck.status === "satisfied"
                    ? "graduation-prerequisite-preview graduation-prerequisite-preview--satisfied"
                    : "warning-card"
                }
                role="status"
              >
                <strong>
                  {prospectivePrerequisiteCheck.status === "satisfied"
                    ? "✓ 前提科目OK"
                    : prospectivePrerequisiteCheck.status === "warning"
                      ? "⚠ 前提科目の修得状況を確認してください"
                      : "⚠ この配置では前提科目を先に満たしていません"}
                </strong>
                <ul>
                  {prospectivePrerequisiteCheck.requirements.map((requirement) => (
                    <li key={requirement.prerequisiteCourseId}>
                      {requirement.prerequisiteCourseName} — {prerequisiteStatusLabels[requirement.status]}
                    </li>
                  ))}
                </ul>
                {prospectivePrerequisiteCheck.status !== "satisfied" && (
                  <p>警告がある場合も配置できます。実際の履修条件は公式情報を確認してください。</p>
                )}
              </aside>
            )}

            {prospectiveCapResult?.status === "over_limit" && (
              <aside className="warning-card" role="status">
                <strong>⚠ この配置では年間CAPを超えます</strong>
                <p>
                  この科目を{prospectiveCapResult.grade}年次に配置すると、計画上の履修登録単位は
                  {prospectiveCapResult.annualCredits} / {prospectiveCapResult.limit}単位になります。
                </p>
                <p>警告がある場合も配置できます。実際の上限適用や例外は公式情報・事務局で確認してください。</p>
              </aside>
            )}

            <div className="graduation-dialog-actions">
              <button className="button button--secondary" type="button" onClick={closePicker}>キャンセル</button>
              <button className="button" type="button" disabled={!selectedCourse} onClick={addCourse}>この学期に追加</button>
            </div>
          </section>
        </div>
      )}

      {candidateRequirementId && (
        <div className="graduation-dialog-backdrop">
          <section
            className="graduation-dialog graduation-candidate-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="graduation-candidate-heading"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeCandidatePanel();
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
                ),
              );
              const first = focusable[0];
              const last = focusable.at(-1);
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <header>
              <div>
                <p className="section-kicker">Official curriculum candidates</p>
                <h2 id="graduation-candidate-heading">不足を埋める科目を探す</h2>
                <p>{candidateRequirementLabel}に関係する未使用科目を表示しています。</p>
              </div>
              <button
                ref={candidateCloseRef}
                className="icon-button"
                type="button"
                onClick={closeCandidatePanel}
                aria-label="候補科目を閉じる"
              >
                ×
              </button>
            </header>

            <aside className="graduation-candidate-notice" role="note">
              <strong>候補は推薦や順位ではありません</strong>
              <p>
                2026年度公式curriculumで条件に一致する科目を列挙しています。将来年度の実際の開講状況は変更される可能性があります。最終判断は学生便覧・UNIPA等で確認してください。
              </p>
            </aside>

            <label className="graduation-destination">
              配置を検討する学期
              <select
                aria-label="候補科目の配置学期"
                value={candidatePlacementSemesterId}
                onChange={(event) => {
                  setCandidatePlacementSemesterId(
                    event.target.value as GraduationSemesterId,
                  );
                  setCandidatePendingConfirmation(null);
                }}
              >
                {graduationSemesters.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>

            <div className="graduation-filters graduation-candidate-filters">
              <label>
                科目名検索
                <input
                  type="search"
                  value={candidateQuery}
                  onChange={(event) => setCandidateQuery(event.target.value)}
                />
              </label>
              <label>
                公式配当年次
                <select
                  value={candidateYear ?? ""}
                  onChange={(event) =>
                    setCandidateYear(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">すべて</option>
                  {[1, 2, 3, 4].map((value) => (
                    <option key={value} value={value}>{value}年</option>
                  ))}
                </select>
              </label>
              <label>
                公式学期
                <select
                  value={candidateSemester ?? ""}
                  onChange={(event) =>
                    setCandidateSemester(
                      (event.target.value || null) as CurriculumSemester | null,
                    )
                  }
                >
                  <option value="">すべて</option>
                  <option value="spring">前期</option>
                  <option value="fall">後期</option>
                </select>
              </label>
              <label>
                卒業要件記号
                <select
                  value={candidateRequirementGroup ?? ""}
                  onChange={(event) =>
                    setCandidateRequirementGroup(
                      (event.target.value || null) as CurriculumRequirementSymbol | null,
                    )
                  }
                >
                  <option value="">すべて</option>
                  {requirementSymbols.map((symbol) => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
              </label>
              <label>
                区分
                <select
                  value={candidateRequirementType ?? ""}
                  onChange={(event) =>
                    setCandidateRequirementType(
                      (event.target.value || null) as CurriculumRequirementType | null,
                    )
                  }
                >
                  <option value="">すべて</option>
                  {requirementTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>
              <label>
                科目カテゴリ
                <select
                  value={candidateCategory ?? ""}
                  onChange={(event) => setCandidateCategory(event.target.value || null)}
                >
                  <option value="">すべて</option>
                  <option value="基礎科目">基礎科目</option>
                  <option value="職業専門科目">職業専門科目</option>
                  <option value="展開科目">展開科目</option>
                  <option value="総合科目">総合科目</option>
                </select>
              </label>
              <label className="graduation-candidate-checkbox">
                <input
                  type="checkbox"
                  checked={matchingPlacementOnly}
                  onChange={(event) => setMatchingPlacementOnly(event.target.checked)}
                />
                配当年次・学期が配置先と一致する科目だけ
              </label>
            </div>

            <div className="graduation-candidate-summary" role="status">
              <strong>候補 {candidateConstraintSummary.total}科目</strong>
              <span>✓ 現在確認できる範囲ではwarningなし {candidateConstraintSummary.clear}</span>
              <span>⚠ 確認事項あり {candidateConstraintSummary.attention}</span>
              <span>? 判定保留 {candidateConstraintSummary.unknown}</span>
            </div>

            {candidateShowsExcessNotice && (
              <aside className="graduation-requirement-notice" role="note">
                <strong>選択必修の超過単位があります</strong>
                <p>
                  計画上の超過は
                  {requirementProgress.selectableRequiredExcess.plannedIncludedCredits}単位です。選択科目要件へ算入できる可能性がありますが、カテゴリ別配分は自動判定していません。
                </p>
              </aside>
            )}

            {candidateCourses.length === 0 ? (
              <p className="graduation-candidate-empty">
                {candidateRequirementId === "professional-elective"
                  ? "現在の登録済み公式データでは、直接この区分に該当する一般候補科目を確認できません。選択必修超過単位や特殊科目の扱いを含め、学生便覧・UNIPA等の公式情報を確認してください。"
                  : "現在の公式curriculumデータでは、この条件に一致する未配置科目がありません。これは要件を満たせないという判定ではありません。"}
              </p>
            ) : (
              <div className="graduation-candidate-list">
                {candidateCourses.map((candidate) => {
                  const preview = candidatePreviews.get(candidate.courseId);
                  if (!preview) return null;
                  return (
                    <CandidateCourseCard
                      key={candidate.courseId}
                      candidate={candidate}
                      preview={preview}
                      awaitingConfirmation={
                        candidatePendingConfirmation === candidate.courseId
                      }
                      onRequestAdd={() => requestCandidateAdd(candidate.courseId, preview)}
                      onCancelConfirmation={() => setCandidatePendingConfirmation(null)}
                      onConfirmAdd={() => commitCandidate(candidate.courseId)}
                    />
                  );
                })}
              </div>
            )}

            <aside className="graduation-candidate-special-note" role="note">
              <p>特殊科目は別の履修ルールがあるため、この候補検索には含めていません。</p>
              <Link to="/special">特殊科目を確認する</Link>
            </aside>
          </section>
        </div>
      )}
    </main>
  );
}
