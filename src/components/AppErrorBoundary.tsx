import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  private resetBoundary = () => {
    this.setState({ hasError: false });
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Application data error", error, info);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="error-page">
        <section className="error-card" role="alert">
          <p className="eyebrow">Data error</p>
          <h1>データの読み込み中に問題が発生しました</h1>
          <p>このアプリの年度データに不整合がある可能性があります。</p>
          <p>入力済みデータはブラウザに保存されています。</p>
          <a className="button button--primary" href="#/home" onClick={this.resetBoundary}>ホームへ戻る</a>
        </section>
      </main>
    );
  }
}
