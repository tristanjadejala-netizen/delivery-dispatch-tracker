import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function GoogleSignInButton() {
  const btnRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // Load Google Identity Services script
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError(
        "Google Sign-In is not configured (missing VITE_GOOGLE_CLIENT_ID)."
      );
      return;
    }

    // Already loaded
    if (window.google?.accounts?.id) {
      setReady(true);
      return;
    }

    // Avoid loading script multiple times
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    script.onerror = () =>
      setError("Failed to load Google Sign-In script.");
    document.body.appendChild(script);
  }, []);

  // Initialize & render Google button
  useEffect(() => {
    if (!ready || !btnRef.current) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    btnRef.current.innerHTML = "";

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        setError("");

        try {
          // 🔑 GOOGLE SIGNUP (one-time)
          const { data } = await api.post("/auth/google-signup", {
            idToken: response.credential,
          });

          // Store temporary signup state (NOT auth token)
          sessionStorage.setItem("signupToken", data.signupToken);
          sessionStorage.setItem("signupEmail", data.email);

          // Redirect to password creation
          navigate("/complete-signup");
        } catch (e) {
          const status = e?.response?.status;
          const msg = e?.response?.data?.message;

          if (status === 409) {
            setError(
              "An account with this email already exists. Please log in."
            );
            return;
          }

          setError(msg || "Google sign-up failed. Please try again.");
        }
      },
    });

    window.google.accounts.id.renderButton(btnRef.current, {
      theme: "outline",
      size: "large",
      width: "100%",
      text: "continue_with",
    });
  }, [ready, navigate]);

  return (
    <div>
      <div ref={btnRef} />
      {error && (
        <p style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
