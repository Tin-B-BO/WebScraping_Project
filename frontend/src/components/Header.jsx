import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Header.css";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  // handle nav clicks and close open menus
  const handleNavClick = (path) => {
    // scroll to top when clicking the current route
    if (pathname === path) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // close mobile menus after navigation
    setIsMenuOpen(false);
    setIsUserOpen(false);
  };

  // scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // close mobile menus when viewport switches to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMenuOpen(false);
        setIsUserOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <header className="header-nav">
      <nav className="header-nav__bar">
        <div className="header-nav__left">
          <button 
            className="header-nav__burger-btn" 
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
              setIsUserOpen(false);
            }}
          >
            <div className={`header-nav__burger-icon ${isMenuOpen ? "open" : ""}`}>
              <span></span><span></span><span></span>
            </div>
          </button>
          
          <div className="header-nav__logo" onClick={() => { navigate("/"); handleNavClick("/"); }}>TrustyRecipe</div>
          
          {isMenuOpen && (
            <div className="header-nav__menu-dropdown">
              <Link to="/search" className="header-nav__dropdown-item" onClick={() => handleNavClick("/search")}>Search</Link>
              <Link to="/profile" className="header-nav__dropdown-item" onClick={() => handleNavClick("/profile")}>Profile</Link>
            </div>
          )}
        </div>

        <div className="header-nav__center">
          <div className="header-nav__desktop-only header-nav__main-links">
            <Link to="/" className="header-nav__main-link" onClick={() => handleNavClick("/")}>Home</Link>
            <Link to="/search" className="header-nav__main-link" onClick={() => handleNavClick("/search")}>Search</Link>
            <Link to="/profile" className="header-nav__main-link" onClick={() => handleNavClick("/profile")}>Profile</Link>
          </div>
        </div>

        <div className="header-nav__right">
          {user && <span className="header-nav__user header-nav__desktop-only">Hi, {user.username}</span>}
          
          <div className="header-nav__user-menu-wrap">
            <button 
              className="header-nav__user-btn" 
              aria-label="User menu"
              aria-expanded={isUserOpen}
              onClick={() => {
                setIsUserOpen(!isUserOpen);
                setIsMenuOpen(false);
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="header-nav__user-icon" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>

            {isUserOpen && (
              <div className="header-nav__user-dropdown">
                {user ? (
                  <button className="header-nav__dropdown-item" onClick={() => {
                    logout();
                    setIsUserOpen(false);
                    navigate("/");
                    window.scrollTo(0,0);
                  }}>Log out</button>
                ) : (
                  <div className="header-nav__auth-dropdown-links">
                    <Link to="/login" className="header-nav__auth-link" onClick={() => handleNavClick("/login")}>Sign in</Link>
                    <span className="header-nav__auth-splitter">|</span>
                    <Link to="/signup" className="header-nav__auth-link" onClick={() => handleNavClick("/signup")}>Register</Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="header-nav__desktop-only header-nav__auth-links">
            {user ? (
               <button className="header-nav__auth-btn" onClick={() => { logout(); navigate("/"); window.scrollTo(0,0); }}>Log out</button>
            ) : (
              <>
                <Link to="/login" className="header-nav__auth-btn" onClick={() => handleNavClick("/login")}>Sign in</Link>
                <span className="header-nav__desktop-splitter">|</span>
                <Link to="/signup" className="header-nav__auth-btn" onClick={() => handleNavClick("/signup")}>Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Header;
