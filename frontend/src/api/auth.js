import api from "../lib/api";

// Forgot password (request reset link)
export function requestPasswordReset(email) {
  return api.post("/auth/forgot-password", { email });
}

// Reset password (submit new password)
export function resetPassword(token, newPassword) {
  return api.post("/auth/reset-password", {
    token,
    newPassword,
  });
}

// Google login (ID token exchange)
export function loginWithGoogleIdToken(idToken) {
  return api.post("/auth/google", { idToken });
}
