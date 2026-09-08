import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
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
import {
  englishTrackChoices,
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { calculateCap } from "../domain/cap";
import type { Course } from "../domain/course";
import {
  evaluateCandidateCourse,
  getOfferingSlots,
  resolveCandidateOffering,
  type CandidateCourseDecision,
  type ScheduledCourse,
} from "../domain/coursePlanning";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import {
  getLotteryStatusLabel,
  hasLotteryActivity,
  type LotteryApplication,
} from "../domain/lottery";
import {
  calculateRequirementContribution,
  calculateRequirementProgress,
  type RequirementProgress,
} from "../domain/requirements";
import type {
  CourseOffering,
  TimeSlot,
  Weekday,
} from "../domain/timetable";
import { useAppState } from "../state/useAppState";

const weekdayLabels: Record<Weekday, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
};

function formatSlots(slots: readonly TimeSlot[]): string {
  return slots
    .map((slot) => weekdayLabels[slot.day] + "曜" + slot.period + "限")
    .join("・");
}

function getRequirementTypeLabel(course: Course): string {
  return course.requirementType === "required_elective" ? "選択必修" : "選択";
}

type CandidateCardProps = {
  course: Course;
  offering: CourseOffering;
  decision: CandidateCourseDecision;
  progress: readonly RequirementProgress[];
  selected: boolean;
  selectedCourseIds: ReadonlySet<string>;
  lotteryApplication?: LotteryApplication;
  removalPending: boolean;
  onToggle: () => void;
  onConfirmRemoval: () => void;
  onCancelRemoval: () => void;
};

