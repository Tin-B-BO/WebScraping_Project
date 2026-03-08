import React from "react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";

function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__brand">
          <Link to="/" className="app-footer__brand-link">TrustyRecipe</Link>
        </div>

        <div className="app-footer__column">
          <div className="app-footer__title">Help</div>
          <ul>
            <li><Link to="/info/contact">Contact Us</Link></li>
            <li><Link to="/profile">My Account</Link></li>
          </ul>
        </div>

        <div className="app-footer__divider" />

        <div className="app-footer__column">
          <div className="app-footer__title">About</div>
          <ul>
            <li><Link to="/info/accessibility">Accessibility</Link></li>
            <li><Link to="/info/privacy-policy">Privacy policy</Link></li>
          </ul>
        </div>

        <div className="app-footer__column app-footer__column--no-title">
          <ul>
            <li><Link to="/info/cookie-policy">Cookie Policy</Link></li>
            <li><Link to="/info/cookie-settings">Cookie settings</Link></li>
          </ul>
        </div>

        <div className="app-footer__column app-footer__column--no-title">
          <ul>
            <li><Link to="/info/terms-of-service">Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="app-footer__bottom">
        <span>&copy; TrustyRecipe</span>
      </div>
    </footer>
  );
}

export default Footer;
