import { useCallback, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { ToastContext, type ToastType } from "./ToastContext";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const STYLES: Record<ToastType, { bg: string; icon: ReactNode }> = {
  success: {
    bg: "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))",
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    bg: "#dc2626",
    icon: <XCircle size={18} />,
  },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className="flex items-start gap-2 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg animate-[toast-in_0.2s_ease-out]"
            style={{ background: STYLES[t.type].bg }}
          >
            <span className="mt-0.5 shrink-0">{STYLES[t.type].icon}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-80 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
