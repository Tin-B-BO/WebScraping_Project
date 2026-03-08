import React from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/Information.css";

// static info pages rendered from footer links
const infoData = {
  "accessibility": {
    title: "Accessibility Statement",
    content: `
      <h2>Our Commitment</h2>
      <p>TrustyRecipe is committed to providing an inclusive digital experience for all users, including people who use assistive technologies. Accessibility is treated as a core product requirement and is considered during design, development, and testing.</p>

      <h2>Standards And Conformance</h2>
      <p>We aim to align with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. While we continue to improve, we work to ensure key journeys remain accessible and understandable across common devices and browsers.</p>

      <h2>Accessibility Features</h2>
      <ul>
        <li><strong>Keyboard Access:</strong> core flows are navigable without a mouse</li>
        <li><strong>Semantic Structure:</strong> headings and landmarks support assistive technologies</li>
        <li><strong>Readable Presentation:</strong> consistent hierarchy, spacing, and text contrast are maintained where practical</li>
        <li><strong>Responsive Layout:</strong> content is designed to remain usable across screen sizes and zoom levels</li>
      </ul>

      <h2>Known Limitations</h2>
      <p>Some pages may still require improvement for full consistency across all assistive tools, browsers, and devices. We prioritize accessibility defects and include them in ongoing iteration cycles.</p>

      <h2>Feedback And Support</h2>
      <p>If you encounter an accessibility issue, please contact us and include the page URL, device, browser, and a short description of the problem. We review reported issues and aim to provide a timely response.</p>
    `,
  },
  "contact": {
    title: "Contact Us",
    content: `
      <h2>How To Reach Us</h2>
      <p>If you need help, want to report an issue, or have product feedback, please contact our team using the details below.</p>

      <h2>Contact Details</h2>
      <ul>
        <li><strong>Email:</strong> coming soon</li>
      </ul>

      <h2>What To Include</h2>
      <ul>
        <li>the page URL where the issue occurred</li>
        <li>your browser, device, and operating system</li>
        <li>a short description of expected behavior and actual behavior</li>
        <li>screenshots or screen recordings where possible</li>
      </ul>
    `,
  },
  "privacy-policy": {
    title: "Privacy Policy",
    content: `
      <h2>Overview</h2>
      <p>This Privacy Policy explains how TrustyRecipe collects, uses, stores, and protects personal data when you use our services.</p>

      <h2>Data We Collect</h2>
      <ul>
        <li>account information such as username and email address</li>
        <li>profile preferences including allergen settings</li>
        <li>interaction records required for core functionality, such as recent searches</li>
        <li>technical data such as browser type and device metadata for reliability and security purposes</li>
      </ul>

      <h2>How We Use Data</h2>
      <ul>
        <li>to authenticate users and maintain account sessions</li>
        <li>to personalize recipe results based on allergen preferences</li>
        <li>to support product features and improve service quality</li>
        <li>to detect abuse, enforce platform rules, and maintain security</li>
      </ul>

      <h2>Legal Basis And Data Sharing</h2>
      <p>Where applicable, processing is based on legitimate interests, contract performance, legal obligations, or consent. We do not sell personal data. Data sharing is limited to trusted service providers and only when necessary to operate the service.</p>

      <h2>Data Retention</h2>
      <p>We retain personal data only for as long as needed to provide services, comply with legal obligations, resolve disputes, and enforce agreements. Retention periods vary by data type and purpose.</p>

      <h2>Your Rights And Choices</h2>
      <p>Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict processing of your personal data. You may also have rights to data portability and to object to certain processing activities.</p>

      <h2>Security</h2>
      <p>We use appropriate technical and organizational safeguards to protect personal data against unauthorized access, disclosure, alteration, and loss. No method of transmission or storage is fully risk-free.</p>

      <h2>Policy Updates</h2>
      <p>We may update this policy periodically. Material changes will be reflected on this page with an updated revision date when applicable.</p>
    `,
  },
  "terms-of-service": {
    title: "Terms of Service",
    content: `
      <h2>Acceptance Of Terms</h2>
      <p>By accessing or using TrustyRecipe, you agree to be bound by these Terms of Service and all applicable laws. If you do not agree, you must stop using the service.</p>

      <h2>Eligibility And Accounts</h2>
      <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

      <h2>Acceptable Use</h2>
      <ul>
        <li>do not misuse, disrupt, or interfere with the service</li>
        <li>do not attempt unauthorized access to systems or data</li>
        <li>do not use the service for unlawful, harmful, or fraudulent purposes</li>
      </ul>

      <h2>Content And Medical Disclaimer</h2>
      <p>Recipe content is provided for informational purposes only. Ingredient sources and allergen data can vary. Users are solely responsible for verifying ingredients and suitability before consumption, especially for severe allergies.</p>

      <h2>Service Availability</h2>
      <p>We may modify, suspend, or discontinue features at any time to improve reliability, security, and product quality.</p>

      <h2>Intellectual Property</h2>
      <p>All platform branding, design assets, and proprietary content are protected by applicable intellectual property laws. Unauthorized use is prohibited.</p>

      <h2>Liability</h2>
      <p>To the maximum extent permitted by law, TrustyRecipe and its operators are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.</p>

      <h2>Termination</h2>
      <p>We may suspend or terminate access if these terms are violated, or where required to protect users, systems, or legal compliance.</p>

      <h2>Changes To Terms</h2>
      <p>We may revise these terms from time to time. Continued use after updates constitutes acceptance of the revised terms.</p>
    `,
  },
  "cookie-policy": {
    title: "Cookie Policy",
    content: `
      <h2>What Cookies Are</h2>
      <p>Cookies are small text files stored on your device to support session continuity, preferences, and website functionality.</p>

      <h2>Types Of Cookies We Use</h2>
      <ul>
        <li><strong>Essential Cookies:</strong> required for secure sign-in and basic app functionality</li>
        <li><strong>Functional Cookies:</strong> used to remember settings and improve user experience</li>
        <li><strong>Performance Cookies:</strong> help measure product behavior and identify reliability issues</li>
      </ul>

      <h2>Why Cookies Matter</h2>
      <p>Without essential cookies, parts of the service may not function correctly, including login state, personalized preferences, and session continuity.</p>
    `,
  },
  "cookie-settings": {
    title: "Cookie Settings",
    content: `
      <h2>Manage Preferences</h2>
      <p>You can control cookie behavior through your browser settings. In this prototype, in-app granular cookie controls may be limited.</p>

      <h2>Browser Controls</h2>
      <ul>
        <li>clear existing cookies for this site</li>
        <li>block all cookies or selected cookie categories</li>
        <li>allow cookies only for selected sites</li>
        <li>auto-delete cookies on browser close</li>
      </ul>

      <h2>Impact Of Disabling Cookies</h2>
      <p>Disabling essential cookies may limit sign-in persistence, personalization, and recent activity features. Some pages may function with reduced capability.</p>
    `,
  },
};

const notFoundPage = {
  title: "Not Found",
  content: "<p>This page does not exist.</p>",
};

function Information() {
  const { slug } = useParams();

  // resolve current info page from route slug
  const page = infoData[slug] || notFoundPage;

  return (
    <div className="info-page">
      <Link to="/" className="info-page__back-link">
        &lt;- Back to Home
      </Link>

      <h1 className="info-page__title">{page.title}</h1>

      <div
        className="info-page__content"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </div>
  );
}

export default Information;
