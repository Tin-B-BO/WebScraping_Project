import React from "react";
import "../styles/AboutThisWebsite.css";

function AboutThisWebsite() {
  return (
    <section className="about-website">
      <div className="about-website__inner">
        <h2 className="about-website__title">About This Website</h2>
        <p className="about-website__text">
          TrustyRecipe is built to help you discover recipes with more confidence, especially when managing food allergens.
          You can search by recipe name, apply allergen filters, and browse matching results in a clear, simple layout.
          If you sign in, you can save favourite recipes and view your recent searches for quicker meal planning.
        </p>
      </div>
    </section>
  );
}

export default AboutThisWebsite;
