import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function CompleteSignup() {
  const nav = useNavigate();
  const email = sessionStorage.getItem("signupEmail");
  const signupToken = sessionStorage.getItem("signupToken");

  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (!signupToken) {
    nav("/register");
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post("/auth/complete-signup", {
        signupToken,
        password,
      });

      // ✅ Requirement: user logs in using email + the created password
      sessionStorage.clear();
      nav("/login", {
        replace: true,
        state: {
          email,
          flash: "Account created. Please log in using your email and password.",
        },
      });
    } catch (e) {
      setErr("Signup failed or expired");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 20px 50px rgba(11,18,32,0.12)",
          display: "grid",
          gap: 12,
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 950, color: "#0b1220" }}>
            Create a password
          </h2>
          <div style={{ fontSize: 12, color: "#5b6474", lineHeight: 1.5 }}>
            You selected <b>{email}</b>. Create a password for this account.
          </div>
        </div>

        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            height: 42,
            padding: "0 12px",
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.12)",
            outline: "none",
            color: "#0b1220",
          }}
        />

        {err && (
          <div
            style={{
              padding: 10,
              borderRadius: 14,
              background: "rgba(255, 238, 240, 0.95)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              color: "#9f1239",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        )}

        <button
          type="submit"
          style={{
            height: 42,
            borderRadius: 14,
            border: 0,
            cursor: "pointer",
            fontWeight: 950,
            color: "#fff",
            background:
              "linear-gradient(90deg, rgba(0,112,255,1) 0%, rgba(0,112,255,1) 35%, rgba(255,126,24,1) 100%)",
            boxShadow: "0 18px 40px rgba(0,112,255,0.18)",
          }}
        >
          Create account
        </button>

        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
          After creating your password, you’ll log in normally using your email and password.
        </div>
      </form>
    </div>
  );
}
