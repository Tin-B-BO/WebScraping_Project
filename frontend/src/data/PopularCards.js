// preload popular card images so each allergen card can map to a local asset
const images = import.meta.glob("../assets/popular/*.{png,jpg,jpeg,webp}", { eager: true });

// static card metadata used by popular session carousel
const popularCards = [
  { id: 1, name: "celery", description: "Celery free" },
  { id: 2, name: "crustaceans", description: "Crustaceans free" },
  { id: 3, name: "eggs", description: "Egg free" },
  { id: 4, name: "fish", description: "Fish free" },
  { id: 5, name: "cereals containing gluten", description: "Gluten free" },
  { id: 6, name: "lupin", description: "Lupin free" },
  { id: 7, name: "milk", description: "Milk free" },
  { id: 8, name: "molluscs", description: "Molluscs free" },
  { id: 9, name: "mustard", description: "Mustard free" },
  { id: 10, name: "tree nuts", description: "Tree Nuts free" },
  { id: 11, name: "peanuts", description: "Peanuts free" },
  { id: 12, name: "sesame", description: "Sesame Seeds free" },
  { id: 13, name: "soybeans", description: "Soya free" },
  { id: 14, name: "sulphur dioxide and sulphites", description: "Sulphites free" },
];

// attach image url by converting allergen name to expected asset filename
const popular = popularCards.map((item) => {
  const fileName = item.name.replace(/\s+/g, "-").toLowerCase();
  const path = `../assets/popular/${fileName}.webp`;

  return {
    ...item,
    imgURL: images[path]?.default || images[path] || "",
  };
});

export default popular;
