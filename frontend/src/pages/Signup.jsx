import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchCurrentUser, signup } from "../api/api";
import { useAuth } from "../context/AuthContext";
import "../styles/Signup.css";

const ALLERGEN_OPTIONS = [
  "celery", "cereals containing gluten", "crustaceans", "eggs", "fish",
  "lupin", "milk", "molluscs", "mustard", "peanuts", "sesame",
  "soybeans", "sulphur dioxide and sulphites", "tree nuts",
];

function Signup() {
  // router helpers used for post-signup redirects
  const navigate = useNavigate();
  const location = useLocation();
  // auth context updater for global user state
  const { setUser } = useAuth();

  // resolve destination and optional intent from incoming route state
  const redirectPath = location.state?.returnTo || location.state?.from || "/";
  const pendingIntent = location.state?.intent || null;

  // controlled text inputs
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // selected allergen preferences for new account
  const [selectedAllergens, setSelectedAllergens] = useState([]);

  // ui state for password visibility and submit progress
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // user-facing error state and background transition state
  const [errorMessage, setErrorMessage] = useState("");
  const [isBlurReady, setIsBlurReady] = useState(false);

  // trigger background blur transition after first paint
  useEffect(() => {
    requestAnimationFrame(() => setIsBlurReady(true));
  }, []);

  // toggle one allergen in local selection
  const toggleAllergen = (allergenName) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergenName)
        ? prev.filter((name) => name !== allergenName)
        : [...prev, allergenName]
    );
  };

  // submit signup request, store token, hydrate user, and redirect
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const tokenResponse = await signup({
        username,
        email,
        password,
        allergens: selectedAllergens,
      });

      // store token for authenticated requests after signup
      localStorage.setItem("access_token", tokenResponse.access_token);
      // fetch current user profile and sync auth context
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);

      // preserve pending intent when redirecting from protected actions
      if (redirectPath && pendingIntent) {
        navigate(redirectPath, { state: { intent: pendingIntent }, replace: true });
      } else {
        navigate(redirectPath, { replace: true });
      }
    } catch {
      // show generic signup failure message
      setErrorMessage("Signup failed. Username/email may already exist.");
    } finally {
      // release submit lock
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`auth-signup ${isBlurReady ? "auth-signup--blur-in" : ""}`}>
      <img
        className="auth-signup__bg"
        src="/login-bg.webp"
        alt=""
        aria-hidden="true"
        fetchpriority="high"
        loading="eager"
        decoding="async"
      />

      <div className="auth-signup__overlay" aria-hidden="true" />

      <div className="auth-signup__card">
        <h1 className="auth-signup__title">Sign Up</h1>
        <p className="auth-signup__subtitle">Create your account</p>

        {errorMessage && <p className="auth-signup__error">{errorMessage}</p>}

        <form onSubmit={handleSubmit} className="auth-signup__form">
          <div className="auth-signup__grid">
            <label className="auth-signup__label">
              <span>Username</span>
              <input
                className="auth-signup__input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                required
              />
            </label>

            <label className="auth-signup__label">
              <span>Email</span>
              <input
                className="auth-signup__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-signup__label auth-signup__span2">
              <span>Password</span>
              <div className="auth-signup__password-wrap">
                <input
                  className="auth-signup__input"
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-signup__toggle-pass"
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
          </div>

          <div className="auth-signup__allergens">
            <p className="auth-signup__allergens-title">Please Select Your Allergen/s</p>
            <div className="auth-signup__allergen-grid">
              {ALLERGEN_OPTIONS.map((allergenName) => (
                <label key={allergenName} className="auth-signup__allergen-item">
                  <input
                    type="checkbox"
                    checked={selectedAllergens.includes(allergenName)}
                    onChange={() => toggleAllergen(allergenName)}
                  />
                  <span>{allergenName}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="auth-signup__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className="auth-signup__foot">
          Already have an account?{" "}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
