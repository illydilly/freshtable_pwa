// client/src/components/Modal.jsx

/**
 * #1 Fix: 모달이 뷰포트(h-screen) 밖으로 넘치지 않도록 구조 변경.
 * - 바깥 박스: max-h-[90vh] + flex flex-col 로 전체 높이 상한 고정
 * - 헤더: shrink-0 으로 항상 고정 표시
 * - 본문(children): flex-1 + min-h-0 + overflow-y-auto 로 내용이 많으면 자체 스크롤
 * 이 변경은 앱 전체 모달에 공통 적용되어, 어떤 페이지에서 폼이 길어져도
 * 화면 밖으로 잘리는 문제가 재발하지 않도록 한다.
 */
export function Modal({ open, onClose, title, children, className = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col rounded-[32px] border border-border bg-white shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
