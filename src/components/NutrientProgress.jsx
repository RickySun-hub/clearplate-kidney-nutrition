import { Check, CircleAlert, Drumstick } from "lucide-react";
import { formatAmount } from "../utils/nutrition";

export default function NutrientProgress({ type, value, target, range, complete = false, estimated = false }) {
  const isSodium = type === "sodium";
  const numericValue = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  const hasValidTarget = isSodium
    ? Number.isFinite(Number(target)) && Number(target) > 0
    : Number.isFinite(Number(range?.min)) && Number(range.min) > 0
      && Number.isFinite(Number(range?.max)) && Number(range.max) >= Number(range.min);
  const maximum = hasValidTarget ? Number(isSodium ? target : range.max) : null;
  const ratio = maximum > 0 && numericValue !== null ? Math.max(0, Math.min((numericValue / maximum) * 100, 100)) : 0;
  let status = isSodium ? "Below saved limit" : "Within saved range";
  let tone = "good";

  if (!hasValidTarget) {
    status = "Targets need review";
    tone = "warning";
  } else if (isSodium) {
    if (numericValue > target) {
      status = "Over target";
      tone = "danger";
    } else if (numericValue > target * 0.8) {
      status = "Near limit";
      tone = "warning";
    }
  } else if (numericValue > range.max) {
    status = "Over range";
    tone = "danger";
  } else if (numericValue < range.min) {
    status = "Below range";
    tone = "warning";
  }

  if (hasValidTarget && !complete && tone !== "danger") {
    status = "Recording in progress";
    tone = "neutral";
  }
  if (numericValue === null) {
    status = "Incomplete nutrient data";
    tone = "neutral";
  }

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
            {formatAmount(numericValue, 1)}
            <small>
              {isSodium
                ? ` / ${formatAmount(target)} ${unit}`
                : ` / ${formatAmount(range.min)}–${formatAmount(range.max)} ${unit}`}
            </small>
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={isSodium ? "Recorded sodium relative to upper limit" : "Recorded protein relative to target range"}
          aria-valuenow={maximum === null || numericValue === null ? undefined : Math.min(maximum, Math.max(0, Math.round(numericValue)))}
          aria-valuetext={`${formatAmount(numericValue, 1)} ${unit} recorded; ${status}${estimated ? "; includes estimates" : ""}`}
          aria-valuemin="0"
          aria-valuemax={maximum ?? undefined}
        >
          <span style={{ width: `${ratio}%` }} />
          {!isSodium && hasValidTarget && (
            <i className="range-marker" style={{ left: `${(range.min / range.max) * 100}%` }} />
          )}
        </div>
        <div className="progress-labels">
          <span>0 {unit}</span>
          <span>{isSodium ? `${formatAmount(target / 2)} ${unit}` : `${formatAmount(range.min)} ${unit} min`}</span>
          <span>{formatAmount(maximum)} {unit}{isSodium ? " upper limit" : ""}</span>
        </div>
      </div>
      <div className="nutrient-status">
        <StatusIcon size={22} strokeWidth={1.8} aria-hidden="true" />
        <span>{status}{estimated && <small>Includes estimates</small>}</span>
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
