import { useEffect, useState } from "react";
import {
  englishTrackChoices,
  firstSemesterSetupData,
  timetableModelChoices,
} from "../data/2026/setup";
import { useAppState } from "../state/useAppState";
import { STORAGE_KEY } from "../storage/localStorage";

export function DebugPage() {
  const { state, dispatch } = useAppState();
  const [savedStatePreview, setSavedStatePreview] = useState("未保存");
  const firstModel = timetableModelChoices.at(0);
  const advancedTrack = englishTrackChoices.find(
    (choice) => choice.value === "advanced",
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedStatePreview(window.localStorage.getItem(STORAGE_KEY) ?? "未保存");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <main className="debug-page">
      <header className="debug-page__header">
        <div>
          <p className="eyebrow">Phase 1 Debug</p>
          <h1>{firstSemesterSetupData.applicationName}</h1>
          <p className="intro">
            {firstSemesterSetupData.academicYear}年度入学・
            {firstSemesterSetupData.target.grade}
            年生後期向けの状態管理と端末内保存を確認するページです。
          </p>
        </div>
        <span className="version-badge">schema v{state.schemaVersion}</span>
      </header>

      <dl className="summary-grid" aria-label="現在の主要な状態">
        <div className="summary-card">
          <dt>timetableModel</dt>
          <dd>{state.user.timetableModel ?? "未選択"}</dd>
        </div>
        <div className="summary-card">
          <dt>englishTrack</dt>
          <dd>{state.user.englishTrack ?? "未選択"}</dd>
        </div>
        <div className="summary-card">
          <dt>setupCompleted</dt>
          <dd>{String(state.setupCompleted)}</dd>
        </div>
      </dl>

      <section className="panel" aria-labelledby="state-actions-heading">
        <h2 id="state-actions-heading">状態を変更</h2>
        <div className="button-row">
          {firstModel && (
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "SET_TIMETABLE_MODEL",
                  payload: firstModel.value,
                })
              }
            >
              {firstModel.label}に変更
            </button>
          )}
          {advancedTrack && (
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: "SET_ENGLISH_TRACK",
                  payload: advancedTrack.value,
                })
              }
            >
              {advancedTrack.label}に変更
            </button>
          )}
          <button
            className="button-danger"
            type="button"
            onClick={() => dispatch({ type: "RESET_APP" })}
          >
            stateをリセット
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="storage-heading">
        <h2 id="storage-heading">LocalStorage保存確認</h2>
        <div className="storage-status">
          <span>
            保存キー: <code>{STORAGE_KEY}</code>
          </span>
          <span>
            保存状態: {savedStatePreview === "未保存" ? "未保存" : "保存済み"}
          </span>
        </div>
      </section>

      <section className="panel" aria-labelledby="app-state-heading">
        <h2 id="app-state-heading">現在のAppState</h2>
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </section>
    </main>
  );
}
