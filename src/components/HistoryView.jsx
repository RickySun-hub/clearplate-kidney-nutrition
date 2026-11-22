import {
  AlertCircle,
  Apple,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Info,
  MoonStar,
  Package,
  SunMedium,
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildCalendarMonth, historyDayStatus } from "../utils/history";
import { formatAmount, formatNutrientCoverage, localDateKey, mealTotals, nutrientCoverage, nutrientDisplay, nutrientProgressState } from "../utils/nutrition";
import { NUTRIENTS, normalizeNutrientPreferences } from '../utils/nutrientCatalog';
import { mealSections, mealLabel } from '../utils/meals';
import { ingredientAmount } from '../utils/recipeRecording';

import { isEstimatedFoodEntry, reviewDays } from '../utils/rdReview';
import { isDayComplete } from "../utils/recording";
import FluidTracker from './FluidTracker';
import { profileForDate } from '../utils/historicalProfile.js';
import './nutrient-profile.css';

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mealOrder = [...mealSections.map(({name}) => name), 'Other meals'];
const mealIcons = {
  Breakfast: Coffee,
  Brunch: SunMedium,
  Lunch: SunMedium,
  Dinner: MoonStar,
  Snack: Apple,
};

const dateFromKey = (dateKey) => new Date(`${dateKey}T12:00:00`);
const monthStartFor = (dateKey) => {
  const date = dateFromKey(dateKey);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

function StatusIcon({ status, delayIndex = 0, size = "small" }) {
  if (status === "within") {
    return (
      <svg
        aria-hidden="true"
        className={`history-status-icon history-status-icon-${size} ${size === "small" ? "history-status-icon-animated" : "history-status-icon-static"}`}
        style={{ "--history-check-delay": `${120 + delayIndex * 32}ms` }}
        viewBox="0 0 24 24"
      >
        <circle className="history-check-circle" cx="12" cy="12" r="9.25" />
        <path className="history-check-mark" d="M6.7 12.2 10.3 15.8 17.5 8.6" />
      </svg>
    );
  }

  if (status === "review") {
    return <AlertCircle aria-hidden="true" className={`history-status-icon history-status-icon-${size} history-review-icon`} />;
  }

  return <span aria-hidden="true" className={`history-empty-icon history-status-icon-${size}`} />;
}

function NutritionCard({ label, value, progress, status }) {
  return (
    <article className="history-nutrition-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {typeof progress === "number" ? (
        <div className="history-report-progress" aria-hidden="true">
          <span style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
        </div>
      ) : null}
      <small>{status}</small>
    </article>
  );
}

