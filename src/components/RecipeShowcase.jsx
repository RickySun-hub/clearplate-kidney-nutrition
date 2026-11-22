import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

const dishes = [
  ['baked-salmon', 'Baked salmon'],
  ['roasted-vegetables', 'Roasted vegetables'],
  ['apple-muffin', 'Apple muffin'],
];

export default function RecipeShowcase() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [slug, name] = dishes[index];
  const next = () => setIndex(i => (i + 1) % dishes.length);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(next, 6000);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <figure className="hero-recipe" aria-label="Recipes from the library" onFocus={() => setPlaying(false)}>
    <img key={slug} src={'/recipes/' + slug + '.webp'} width="640" height="640" alt="" fetchPriority="high" />
    <figcaption aria-live={playing ? 'off' : 'polite'}>From the recipe library<strong>{name}</strong></figcaption>
    <div className="recipe-showcase-controls">
      <button type="button" aria-label="Next recipe" onClick={() => { setPlaying(false); next(); }}><ChevronRight /></button>
    </div>
  </figure>;
}
