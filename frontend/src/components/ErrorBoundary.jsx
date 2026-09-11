import React from "react";

/**
 * 어딘가에서 오류가 나도 흰 화면이 되지 않게 막고, 무슨 오류인지 화면에 보여준다.
 * 오류 내용을 눈으로 확인할 수 있어야 원인을 찾을 수 있다.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error);
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="card px-4 py-4" style={{ borderColor: "var(--danger)" }}>
          <div className="text-[15px] font-bold mb-1.5" style={{ color: "var(--danger)" }}>
            화면을 그리다 오류가 났습니다
          </div>
          <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
            저장된 데이터는 그대로입니다. 아래 내용을 복사해서 알려주시면 고칠 수 있습니다.
          </p>
          <pre
            className="text-[11px] p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap"
            style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
          >
            {msg}
          </pre>
          <button
            type="button"
            onClick={() => location.reload()}
            className="w-full mt-3 py-2.5 rounded-xl text-[13px] font-bold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }
}
