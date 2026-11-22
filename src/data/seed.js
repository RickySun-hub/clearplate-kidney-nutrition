import { localDateKey } from "../utils/nutrition";
import recipes from "./recipes.json";

// New accounts start with unknown personal data and no assumed clinical targets.
export const defaultProfile = {
  name: '', condition: '', stage: '', weightKg: null, heightCm: null,
  treatment: '', sodiumTargetMg: null, proteinMinG: null, proteinMaxG: null,
  useGuidelineProteinRange: false, reviewedAt: '',
};

export const defaultMeals = [
  {
    id: "seed-breakfast",
    date: localDateKey(),
    source: "recipe",
    meal: "Breakfast",
    time: "7:30 AM",
    recipeId: "fresh-tzatziki",
    servings: 1,
  },
  {
    id: "seed-lunch",
    date: localDateKey(),
    source: "recipe",
    meal: "Lunch",
    time: "12:30 PM",
    recipeId: "chicken-and-spanish-rice",
    servings: 1,
  },
  {
    id: "seed-dinner",
    date: localDateKey(),
    source: "recipe",
    meal: "Dinner",
    time: "6:30 PM",
    recipeId: "grilled-salmon-with-papaya-mint-salsa",
    servings: 1,
  },
];

export const recipeImages = Object.fromEntries(
  recipes.map(({ id }) => [id, `/recipes/${id}.webp`]),
);