export default function HistoryView({ entries, recipesById, profile: currentProfile, dayRecords = {}, onEdit, onSaveFluids }) {
  const today = localDateKey();
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const recentDays = reviewDays(entries, recipesById, currentProfile, dayRecords, localDateKey(weekStart), today);
  const latestLoggedDate = useMemo(
    () => entries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), ""),
    [entries],
  );
  const initialDate = entries.some((entry) => entry.date === today) ? today : (latestLoggedDate || today);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStartFor(initialDate));
  const selectedComplete = isDayComplete(dayRecords, entries, selectedDate);
  const profile = profileForDate(currentProfile, dayRecords, selectedDate, today);
  const preferences = normalizeNutrientPreferences(profile);
  const review = reviewDays(entries, recipesById, currentProfile, dayRecords, selectedDate, selectedDate)[0];

  const entriesByDate = useMemo(() => entries.reduce((byDate, entry) => {
    (byDate[entry.date] ??= []).push(entry);
    return byDate;
  }, {}), [entries]);

  const dayReports = useMemo(() => Object.fromEntries(Object.entries(entriesByDate).map(([dateKey, items]) => {
    const totals = mealTotals(items, recipesById);
    const coverage = nutrientCoverage(items, recipesById);
    const complete = isDayComplete(dayRecords, entries, dateKey);
    const estimated = items.some(item => isEstimatedFoodEntry(item, recipesById));
    const targets = profileForDate(currentProfile, dayRecords, dateKey, today);
    const trackedComplete = normalizeNutrientPreferences(targets).trackedNutrients.every(key => coverage[key].complete);
    return [dateKey, {
      items,
      totals,
      coverage,
      status: complete && !estimated && trackedComplete ? historyDayStatus(totals, items.length, targets) : "review",
    }];
  })), [entriesByDate, currentProfile, recipesById, dayRecords, entries, today]);

  const calendarCells = useMemo(
    () => buildCalendarMonth(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );
  const selectedReport = dayReports[selectedDate] || {
    items: [],
    totals: mealTotals([], recipesById),
    coverage: nutrientCoverage([], recipesById),
    status: "empty",
  };
  const selectedMeals = useMemo(() => mealOrder.map((meal) => {
    const items = selectedReport.items.filter((entry) => mealLabel(entry) === meal);
    return items.length ? { meal, items, coverage: nutrientCoverage(items, recipesById) } : null;
  }).filter(Boolean), [recipesById, selectedReport.items]);

  const visibleReports = calendarCells
    .filter(Boolean)
    .map(({ dateKey }) => dayReports[dateKey])
    .filter(Boolean);
  const monthSummary = visibleReports.reduce((summary, report) => ({
    logged: summary.logged + 1,
    within: summary.within + (report.status === "within" ? 1 : 0),
    review: summary.review + (report.status === "review" ? 1 : 0),
  }), { logged: 0, within: 0, review: 0 });

  const selectDate = (dateKey) => setSelectedDate(dateKey);
  const changeMonth = (offset) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };
  const showToday = () => {
    setSelectedDate(today);
    setVisibleMonth(monthStartFor(today));
  };

  const sodiumState = nutrientProgressState({ type: 'sodium', coverage: selectedReport.coverage.sodium, target: profile.sodiumTargetMg, complete: selectedComplete });
  const proteinState = nutrientProgressState({ type: 'protein', coverage: selectedReport.coverage.protein, range: { min: profile.proteinMinG, max: profile.proteinMaxG }, complete: selectedComplete });

  return (
    <main className="history-page history-calendar-page readable-nutrition-history">
      <section className="history-calendar-panel" aria-labelledby="history-title">
        <header className="history-panel-heading">
          <h1 id="history-title">Food history</h1>
          <p>Choose a date to review its meals and nutrition totals.</p>
        </header>

        <div className="history-month-controls">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
          <strong>{visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
          <div>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></button>
            <button className="history-today-button" type="button" onClick={showToday}>Today</button>
          </div>
        </div>

        <div className="history-weekdays" aria-hidden="true">
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="history-calendar-grid" role="grid" aria-label={visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
          {calendarCells.map((cell, index) => {
            if (!cell) return <span className="history-calendar-blank" key={`blank-${index}`} />;
            const report = dayReports[cell.dateKey];
            const status = report?.status || "empty";
            const isSelected = cell.dateKey === selectedDate;
            const dayLabel = dateFromKey(cell.dateKey).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

            return (
              <button
                className={`history-calendar-day ${isSelected ? "selected" : ""}`}
                type="button"
                key={cell.dateKey}
                onClick={() => selectDate(cell.dateKey)}
                aria-label={`${dayLabel}. ${status === "within" ? "Within recorded limits" : status === "review" ? "Review recorded nutrition" : "No foods logged"}`}
                aria-pressed={isSelected}
                role="gridcell"
              >
                <span className="history-calendar-day-top">
                  <b>{cell.day}</b>
                  <StatusIcon status={status} delayIndex={cell.cellIndex % 7} />
                </span>
                {report ? (
                  <span className="history-calendar-values">
                    <small title={formatNutrientCoverage(report.coverage.calories, 'kcal', 0)}>{formatNutrientCoverage(report.coverage.calories, 'kcal', 0)}</small>
                    <small title={formatNutrientCoverage(report.coverage.sodium, 'mg', 0)}>{formatNutrientCoverage(report.coverage.sodium, 'mg', 0)}</small>
                    <small title={formatNutrientCoverage(report.coverage.protein, 'g', 1)}>{formatNutrientCoverage(report.coverage.protein, 'g', 1)}</small>
                    {['calories', 'sodium', 'protein'].some(key => nutrientDisplay(report.coverage[key]).partial) && <small style={{ whiteSpace: 'normal' }}>Incomplete data</small>}
                  </span>
                ) : (
                  <span className="history-calendar-values history-calendar-empty-values" aria-hidden="true"><small>—</small><small>—</small><small>—</small></span>
                )}
              </button>
            );
          })}
        </div>

        <div className="history-calendar-legend" aria-label="Calendar status legend">
          <span><StatusIcon status="within" size="legend" /> Within recorded limits</span>
          <span><StatusIcon status="review" size="legend" /> Review</span>
          <span><StatusIcon status="empty" size="legend" /> No foods logged</span>
        </div>

        <details className="history-recent-trend"><summary>Last 7 days · recorded nutrition</summary><p>Missing days and unknown values are not zero. Unconfirmed days contain only part of the record. Subtotals include only foods with nutrient data.</p><table><thead><tr><th>Date</th><th>Sodium (mg)</th><th>Protein (g)</th><th>Record</th></tr></thead><tbody>{recentDays.map(day => <tr key={day.date}><th>{day.date.slice(5)}</th><td>{formatNutrientCoverage(day.nutrients.sodium)}</td><td>{formatNutrientCoverage(day.nutrients.protein)}</td><td>{!day.items.length ? 'No records' : day.confirmedComplete ? 'Confirmed' : 'Partial'}</td></tr>)}</tbody></table></details>
        <div className="history-month-summary">
          <span><CalendarDays aria-hidden="true" /><strong>{monthSummary.logged}</strong><small>days logged</small></span>
          <span><StatusIcon status="within" size="summary" /><strong>{monthSummary.within}</strong><small>within limits</small></span>
          <span><StatusIcon status="review" size="summary" /><strong>{monthSummary.review}</strong><small>review</small></span>
        </div>
      </section>

      <section className="history-report-panel" aria-live="polite" aria-labelledby="history-report-title">
        <header className="history-report-heading">
          <span>{selectedDate === today ? "Today" : "Daily report"}</span>
          <h2 id="history-report-title">{dateFromKey(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
          <p>{selectedComplete ? (dayRecords[selectedDate]?.profile ? "Recording confirmed · targets saved at confirmation" : "Recording confirmed · no target snapshot") : "Recording not confirmed · recorded foods only"}</p>
        </header>

        <p className="field-note">Targets: {review?.targetSource}. {selectedComplete ? 'You confirmed this day’s food record.' : 'This day is not confirmed complete; amounts describe recorded foods only.'}</p>
        {selectedReport.items.some(e => e.source === 'recipe') && <p className="field-note">Older recipe records use the current recipe values. Their original nutrition was not saved separately.</p>}
        <div className="history-nutrition-grid">
          {preferences.trackedNutrients.includes('calories') && <NutritionCard
            label="Calories"
            value={formatNutrientCoverage(selectedReport.coverage.calories, 'kcal', 0)}
            status={nutrientDisplay(selectedReport.coverage.calories).note}
          />}
          {preferences.trackedNutrients.includes('sodium') && <NutritionCard
            label="Sodium"
            value={formatNutrientCoverage(selectedReport.coverage.sodium, 'mg', 0)}
            progress={sodiumState.ratio}
            status={`${sodiumState.status}${sodiumState.hasValidTarget ? ` · Saved limit: ${formatAmount(profile.sodiumTargetMg)} mg` : ''}`}
          />}
          {preferences.trackedNutrients.includes('protein') && <NutritionCard
            label="Protein"
            value={formatNutrientCoverage(selectedReport.coverage.protein, 'g', 1)}
            progress={proteinState.ratio}
            status={`${proteinState.status}${proteinState.hasValidTarget ? ` · Saved range: ${formatAmount(profile.proteinMinG)}–${formatAmount(profile.proteinMaxG)} g` : ''}`}
          />}
          {NUTRIENTS.filter(nutrient => preferences.trackedNutrients.includes(nutrient.key) && !['calories', 'sodium', 'protein'].includes(nutrient.key)).map(nutrient => {
            const info = selectedReport.coverage[nutrient.key];
            const target = preferences.nutrientTargets[nutrient.key];
            return <NutritionCard key={nutrient.key} label={nutrient.label} value={formatNutrientCoverage(info, nutrient.unit, 2)} status={`${nutrientDisplay(info).note}${target ? ` · Saved target: ${target.min ?? '—'}–${target.max ?? '—'} ${nutrient.unit}/day` : ''}`} />;
          })}
        </div>

        <FluidTracker key={selectedDate} date={selectedDate} records={dayRecords[selectedDate]?.fluids || []} entries={selectedReport.items} targetMl={profile.fluidTargetMl} onSave={onSaveFluids} />

        <section className="history-meals-report" aria-labelledby="history-meals-title">
          <header>
            <h3 id="history-meals-title">Meals logged</h3>
            {selectedReport.items.length ? <span>{selectedReport.items.length} item{selectedReport.items.length === 1 ? "" : "s"}</span> : null}
          </header>
          {selectedMeals.length ? (
            <div className="history-meal-report-list">
              {selectedMeals.map(({ meal, items, coverage }) => {
                const MealIcon = mealIcons[meal] || Package;
                return (
                  <article className="history-meal-report-row" key={meal}>
                    <span className="history-meal-report-icon"><MealIcon aria-hidden="true" /></span>
                    <div><strong>{meal}</strong><small>{items.length} item{items.length === 1 ? "" : "s"}</small></div>
                    <span><strong>{formatNutrientCoverage(coverage.calories, 'kcal', 0)}</strong><small>calories</small></span>
                    <span><strong>{formatNutrientCoverage(coverage.sodium, 'mg', 0)}</strong><small>sodium</small></span>
                    <span><strong>{formatNutrientCoverage(coverage.protein, 'g', 1)}</strong><small>protein</small></span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="history-report-empty">
              <CalendarDays aria-hidden="true" />
              <strong>No foods logged for this day</strong>
              <p>Select another date to review its recorded nutrition.</p>
            </div>
          )}
        </section>

        {selectedReport.items.length > 0 && <section className="history-food-items" aria-label="Foods recorded on selected date"><h3>Food details & corrections</h3>{selectedReport.items.map(entry => { const food = entry.source === 'custom' ? entry.customFood : recipesById[entry.recipeId]; const model = food?.recipeCustomization; return <article key={entry.id}><div><strong>{food?.name || 'Unresolved food'}</strong><small>{mealLabel(entry)} · {entry.time || 'Time not recorded'}{entry.time && entry.timeSource !== 'user-recorded' ? entry.timeSource === 'recording-time' ? ' (logging time)' : ' (scheduled time)' : ''} · {formatAmount(entry.servings, 2)} servings</small>{model && Object.keys(model.overrides).length > 0 && <details className="recorded-ingredients-preview"><summary>Ingredients recorded for this meal</summary><ul>{model.ingredients.map((row, index) => { const current = ingredientAmount(row, model.overrides[index], entry.servings); return <li key={index}>{row.text}: {formatAmount(current.amount, 2)} {current.unit === 'count' ? 'pieces' : current.unit}</li>; })}</ul></details>}</div><button className="secondary-button" onClick={() => onEdit?.(entry)}>Edit<span className="sr-only"> {food?.name || 'food'}</span></button></article>; })}</section>}
        <p className="history-report-note"><Info aria-hidden="true" /> Totals describe recorded food only. Review includes incomplete logs, estimated food, or values outside saved targets. A green mark does not certify nutritional adequacy.</p>
        <p className="history-privacy">Confirmed food records are saved to your private cloud account. Care-team accounts can read them only when you grant access.</p>
      </section>
    </main>
  );
}
