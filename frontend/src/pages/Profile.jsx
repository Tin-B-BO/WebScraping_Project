import React, { useEffect, useState } from "react";
import { fetchSaved, updateMyAllergens, updatePassword } from "../api/api";
import SearchResultCard from "../components/SearchResultCard";
import { useAuth } from "../context/AuthContext";
import Login from "./Login";
import "../styles/Profile.css";

const ALLERGEN_OPTIONS = [
  "celery", "cereals containing gluten", "crustaceans", "eggs",
  "fish", "lupin", "milk", "molluscs", "mustard", "peanuts",
  "sesame", "soybeans", "sulphur dioxide and sulphites", "tree nuts",
];

function Profile() {
  // auth context for current user data and profile sync updates
  const { user, setUser } = useAuth();
  // controls which profile section is currently visible
  const [activeTab, setActiveTab] = useState("saved");

  // local draft state for allergen preferences before save
  const [selectedAllergensDraft, setSelectedAllergensDraft] = useState([]);
  // loading and data state for allergen save and saved recipes fetch
  const [isSavingAllergens, setIsSavingAllergens] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [isSavedLoading, setIsSavedLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // shared modal state for success or error feedback
  const [modalState, setModalState] = useState({ show: false, msg: "", type: "success" });

  // password form state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // sync draft allergens from current user profile
  useEffect(() => {
    if (user) {
      setSelectedAllergensDraft(user.allergens || []);
    }
  }, [user, activeTab]);

  // load saved recipes when saved tab is active
  useEffect(() => {
    if (!user) return;
    if (activeTab === "saved") {
      let alive = true;

      (async () => {
        setIsSavedLoading(true);
        setStatusMessage("");

        try {
          const response = await fetchSaved();
          if (!alive) return;

          const fetchedSavedRecipes = response.items || [];
          setSavedRecipes(fetchedSavedRecipes);
          if (!fetchedSavedRecipes.length) setStatusMessage("No saved recipes yet.");
        } catch {
          if (!alive) return;
          setStatusMessage("Failed to load saved recipes.");
        } finally {
          if (alive) setIsSavedLoading(false);
        }
      })();

      return () => {
        alive = false;
      };
    }
  }, [activeTab, user]);

  if (!user) return <Login />;

  // toggle one allergen in local draft state
  const toggleAllergen = (allergenName) => {
    setSelectedAllergensDraft((prev) => {
      const next = new Set(prev);
      if (next.has(allergenName)) next.delete(allergenName);
      else next.add(allergenName);
      return Array.from(next);
    });
  };

  // store selected allergens to user profile
  const handleSaveAllergens = async () => {
    setIsSavingAllergens(true);

    try {
      // store selected allergens and refresh auth user
      const updatedUser = await updateMyAllergens(selectedAllergensDraft);
      setUser(updatedUser);
      setModalState({ show: true, msg: "Your allergen settings have been updated successfully.", type: "success" });
    } catch {
      setModalState({ show: true, msg: "Failed to update allergens. Please try again later.", type: "error" });
    } finally {
      setIsSavingAllergens(false);
    }
  };

  // validate and submit password change request
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    if (oldPassword === newPassword) {
      setModalState({ show: true, msg: "New password cannot be the same as your old password.", type: "error" });
      return;
    }

    setIsPasswordUpdating(true);

    try {
      // call password update endpoint and clear local form fields
      await updatePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword("");
      setNewPassword("");
      setModalState({ show: true, msg: "Your password has been changed successfully.", type: "success" });
    } catch (err) {
      const apiErrorMessage = err.response?.data?.message || "";
      let message = "Failed to update password. Check your old password.";

      if (apiErrorMessage.includes("same") || apiErrorMessage.includes("identical")) {
        message = "Please do not use the same password as your current one.";
      }

      setModalState({ show: true, msg: message, type: "error" });
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  return (
    <div className="profile-page">
      <h1 className="profile-page__title">Profile</h1>

      {modalState.show && (
        <div className="profile-page__modal-overlay" onClick={() => setModalState({ ...modalState, show: false })}>
          <div
            className={`profile-page__modal ${modalState.type === "error" ? "profile-page__modal--error" : "profile-page__modal--success"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-page__modal-icon">
              {modalState.type === "success" ? (
                <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#0a5700" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#c00000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )}
            </div>

            <h3>{modalState.type === "success" ? "" : ""}</h3>
            <p>{modalState.msg}</p>

            <button className="profile-page__modal-ok-btn" onClick={() => setModalState({ ...modalState, show: false })}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="profile-page__tabs">
        <button className={`profile-page__tab-btn ${activeTab === "saved" ? "profile-page__tab-btn--active" : ""}`} onClick={() => setActiveTab("saved")}>Saved Recipes</button>
        <button className={`profile-page__tab-btn ${activeTab === "allergens" ? "profile-page__tab-btn--active" : ""}`} onClick={() => setActiveTab("allergens")}>Allergen Settings</button>
        <button className={`profile-page__tab-btn ${activeTab === "details" ? "profile-page__tab-btn--active" : ""}`} onClick={() => setActiveTab("details")}>User Details</button>
      </div>

      {activeTab === "allergens" && (
        <div className="profile-page__panel">
          <div className="profile-page__selection-box">
            <div>
              <span className="profile-page__selection-label">Current Profile Allergens: </span>
              <span className="profile-page__selection-list">
                {(user.allergens || []).length > 0 ? user.allergens.join(", ") : "None selected"}
              </span>
            </div>
            <div className="profile-page__selection-instruction">(Select your allergens and click 'Save Allergens' to update)</div>
          </div>
          <p className="profile-page__hint">Select allergens to be warned in recipes.</p>
          <div className="profile-page__allergen-grid">
            {ALLERGEN_OPTIONS.map((allergenName) => (
              <label key={allergenName} className="profile-page__allergen-item">
                <input
                  type="checkbox"
                  checked={selectedAllergensDraft.includes(allergenName)}
                  onChange={() => toggleAllergen(allergenName)}
                />
                <span>{allergenName}</span>
              </label>
            ))}
          </div>
          <button className="profile-page__save-btn" onClick={handleSaveAllergens} disabled={isSavingAllergens}>
            {isSavingAllergens ? "Saving..." : "Save Allergens"}
          </button>
        </div>
      )}

      {activeTab === "saved" && (
        <div className="profile-page__panel">
          <h2 className="profile-page__panel-title">Saved Recipes</h2>
          {statusMessage && !isSavedLoading && <p className="profile-page__panel-msg">{statusMessage}</p>}
          <div className="profile-page__saved-grid">
            {isSavedLoading
              ? Array.from({ length: 6 }).map((_, index) => <SearchResultCard key={index} loading countView={false} />)
              : savedRecipes.map((recipe) => (
                  <SearchResultCard
                    key={recipe.id}
                    recipe={recipe}
                    countView={false}
                    userAllergens={(user.allergens || []).map((x) => String(x).toLowerCase())}
                  />
                ))}
          </div>
        </div>
      )}

      {activeTab === "details" && (
        <div className="profile-page__panel profile-page__details-panel">
          <h2 className="profile-page__panel-title">User Details</h2>
          <div className="profile-page__details-box">
            <div className="profile-page__details-row"><span className="profile-page__details-label">Username</span><span className="profile-page__details-value">{user.username}</span></div>
            <div className="profile-page__details-row"><span className="profile-page__details-label">Email</span><span className="profile-page__details-value">{user.email}</span></div>
          </div>

          <form className="profile-page__password-section" onSubmit={handleChangePassword}>
            <h3 className="profile-page__section-title">Change Password</h3>
            <div className="profile-page__password-group">
              <label>Old Password</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Enter old password" />
            </div>
            <div className="profile-page__password-group">
              <label>New Password</label>
              <div className="profile-page__password-wrap">
                <input type={isPasswordVisible ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                <button type="button" className="profile-page__toggle-pass" onClick={() => setIsPasswordVisible(!isPasswordVisible)}>
                  {isPasswordVisible ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="profile-page__change-pass-btn" disabled={isPasswordUpdating}>
              {isPasswordUpdating ? "UPDATING..." : "CHANGE PASSWORD"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Profile;
