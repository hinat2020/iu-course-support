import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { academicDataMetadata } from "../data/2026/metadata";
import { useAppState } from "../state/useAppState";

export function SettingsPage() {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  if (!state.setupCompleted) return <Navigate to="/setup" replace />;

  return (
    <main className="settings-page">
      <div className="page-shell settings-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Preferences &amp; data</p>
            <h1>設定</h1>
            <p>登録済みの内容は、各セットアップ画面で変更できます。</p>
          </div>
          <Link className="button button--secondary" to="/home">
            ホームへ戻る
          </Link>
        </header>

        <aside className="notice notice--warning" role="note">
          <strong>モデル・英語トラックを変更する前に</strong>
          <p>
            保存済み抽選希望と時間割が合わなくなる可能性があります。変更後に履修候補・抽選内容を再確認してください。抽選記録は自動削除されません。
          </p>
        </aside>

        <section className="settings-section" aria-labelledby="settings-basic-heading">
          <div>
            <p className="section-kicker">Basic setup</p>
            <h2 id="settings-basic-heading">基本設定</h2>
          </div>
          <dl className="settings-current-values">
            <div><dt>時間割モデル</dt><dd>{state.user.timetableModel ?? "未設定"}</dd></div>
            <div><dt>英語トラック</dt><dd>{state.user.englishTrack === "advanced" ? "Advanced" : state.user.englishTrack === "normal" ? "通常" : "未設定"}</dd></div>
          </dl>
          <Link className="button button--secondary" to="/setup">基本設定を変更</Link>
        </section>

        <section className="settings-section" aria-labelledby="settings-first-heading">
          <div>
            <p className="section-kicker">First semester</p>
            <h2 id="settings-first-heading">前期履修状況</h2>
          </div>
          <div className="settings-link-list">
            <Link to="/setup/first-semester/required">前期必修を変更</Link>
            <Link to="/setup/first-semester/electives">前期選択必修・選択を変更</Link>
            <Link to="/setup/innovation-method">イノベーション技法の前期状況を変更</Link>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-data-heading">
          <div>
            <p className="section-kicker">Data source</p>
            <h2 id="settings-data-heading">対応データ</h2>
          </div>
          <dl className="settings-current-values">
            <div><dt>対応年度</dt><dd>{academicDataMetadata.academicYear}年度</dd></div>
            <div><dt>対象</dt><dd>{academicDataMetadata.target.admissionYear}年度入学・{academicDataMetadata.target.grade}年生後期</dd></div>
            <div><dt>データ更新日</dt><dd>{academicDataMetadata.lastUpdated}</dd></div>
          </dl>
          <p className="settings-disclaimer">
            大学の公式資料をもとに作成した非公式ツールです。内容の正確性を保証するものではありません。最終確認はUNIPA・大学公式資料で行ってください。
          </p>
        </section>

        <section className="settings-section settings-danger-zone" aria-labelledby="settings-reset-heading">
          <div>
            <p className="section-kicker">Local data</p>
            <h2 id="settings-reset-heading">すべてのデータを初期化</h2>
          </div>
          <p>このブラウザに保存された履修状況・候補・抽選結果・特殊科目の記録を初期状態へ戻します。</p>
          {!showResetConfirmation ? (
            <button className="button button--danger" type="button" onClick={() => setShowResetConfirmation(true)}>
              すべてのデータを初期化
            </button>
          ) : (
            <div
              className="reset-confirmation"
              role="alertdialog"
              aria-labelledby="reset-confirmation-title"
              aria-describedby="reset-confirmation-description"
            >
              <strong id="reset-confirmation-title">本当に初期化しますか？</strong>
              <p id="reset-confirmation-description">
                入力した履修状況・候補・抽選結果などが削除されます。
              </p>
              <div className="button-row">
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() => {
                    dispatch({ type: "RESET_APP" });
                    navigate("/", { replace: true });
                  }}
                >
                  初期化を実行
                </button>
                <button className="button button--secondary" type="button" autoFocus onClick={() => setShowResetConfirmation(false)}>
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
