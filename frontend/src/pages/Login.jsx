import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchCurrentUser, login } from "../api/api";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

function Login() {
  // router helpers for redirecting after auth
  const navigate = useNavigate();
  const location = useLocation();
  // auth context updater for globally signed-in user
  const { setUser } = useAuth();

  // resolve where to send user after successful login
  const redirectPath = location.state?.returnTo || location.state?.from || "/profile";
  // carry optional action intent back to destination page
  const pendingIntent = location.state?.intent || null;

  // controlled input states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBlurReady, setIsBlurReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsBlurReady(true));
  }, []);

  // handle login request and restore auth user
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      // request token using entered credentials
      const tokenResponse = await login({ username, password });
      // store token for authenticated api requests
      localStorage.setItem("access_token", tokenResponse.access_token);

      // fetch current user profile and sync auth context
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);

      // keep pending intent if caller sent one in route state
      if (redirectPath && pendingIntent) {
        navigate(redirectPath, { state: { intent: pendingIntent }, replace: true });
      } else {
        navigate(redirectPath, { replace: true });
      }
    } catch {
      setErrorMessage("Invalid username or password.");
    } finally {
      // release submit lock
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`auth-login ${isBlurReady ? "auth-login--blur-in" : ""}`}>
      <img
        className="auth-login__bg"
        src="/login-bg.webp"
        alt=""
        aria-hidden="true"
        fetchpriority="high"
        loading="eager"
        decoding="async"
      />

      <div className="auth-login__overlay" aria-hidden="true" />

      <div className="auth-login__card">
        <h1 className="auth-login__title">Log In</h1>

        {errorMessage && <p className="auth-login__error">{errorMessage}</p>}

        <form onSubmit={handleSubmit} className="auth-login__form">
          <label className="auth-login__label">
            <span>Username</span>
            <input
              className="auth-login__input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              required
            />
          </label>

          <label className="auth-login__label">
            <span>Password</span>
            <div className="auth-login__password-wrap">
              <input
                className="auth-login__input"
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-login__toggle-pass"
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              >
                {isPasswordVisible ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button className="auth-login__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "SIGN IN"}
          </button>
        </form>

        <p className="auth-login__foot">
          Don't have an account?{" "}
          <Link to="/signup" state={location.state}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