function CandidateCard({
  course,
  offering,
  decision,
  progress,
  selected,
  selectedCourseIds,
  lotteryApplication,
  removalPending,
  onToggle,
  onConfirmRemoval,
  onCancelRemoval,
}: CandidateCardProps) {
  const progressById = new Map(progress.map((item) => [item.groupId, item]));
  const requirementContributions = calculateRequirementContribution(
    course,
    progress,
  );
  const hasScheduleOptions =
    offering.scheduleOptions !== undefined && offering.scheduleOptions.length > 0;
  const timetableMessage = decision.timetable.allOptionsConflict
    ? "× 時間割が重複しています"
    : decision.timetable.hasAnyConflict
      ? "△ 一部の授業枠が重複"
      : "✓ 必修時間割との重複なし";
  const selectedConflicts = new Map(
    decision.timetable.options
      .flatMap((option) => option.conflictsWith)
      .filter((conflict) => selectedCourseIds.has(conflict.courseId))
      .map((conflict) => [conflict.courseId, conflict]),
  );

  return (
    <article
      className={
        "candidate-card" + (selected ? " candidate-card--selected" : "")
      }
    >
      <div className="candidate-card__heading">
        <div>
          <div className="badge-row">
            <span className="requirement-badge">
              {getRequirementTypeLabel(course)}
            </span>
            {decision.registration.method === "lottery" && (
              <span className="lottery-badge">抽選対象</span>
            )}
            {selected && <span className="selected-badge">候補に追加済み</span>}
            {selected && (
              <span className="lottery-state-badge">
                {getLotteryStatusLabel(lotteryApplication)}
              </span>
            )}
          </div>
          <h2>{course.name}</h2>
        </div>
        <strong className="credit-pill">{course.credits}単位</strong>
      </div>

      <dl className="candidate-facts">
        <div>
          <dt>曜日・時限</dt>
          <dd>
            {hasScheduleOptions
              ? offering.scheduleOptions
                  ?.map((option) => option.label)
                  .join(" / ")
              : formatSlots(offering.slots)}
          </dd>
        </div>
        <div>
          <dt>要件記号</dt>
          <dd>
            {decision.requirements.groups.length > 0
              ? decision.requirements.groups
                  .map((groupId) => progressById.get(groupId)?.symbol)
                  .filter(Boolean)
                  .join("・")
              : "該当なし"}
          </dd>
        </div>
      </dl>

      <section
        className={
          "decision-panel " +
          (decision.timetable.allOptionsConflict
            ? "decision-panel--danger"
            : decision.timetable.hasAnyConflict
              ? "decision-panel--warning"
              : "decision-panel--safe")
        }
        aria-label="時間割判定"
      >
        <h3>{timetableMessage}</h3>
        {decision.timetable.options.map((option) => (
          <p key={option.id}>
            <strong>
              {hasScheduleOptions ? option.label : formatSlots(option.slots)}：
            </strong>
            {option.hasConflict
              ? option.conflictsWith
                  .map((item) => item.courseName)
                  .join("、") + "と重複"
              : "利用可能"}
          </p>
        ))}
        {[...selectedConflicts.values()].map((conflict) => (
          <p className="selected-conflict" key={conflict.courseId}>
            現在選択している{conflict.courseName}と重複しています
          </p>
        ))}
      </section>

      <section className="candidate-impact" aria-label="CAPへの影響">
        <h3>CAPへの影響</h3>
        {decision.cap.creditsAfterAdding === null ? (
          <p>前期状況が未確認のため計算できません。</p>
        ) : (
          <p>
            {selected ? "候補に含めた場合" : "候補に追加した場合"}{" "}
            <strong>
              {decision.cap.creditsAfterAdding} / {decision.cap.limit}単位
            </strong>
          </p>
        )}
        {decision.cap.exceeded && (
          <p className="inline-warning">
            この科目を候補に追加すると年間{decision.cap.limit}
            単位を超える可能性があります
          </p>
        )}
      </section>

      <section className="candidate-impact" aria-label="卒業要件への寄与">
        <h3>卒業要件への寄与</h3>
        {requirementContributions.length === 0 ? (
          <p>卒業要件群への直接対応は未設定です。</p>
        ) : (
          requirementContributions.map((item) => {
            return (
              <div className="requirement-contribution" key={item.groupId}>
                <strong>
                  {item.symbol} {item.label}
                </strong>
                <span>
                  現在 {item.currentCredits} / {item.requiredCredits}単位
                </span>
                <span>
                  修得した場合 {item.creditsIfEarned} /{" "}
                  {item.requiredCredits}単位
                </span>
              </div>
            );
          })
        )}
      </section>

      {offering.notes && offering.notes.length > 0 && (
        <details className="delivery-notes">
          <summary>特殊な授業形式あり</summary>
          <ul>
            {offering.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}

      {removalPending && (
        <div
          className="removal-confirmation"
          role="alertdialog"
          aria-labelledby={`removal-title-${course.id}`}
          aria-describedby={`removal-description-${course.id}`}
        >
          <strong id={`removal-title-${course.id}`}>
            候補から外すと抽選記録もリセットされます
          </strong>
          <p id={`removal-description-${course.id}`}>
            申込状況・希望順位・抽選結果・UNIPA確認状態が削除されます。
          </p>
          <div>
            <button
              className="button button--danger"
              type="button"
              onClick={onConfirmRemoval}
            >
              候補から外してリセット
            </button>
            <button
              className="button button--secondary"
              type="button"
              autoFocus
              onClick={onCancelRemoval}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="candidate-card-actions">
        <Link className="text-link" to={`/courses/${course.id}`}>
          科目詳細
        </Link>
        <button
          className={
            "button " + (selected ? "button--secondary" : "button--primary")
          }
          type="button"
          onClick={onToggle}
          disabled={!selected && decision.eligibility === "ineligible"}
        >
          {selected
            ? "候補から外す"
            : decision.eligibility === "ineligible"
              ? "時間割重複のため追加不可"
              : "履修候補に追加"}
        </button>
        {selected && (
          <Link className="lottery-detail-link" to="/lottery">
            抽選内容を確認
          </Link>
        )}
      </div>
    </article>
  );
}

export function CoursePlanningPage() {
  const { state, dispatch } = useAppState();
  const [pendingRemovalCourseId, setPendingRemovalCourseId] = useState<
    string | null
  >(null);
  const { timetableModel, englishTrack } = state.user;

  if (timetableModel === null || englishTrack === null) {
    return <Navigate to="/setup" replace />;
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
  const resolvedCandidates = candidateCourses.map((course) => ({
    course,
    offering: resolveCandidateOffering({
      courseId: course.id,
      timetableModel,
      academicYear: state.user.academicYear,
      semester: state.user.semester,
      offerings: candidateOfferings,
    }),
  }));
  const candidateCourseIds = new Set(
    candidateCourses.map((course) => course.id),
  );
  const selectedCourseIds = new Set(
    Object.entries(state.plannedCourses)
      .filter(
        ([courseId, value]) =>
          value.selected && candidateCourseIds.has(courseId),
      )
      .map(([courseId]) => courseId),
  );
  const selectedCandidateCourses = candidateCourses.filter((course) =>
    selectedCourseIds.has(course.id),
  );
  const wonCandidateCourses = candidateCourses.filter(
    (course) => {
      const application = state.lotteries[course.id];
      return (
        selectedCourseIds.has(course.id) &&
        application?.applicationStatus === "applied" &&
        application.resultStatus === "won"
      );
    },
  );
  const firstSemesterCourses = [
    ...firstSemesterRequiredCourses,
    ...firstSemesterElectiveCourses,
  ];
  const cap = calculateCap({
    firstSemester: state.firstSemester,
    firstSemesterCourses,
    requiredSecondSemesterCourses: requiredTimetable.courses.map(
      ({ course }) => course,
    ),
    selectedCandidateCourses,
    wonCandidateCourses,
    capLimit: registrationRules.annualCap,
  });
  const progress = calculateRequirementProgress({
    firstSemester: state.firstSemester,
    firstSemesterCourses,
    requirements: graduationRequirements.requirements,
  });
  const requiredSchedules: ScheduledCourse[] = requiredTimetable.courses.map(
    ({ course, offering }) => ({
      courseId: course.id,
      courseName: course.name,
      slots: offering.slots,
    }),
  );
  const englishTrackLabel =
    englishTrackChoices.find((choice) => choice.value === englishTrack)?.label ??
    englishTrack;

  return (
    <main className="planning-page">
      <div className="planning-shell">
        <header className="planning-header">
          <div>
            <p className="eyebrow">
              {state.user.academicYear}年度・{state.user.grade}年生後期
            </p>
            <h1>後期履修プラン</h1>
            <p className="planning-subtitle">
              {timetableModel}モデル / {englishTrackLabel}
            </p>
          </div>
          <Link className="button button--secondary" to="/timetable">
            必修時間割へ戻る
          </Link>
        </header>

        <section
          className="cap-summary"
          aria-labelledby="cap-heading"
          aria-live="polite"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Annual credit cap</p>
              <h2 id="cap-heading">年間履修上限</h2>
            </div>
            <strong>{cap.limit}単位</strong>
          </div>
          {cap.confirmedAnnualCredits === null ? (
            <div className="cap-unknown">
              <p>
                前期履修状況に未確認の科目があるため、現在CAPを確定できません。
              </p>
              <Link to="/setup/first-semester/required">
                前期状況を確認する
              </Link>
            </div>
          ) : (
            <div className="cap-metrics cap-metrics--three">
              <div>
                <span>確定</span>
                <strong>
                  {cap.confirmedAnnualCredits} / {cap.limit}単位
                </strong>
                <small>前期履修登録 + 後期必修</small>
              </div>
              <div className={cap.exceeded ? "cap-metric--danger" : undefined}>
                <span>全候補に当選した場合</span>
                <strong>
                  {cap.maximumAnnualCredits} / {cap.limit}単位
                </strong>
                <small>抽選結果・履修登録は未確定</small>
              </div>
              <div
                className={
                  cap.resultExceeded ? "cap-metric--danger" : undefined
                }
              >
                <span>現在の当選結果</span>
                <strong>
                  {cap.resultReflectedAnnualCredits} / {cap.limit}単位
                </strong>
                <small>当選科目を含む（UNIPA確認状態とは別）</small>
              </div>
            </div>
          )}
          {cap.exceeded && (
            <p className="cap-alert" role="alert">
              現在の候補をすべて含めると年間履修上限を超えます。
              候補は自動で解除されません。
            </p>
          )}
        </section>

        <section
          className="requirement-summary"
          aria-labelledby="requirement-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Earned credits</p>
              <h2 id="requirement-heading">現在の選択必修修得状況</h2>
            </div>
          </div>
          <p className="section-description">
            前期までに修得済みと回答した科目だけを集計しています。
          </p>
          <div className="requirement-progress-grid">
            {progress.map((item) => (
              <div className="requirement-progress-item" key={item.groupId}>
                <span>
                  {item.symbol} {item.label}
                </span>
                <strong>
                  {item.earnedCredits} / {item.requiredCredits}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section
          className="candidate-section"
          aria-labelledby="candidate-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Course candidates</p>
              <h2 id="candidate-heading">後期の履修候補</h2>
            </div>
            <span className="candidate-count">
              {selectedCourseIds.size} / {candidateCourses.length}科目を検討中
            </span>
          </div>
          <p className="section-description">
            「候補に追加」は当選・履修登録済みを意味しません。申込状況と結果は抽選画面で記録します。
          </p>
          <div className="candidate-grid">
            {resolvedCandidates.map(({ course, offering }) => {
              const selected = selectedCourseIds.has(course.id);
              const selectedSchedules: ScheduledCourse[] = resolvedCandidates
                .filter(
                  (candidate) =>
                    candidate.course.id !== course.id &&
                    selectedCourseIds.has(candidate.course.id),
                )
                .map((candidate) => ({
                  courseId: candidate.course.id,
                  courseName: candidate.course.name,
                  slots: getOfferingSlots(candidate.offering),
                }));
              const decision = evaluateCandidateCourse({
                course,
                offering,
                existingCourses: [...requiredSchedules, ...selectedSchedules],
                cap,
                requirementProgress: progress,
                isSelected: selected,
              });

              return (
                <CandidateCard
                  course={course}
                  offering={offering}
                  decision={decision}
                  progress={progress}
                  selected={selected}
                  selectedCourseIds={selectedCourseIds}
                  lotteryApplication={state.lotteries[course.id]}
                  removalPending={pendingRemovalCourseId === course.id}
                  onToggle={() => {
                    if (!selected) {
                      dispatch({ type: "SELECT_COURSE", payload: course.id });
                    } else if (hasLotteryActivity(state.lotteries[course.id])) {
                      setPendingRemovalCourseId(course.id);
                    } else {
                      dispatch({
                        type: "UNSELECT_COURSE_AND_RESET_LOTTERY",
                        payload: course.id,
                      });
                    }
                  }}
                  onConfirmRemoval={() => {
                    dispatch({
                      type: "UNSELECT_COURSE_AND_RESET_LOTTERY",
                      payload: course.id,
                    });
                    setPendingRemovalCourseId(null);
                  }}
                  onCancelRemoval={() => setPendingRemovalCourseId(null)}
                  key={course.id}
                />
              );
            })}
          </div>
        </section>

        <div className="planning-next-action planning-next-action--split">
          <Link className="button button--primary" to="/lottery">
            抽選申込を確認する
          </Link>
          <Link className="button button--secondary" to="/special">
            特殊科目を確認する
          </Link>
        </div>
      </div>
    </main>
  );
}
