import { useState, useEffect } from "react";
import { Terminal, Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useStore } from "../store";
import * as api from "../lib/tauri-api";

export default function LoginPage() {
  const { setUserSession } = useStore();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [loadingClientId, setLoadingClientId] = useState(true);

  useEffect(() => {
    api.authGetClientId().then((saved) => {
      if (saved) setClientId(saved);
      setLoadingClientId(false);
    }).catch(() => setLoadingClientId(false));
  }, []);

  const handleLogin = async () => {
    if (!clientId.trim()) {
      setError("Vui lòng nhập Google Client ID.");
      setShowSetup(true);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const session = await api.authLogin(clientId.trim(), clientSecret.trim());
      setUserSession(session);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (loadingClientId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCredentials = clientId.trim().length > 0;

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-4">
      {/* Logo + App name */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Terminal className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">TermiusClone</h1>
          <p className="mt-1 text-sm text-muted-foreground">SSH Client Manager</p>
        </div>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-center text-lg font-semibold">Đăng nhập</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sử dụng tài khoản Google để tiếp tục
        </p>

        {/* Google Sign-In button */}
        <button
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleLogin}
          disabled={loading || !hasCredentials}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {loading ? "Đang mở trình duyệt..." : "Đăng nhập bằng Google"}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Setup section */}
        <div className="mt-4">
          <button
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowSetup(!showSetup)}
          >
            <span>
              {hasCredentials ? "Thay đổi cấu hình Google OAuth" : "Cấu hình Google OAuth (bắt buộc)"}
            </span>
            {showSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showSetup && (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Tạo OAuth Client tại{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5 hover:no-underline"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → Chọn loại <strong>Desktop app</strong>.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Client ID</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring allow-select"
                    placeholder="xxx.apps.googleusercontent.com"
                    value={clientId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Client Secret</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring allow-select"
                    type="password"
                    placeholder="GOCSPX-..."
                    value={clientSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientSecret(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Copy Client ID và Client Secret, nhập vào đây rồi nhấn đăng nhập.
              </p>
            </div>
          )}
        </div>

        {/* Prompt when no credentials */}
        {!hasCredentials && !showSetup && (
          <p className="mt-3 text-center text-xs text-amber-500">
            Cần cấu hình Google OAuth trước khi đăng nhập
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Dữ liệu chỉ lưu cục bộ trên máy của bạn
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
