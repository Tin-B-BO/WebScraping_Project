import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import popular from "../data/PopularCards.js";
import "../styles/PopularSession.css";

const slugify = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function PopularSession() {
  const carouselRef = useRef(null);
  const navigate = useNavigate();

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const [dragMoved, setDragMoved] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const totalDots = 6;

  // tune drag sensitivity by viewport size
  const getDragSpeed = () => {
    const width = window.innerWidth;
    if (width > 1100) return 2.8;
    if (width > 700) return 1.8;
    return 1.0;
  };

  // tune arrow scroll distance by viewport size
  const getScrollDistance = () => {
    const width = window.innerWidth;
    if (width > 1100) return 800;
    if (width > 700) return 500;
    return 250;
  };

  // convert current horizontal scroll position into active dot index
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) return;

    const ratio = scrollLeft / maxScroll;
    const newIndex = Math.min(Math.round(ratio * (totalDots - 1)), totalDots - 1);

    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  };

  // move carousel left or right when arrow buttons are clicked
  const handleArrowClick = (direction) => {
    if (!carouselRef.current) return;
    const distance = getScrollDistance();
    carouselRef.current.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
  };

  // jump carousel to the section represented by a pagination dot
  const scrollToIndex = (dotIndex) => {
    if (!carouselRef.current) return;
    const { scrollWidth, clientWidth } = carouselRef.current;
    const maxScroll = scrollWidth - clientWidth;
    const targetScroll = (dotIndex / (totalDots - 1)) * maxScroll;

    carouselRef.current.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    });
  };

  // start drag state and capture initial mouse and scroll positions
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragMoved(false);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeftPos(carouselRef.current.scrollLeft);
  };

  // end drag when cursor leaves carousel area
  const handleMouseLeave = () => setIsDragging(false);

  // end drag on mouse up after click handlers run
  const handleMouseUp = () => setTimeout(() => setIsDragging(false), 0);

  // update horizontal scroll while dragging
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    setDragMoved(true);
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * getDragSpeed();
    carouselRef.current.scrollLeft = scrollLeftPos - walk;
  };

  // navigate to selected allergen page unless this interaction was a drag
  const handlePick = (item) => {
    if (dragMoved) return;
    navigate(`/popular/${slugify(item.name)}-free`, {
      state: { allergenKey: item.name, allergenLabel: item.description },
    });
  };

  return (
    <section className="popular-session">
      <div className="popular-session__inner">
        <div className="popular-session__header">
          <h1 className="popular-session__title">Popular Recipes</h1>
          <p className="popular-session__subtitle">Choose an allergen to see popular recipes.</p>
        </div>

        <div className="popular-session__carousel">
          <button
            className="popular-session__arrow popular-session__arrow--prev"
            onClick={() => handleArrowClick("prev")}
            aria-label="Scroll previous"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#df8600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div
            className={`popular-session__viewport ${isDragging ? "popular-session__viewport--dragging" : ""}`}
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onScroll={handleScroll}
          >
            <div className="popular-session__track">
              {popular.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className="popular-session__card"
                  onClick={() => handlePick(item)}
                  onDragStart={(e) => e.preventDefault()}
                  aria-label={`View ${item.description} recipes`}
                >
                  <div className="popular-session__card-image">
                    <img
                      src={item.imgURL}
                      alt=""
                      draggable="false"
                      aria-hidden="true"
                      fetchPriority={idx === 0 ? "high" : "auto"}
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                  </div>
                  <h2 className="popular-session__card-title">{item.description}</h2>
                </button>
              ))}
            </div>
          </div>

          <button
            className="popular-session__arrow popular-session__arrow--next"
            onClick={() => handleArrowClick("next")}
            aria-label="Scroll next"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#df8600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="popular-session__pagination">
          {[...Array(totalDots)].map((_, idx) => (
            <button
              type="button"
              key={idx}
              className={`popular-session__dot ${activeIndex === idx ? "popular-session__dot--active" : ""}`}
              onClick={() => scrollToIndex(idx)}
              aria-label={`Go to popular page ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default PopularSession;
