import { Link, useNavigate } from "react-router-dom";
import { SetupLayout } from "../components/setup/SetupLayout";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
  englishTrackChoices,
} from "../data/2026/setup";
import {
  selectAreFirstSemesterCoursesComplete,
  selectFirstSemesterStatusCounts,
  selectInnovationMethodSetupSummary,
  selectIsBasicSetupComplete,
  selectIsFirstSemesterRequiredComplete,
} from "../state/selectors";
import { useAppState } from "../state/useAppState";

const requiredCourseIds = firstSemesterRequiredCourses.map(
  (course) => course.id,
);
const electiveCourseIds = firstSemesterElectiveCourses.map(
  (course) => course.id,
);

function StatusCounts({
  counts,
}: {
  counts: ReturnType<typeof selectFirstSemesterStatusCounts>;
}) {
  return (
    <dl className="count-grid">
      <div>
        <dt>修得済み</dt>
        <dd>{counts.earned}科目</dd>
      </div>
      <div>
        <dt>未修得</dt>
        <dd>{counts.failed}科目</dd>
      </div>
      <div>
        <dt>未履修</dt>
        <dd>{counts.notTaken}科目</dd>
      </div>
      <div>
        <dt>未確認</dt>
        <dd>{counts.unknown}科目</dd>
      </div>
    </dl>
  );
}

export function SetupReviewPage() {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();
  const requiredCounts = selectFirstSemesterStatusCounts(
    state,
    requiredCourseIds,
  );
  const electiveCounts = selectFirstSemesterStatusCounts(
    state,
    electiveCourseIds,
  );
  const innovationSummary = selectInnovationMethodSetupSummary(state);
  const isReady =
    selectIsBasicSetupComplete(state) &&
    selectIsFirstSemesterRequiredComplete(state, requiredCourseIds) &&
    selectAreFirstSemesterCoursesComplete(state, electiveCourseIds) &&
    innovationSummary.isComplete;

  function completeSetup() {
    if (!isReady) return;
    dispatch({ type: "SET_SETUP_COMPLETED", payload: true });
    navigate("/setup/complete");
  }

  return (
    <SetupLayout
      step={5}
      title="入力内容の確認"
      description={<p>内容を確認し、必要な項目は修正してください。</p>}
      actions={
        <>
          <Link
            className="button button--secondary"
            to="/setup/innovation-method"
          >
            戻る
          </Link>
          <button
            className="button button--primary"
            type="button"
            disabled={!isReady}
            onClick={completeSetup}
          >
            この内容で設定を完了
          </button>
        </>
      }
    >
      <section className="review-card">
        <div className="review-card__heading">
          <h2>基本設定</h2>
          <Link to="/setup">修正</Link>
        </div>
        <dl className="review-list">
          <div>
            <dt>時間割モデル</dt>
            <dd>{state.user.timetableModel ?? "未回答"}</dd>
          </div>
          <div>
            <dt>英語クラス</dt>
            <dd>
              {englishTrackChoices.find(
                (choice) => choice.value === state.user.englishTrack,
              )?.label ?? "未回答"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="review-card">
        <div className="review-card__heading">
          <h2>前期必修</h2>
          <Link to="/setup/first-semester/required">修正</Link>
        </div>
        <StatusCounts counts={requiredCounts} />
      </section>

      <section className="review-card">
        <div className="review-card__heading">
          <h2>前期選択必修・選択</h2>
          <Link to="/setup/first-semester/electives">修正</Link>
        </div>
        <StatusCounts counts={electiveCounts} />
      </section>

      <section className="review-card">
        <div className="review-card__heading">
          <h2>イノベーション技法</h2>
          <Link to="/setup/innovation-method">修正</Link>
        </div>
        <dl className="review-list">
          <div>
            <dt>前期履修</dt>
            <dd>{innovationSummary.registrationLabel}</dd>
          </div>
          <div>
            <dt>モジュール</dt>
            <dd>{innovationSummary.moduleLabel}</dd>
          </div>
        </dl>
      </section>

      {!isReady && (
        <p className="validation-message" role="alert">
          未回答の項目があります。「修正」から入力を完了してください。
        </p>
      )}
    </SetupLayout>
  );
}
