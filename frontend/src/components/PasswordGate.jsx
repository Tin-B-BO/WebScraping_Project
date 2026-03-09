import React, { useEffect, useState } from "react";
import "../styles/PasswordGate.css";

const RESEARCH_ACCESS_KEY = import.meta.env.VITE_RESEARCH_ACCESS_KEY;

const PasswordGate = ({ children }) => {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("research_auth") === "true") {
      setAuthorized(true);
    }
  }, []);

  const handleVerify = (e) => {
    e.preventDefault();
    const trimmedPassword = password.trim();

    if (!RESEARCH_ACCESS_KEY) {
      setMessage("Access key is not configured. Please set VITE_RESEARCH_ACCESS_KEY.");
      return;
    }

    if (!trimmedPassword) {
      setMessage("Please enter the access key.");
      return;
    }

    if (trimmedPassword === RESEARCH_ACCESS_KEY) {
      setAuthorized(true);
      sessionStorage.setItem("research_auth", "true");
      setMessage("");
    } else {
      setMessage("Incorrect password. Please check Dissertation Report Appendix N.2.");
    }
  };

  if (!authorized) {
    return (
      <div className="password-gate">
        <div className="password-gate__card">
          <h2 className="password-gate__title">Research Prototype Access</h2>
          <p>This site is restricted to academic examiners and testers.</p>
          <form onSubmit={handleVerify}>
            <input
              className="password-gate__input"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (message) {
                  setMessage("");
                }
              }}
              placeholder="Enter Access Key"
            />
            {message && (
              <p className="password-gate__message" role="alert" aria-live="polite">
                {message}
              </p>
            )}
            <button type="submit" className="password-gate__submit">
              Enter Prototype
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PasswordGate;
