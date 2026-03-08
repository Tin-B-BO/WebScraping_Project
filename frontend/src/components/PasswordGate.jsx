import React, { useEffect, useState } from "react";
import "../styles/PasswordGate.css";

const PasswordGate = ({ children }) => {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("research_auth") === "true") {
      setAuthorized(true);
    }
  }, []);

  const handleVerify = (e) => {
    e.preventDefault();
    if (password === "dissertation2026") {
      setAuthorized(true);
      sessionStorage.setItem("research_auth", "true");
    } else {
      alert("Incorrect password. Please check Dissertation Report Appendix N.2");
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Access Key"
            />
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
