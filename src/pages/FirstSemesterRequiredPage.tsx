import { useState } from "react";
import { CourseStatusList } from "../components/setup/CourseStatusList";
import { SetupActions } from "../components/setup/SetupActions";
import { SetupLayout } from "../components/setup/SetupLayout";
import { firstSemesterRequiredCourses } from "../data/2026/setup";
import { selectIsFirstSemesterRequiredComplete } from "../state/selectors";
import { useAppState } from "../state/useAppState";

const requiredCourseIds = firstSemesterRequiredCourses.map(
  (course) => course.id,
);

const requiredStatusChoices = [
  { value: "earned", label: "修得済み" },
  { value: "failed", label: "履修したが未修得" },
  { value: "not_taken", label: "履修しなかった" },
  { value: "unknown", label: "わからない" },
] as const;

export function FirstSemesterRequiredPage() {
  const { state, dispatch } = useAppState();
  const [showDetails, setShowDetails] = useState(() =>
    requiredCourseIds.some(
      (courseId) => state.firstSemester.courses[courseId] !== undefined,
    ),
  );
  const isComplete = selectIsFirstSemesterRequiredComplete(
    state,
    requiredCourseIds,
  );

  function markAllEarned() {
    dispatch({
      type: "SET_ALL_REQUIRED_COURSES_EARNED",
      payload: { courseIds: requiredCourseIds },
    });
    setShowDetails(false);
  }

  return (
    <SetupLayout
      step={2}
      title="1年前期の必修科目"
      description={<p>UNIPAの成績照会を確認してください。</p>}
      actions={
        <SetupActions
          backTo="/setup"
          nextTo="/setup/first-semester/electives"
          nextDisabled={!isComplete}
        />
      }
    >
      <section className="decision-panel" aria-labelledby="required-answer-title">
        <h2 id="required-answer-title">当てはまる方を選んでください</h2>
        <div className="decision-grid">
          <button type="button" onClick={markAllEarned}>
            <strong>すべて修得した</strong>
            <span>
              {firstSemesterRequiredCourses.length}科目すべてを修得済みにします
            </span>
          </button>
          <button type="button" onClick={() => setShowDetails(true)}>
            <strong>未修得・確認中の科目がある</strong>
            <span>科目ごとに状態を入力します</span>
          </button>
        </div>
      </section>

      {showDetails ? (
        <CourseStatusList
          courses={firstSemesterRequiredCourses}
          choices={requiredStatusChoices}
        />
      ) : isComplete ? (
        <p className="completion-note" role="status">
          すべての必修科目を「修得済み」として記録しました。必要なら「未修得・確認中の科目がある」から修正できます。
        </p>
      ) : (
        <p className="form-hint">どちらかを選択すると入力を続けられます。</p>
      )}
    </SetupLayout>
  );
}
