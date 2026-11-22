export default function Logo() {
  return (
    <div className="brand" aria-label="Nepholio home" style={{ color: '#285b49' }}>
      {/* Reuse the original October 14 concept, with the icon isolated by the
          viewport. The raster is a temporary brand asset, not a new redraw. */}
      <svg viewBox="272 222 264 280" aria-hidden="true" style={{ width: 32, height: 34, flexShrink: 0, stroke: 'none', mixBlendMode: 'multiply' }}>
        <image href="/brand/nepholio-previous-concept.png" width="1536" height="1024" />
      </svg>
      <span>Nepholio</span>
    </div>
  );
}
