import { Check, CircleAlert, Drumstick } from "lucide-react";
import { formatAmount, nutrientProgressState } from "../utils/nutrition";

export default function NutrientProgress({ type, value, coverage, target, range, complete = false, estimated = false, empty = false }) {
  const isSodium = type === "sodium";
  const { numericValue, hasValidTarget, maximum, ratio, status, tone, partial } = nutrientProgressState({
    type, value, coverage, target, range, complete, empty,
  });

  const Icon = isSodium ? SaltShaker : Drumstick;
  const StatusIcon = tone === "good" ? Check : CircleAlert;
  const unit = isSodium ? "mg" : "g";

  return (
    <section className={`nutrient-band ${tone}`} aria-label={`${type} progress`}>
      <div className="nutrient-icon" aria-hidden="true">
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <div className="nutrient-main">
        <div className="nutrient-heading">
          <strong>{isSodium ? "Sodium" : "Protein"}</strong>
          <span className="nutrient-current">
            {empty ? '—' : formatAmount(numericValue, 1)}
            <small>
              {!hasValidTarget ? ` ${unit}` : isSodium
                ? ` / ${formatAmount(target)} ${unit}`
                : ` / ${formatAmount(range.min)}–${formatAmount(range.max)} ${unit}`}
            </small>
            {partial && <small> · known subtotal</small>}
          </span>
        </div>
        {hasValidTarget && numericValue !== null && <div
          className="progress-track"
          role="progressbar"
          aria-label={isSodium ? "Recorded sodium relative to upper limit" : "Recorded protein relative to target range"}
          aria-valuenow={maximum === null || numericValue === null ? undefined : Math.min(maximum, Math.max(0, Math.round(numericValue)))}
          aria-valuetext={`${formatAmount(numericValue, 1)} ${unit} ${partial ? 'known subtotal' : 'recorded'}; ${status}${estimated ? "; includes estimates" : ""}`}
          aria-valuemin="0"
          aria-valuemax={maximum ?? undefined}
        >
          <span style={{ width: `${ratio}%` }} />
          {!isSodium && hasValidTarget && (
            <i className="range-marker" style={{ left: `${(range.min / range.max) * 100}%` }} />
          )}
        </div>}
        {hasValidTarget && numericValue !== null && <div className="progress-labels">
          <span>0 {unit}</span>
          <span>{isSodium ? `${formatAmount(target / 2)} ${unit}` : `${formatAmount(range.min)} ${unit} min`}</span>
          <span>{formatAmount(maximum)} {unit}{isSodium ? " upper limit" : ""}</span>
        </div>}
      </div>
      <div className="nutrient-status">
        <StatusIcon size={22} strokeWidth={1.8} aria-hidden="true" />
        <span>{status}{partial && <small>{coverage.knownCount}/{coverage.itemCount} items have data</small>}{estimated && <small>Includes estimates</small>}</span>
      </div>
    </section>
  );
}

function SaltShaker({ size = 24, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.2 8.2h7.6l1.5 11.2a1.4 1.4 0 0 1-1.4 1.6H8.1a1.4 1.4 0 0 1-1.4-1.6L8.2 8.2Z" />
      <path d="M8.5 8.2V5.4c0-1.3 1.1-2.4 2.4-2.4h2.2c1.3 0 2.4 1.1 2.4 2.4v2.8M8.6 6h6.8M10.2 4.7h.01M12 4.7h.01M13.8 4.7h.01" />
    </svg>
  );
}
