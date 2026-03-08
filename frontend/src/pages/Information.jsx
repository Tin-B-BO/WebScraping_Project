import React from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/Information.css";

// static info pages rendered from footer links
const infoData = {
  "accessibility": {
    title: "Accessibility Statement",
    content: `
      <h2>Our Commitment</h2>
      <p>TrustyRecipe is committed to making our website and services accessible to everyone, including people who use assistive technologies. Accessibility is part of how we design, build, and maintain our product.</p>

      <h2>Standards We Follow</h2>
      <p>We aim to meet Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. We regularly review key user journeys to improve compatibility across browsers, devices, and assistive tools.</p>

      <h2>Accessibility Features</h2>
      <ul>
        <li><strong>Keyboard Navigation:</strong> core features can be used without a mouse</li>
        <li><strong>Clear Structure:</strong> heading hierarchy and landmarks support screen readers</li>
        <li><strong>Readable Content:</strong> we work to maintain legible text, contrast, and spacing</li>
        <li><strong>Responsive Design:</strong> pages are built to remain usable on mobile, desktop, and zoomed views</li>
      </ul>

      <h2>Known Limitations</h2>
      <p>Some areas may not yet provide a fully consistent experience across every assistive technology. We actively prioritise and fix accessibility issues as they are identified.</p>

      <h2>Contact Us About Accessibility</h2>
      <p>If you find a barrier while using TrustyRecipe, please contact us at <strong>example@trustyrecipe.com</strong>. Include the page URL, device, browser, and a short description so we can investigate quickly.</p>
    `,
  },
  "contact": {
    title: "Contact Us",
    content: `
      <h2>We'd Love To Hear From You</h2>
      <p>Need help with your account, spotted a bug, or have an idea for a feature? Our support team is here to help.</p>

      <h2>Contact Details</h2>
      <ul>
        <li><strong>General Support:</strong> example@trustyrecipe.com</li>
      </ul>

      <h2>For Faster Support, Include</h2>
      <ul>
        <li>the page URL where the issue happened</li>
        <li>your browser, operating system, and device type</li>
        <li>what you expected to happen and what happened instead</li>
        <li>screenshots or short recordings, if available</li>
      </ul>
    `,
  },
  "privacy-policy": {
    title: "Privacy Policy",
    content: `
      <h2>Introduction</h2>
      <p>This Privacy Policy explains how TrustyRecipe collects, uses, and protects your personal information when you use our website and services.</p>

      <h2>Data We Collect</h2>
      <ul>
        <li>account information such as name, username, and email address</li>
        <li>profile preferences, including dietary and allergen settings</li>
        <li>usage information such as searches, saved recipes, and interactions with features</li>
        <li>technical data like browser type, IP address, and device information</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>to provide and maintain your account and core product features</li>
        <li>to personalise recipe recommendations based on your preferences</li>
        <li>to improve site performance, features, and user experience</li>
        <li>to detect fraud, abuse, and unauthorized access</li>
      </ul>

      <h2>Sharing Of Information</h2>
      <p>We do not sell, rent, or share your personal information with third parties.</p>

      <h2>Data Retention</h2>
      <p>We keep personal information only as long as needed for business, legal, and security purposes, then delete or anonymise it when no longer required.</p>

      <h2>Your Rights</h2>
      <p>Depending on your location, you may have rights to access, correct, delete, or restrict use of your personal data. To submit a request, contact <strong>example@trustyrecipe.com</strong>.</p>

      <h2>Security</h2>
      <p>We use technical and organisational safeguards designed to protect your information. No online system is completely secure, but we continuously monitor and improve our security controls.</p>

      <h2>Updates To This Policy</h2>
      <p>We may update this Privacy Policy from time to time. When we make material changes, we will update this page and revise the effective date.</p>
    `,
  },
  "terms-of-service": {
    title: "Terms of Service",
    content: `
      <h2>Agreement To Terms</h2>
      <p>By accessing or using TrustyRecipe, you agree to be bound by these Terms of Service and any policies referenced in them. If you do not agree, you must not use the service.</p>

      <h2>Eligibility</h2>
      <p>You must be at least 13 years old to use TrustyRecipe. If you are under the age of majority in your country, you may only use the service with the involvement of a parent or legal guardian.</p>

      <h2>Account Registration And Security</h2>
      <p>To access certain features, you may need to create an account. You must provide accurate information and keep it up to date. You are responsible for safeguarding your login details and for all activity under your account.</p>
      <p>If you believe your account has been compromised, contact us immediately at <strong>example@trustyrecipe.com</strong>.</p>

      <h2>Acceptable Use</h2>
      <ul>
        <li>do not interfere with or disrupt the service</li>
        <li>do not attempt unauthorised access to accounts, systems, or data</li>
        <li>do not use the platform for unlawful or harmful activities</li>
        <li>do not scrape, copy, or redistribute content in violation of applicable law</li>
        <li>do not upload malicious code or attempt to bypass security controls</li>
      </ul>

      <h2>User Content</h2>
      <p>If you submit content such as profile information, comments, or feedback, you confirm that you have the right to submit it and that it does not infringe the rights of others. You remain responsible for the content you provide.</p>

      <h2>Recipe And Allergen Disclaimer</h2>
      <p>Recipe information is provided for general informational purposes only. Ingredients and allergen details can change over time. You are responsible for verifying ingredient labels and suitability before consumption.</p>
      <p>TrustyRecipe does not provide medical advice. If you have severe allergies or medical concerns, consult a qualified healthcare professional before relying on recipe content.</p>

      <h2>Service Availability</h2>
      <p>We may update, suspend, or discontinue any part of the service at any time, with or without notice.</p>

      <h2>Intellectual Property</h2>
      <p>All TrustyRecipe trademarks, branding, design elements, and platform content are protected by applicable intellectual property laws.</p>
      <p>Unless otherwise stated, no part of the service may be reproduced, distributed, or modified without prior written permission.</p>

      <h2>Third-Party Links And Services</h2>
      <p>The service may include links to third-party websites or tools. We do not control and are not responsible for third-party content, policies, or practices.</p>

      <h2>Limitation Of Liability</h2>
      <p>To the fullest extent permitted by law, TrustyRecipe is not liable for indirect, incidental, consequential, or special damages resulting from your use of the service.</p>

      <h2>Termination</h2>
      <p>We may suspend or terminate access to the service if these terms are violated or if required for security, legal, or operational reasons.</p>

      <h2>Governing Law</h2>
      <p>These terms are governed by the laws of England and Wales. Any disputes arising from these terms or your use of the service are subject to the exclusive jurisdiction of the courts of England and Wales.</p>

      <h2>Changes To Terms</h2>
      <p>We may update these terms periodically. Continued use of TrustyRecipe after updates means you accept the revised terms.</p>

      <h2>Contact</h2>
      <p>If you have questions about these Terms of Service, contact us at <strong>example@trustyrecipe.com</strong>.</p>
    `,
  },
  "cookie-policy": {
    title: "Cookie Policy",
    content: `
      <h2>No Cookies Collected</h2>
      <p>TrustyRecipe currently does not set or collect cookies through this website.</p>

      <h2>How Core Features Work</h2>
      <p>Core functionality such as authentication is handled using browser storage in this application, not cookies.</p>

      <h2>Future Changes</h2>
      <p>If this changes in the future, we will update this Cookie Policy before introducing cookie-based features.</p>
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
