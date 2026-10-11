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
import { buildCalendarMonth, historyDayStatus, historyNutritionState } from "../utils/history";
import { formatAmount, localDateKey, mealTotals } from "../utils/nutrition";

import { isDayComplete } from "../utils/recording";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mealOrder = ["Breakfast", "Lunch", "Dinner", "Snack"];
const mealIcons = {
  Breakfast: Coffee,
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

export default function HistoryView({ entries, recipesById, profile: currentProfile, dayRecords = {} }) {
  const today = localDateKey();
  const latestLoggedDate = useMemo(
    () => entries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), ""),
    [entries],
  );
  const initialDate = entries.some((entry) => entry.date === today) ? today : (latestLoggedDate || today);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStartFor(initialDate));
  const selectedComplete = isDayComplete(dayRecords, entries, selectedDate);
  const profile = selectedComplete ? (dayRecords[selectedDate]?.profile || currentProfile) : currentProfile;

  const entriesByDate = useMemo(() => entries.reduce((byDate, entry) => {
    (byDate[entry.date] ??= []).push(entry);
    return byDate;
  }, {}), [entries]);

  const dayReports = useMemo(() => Object.fromEntries(Object.entries(entriesByDate).map(([dateKey, items]) => {
    const totals = mealTotals(items, recipesById);
    const complete = isDayComplete(dayRecords, entries, dateKey);
    const estimated = items.some((item) => item.customFood?.method === "unpackaged");
    const targets = complete ? (dayRecords[dateKey]?.profile || currentProfile) : currentProfile;
    return [dateKey, {
      items,
      totals,
      status: complete && !estimated ? historyDayStatus(totals, items.length, targets) : "review",
    }];
  })), [entriesByDate, currentProfile, recipesById, dayRecords, entries]);

  const calendarCells = useMemo(
    () => buildCalendarMonth(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );
  const selectedReport = dayReports[selectedDate] || {
    items: [],
    totals: mealTotals([], recipesById),
    status: "empty",
  };
  const selectedMeals = useMemo(() => mealOrder.map((meal) => {
    const items = selectedReport.items.filter((entry) => entry.meal === meal);
    return items.length ? { meal, items, totals: mealTotals(items, recipesById) } : null;
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

  const { sodiumProgress, proteinProgress, sodiumStatus, proteinStatus } = historyNutritionState(
    selectedReport.totals, selectedReport.items.length, profile,
  );

  return (
    <main className="history-page history-calendar-page">
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
                    <small>{formatAmount(report.totals.calories, 0)} kcal</small>
                    <small>{formatAmount(report.totals.sodium, 0)} mg</small>
                    <small>{formatAmount(report.totals.protein, 1)} g</small>
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
          <p>{selectedComplete ? "Recording confirmed · targets saved at confirmation" : "Recording not confirmed · current targets shown for reference"}</p>
        </header>

        <div className="history-nutrition-grid">
          <NutritionCard
            label="Calories"
            value={`${formatAmount(selectedReport.totals.calories, 0)} kcal`}
            status={selectedReport.items.length ? "Recorded total" : "No foods recorded"}
          />
          <NutritionCard
            label="Sodium"
            value={`${formatAmount(selectedReport.totals.sodium, 0)} / ${formatAmount(profile.sodiumTargetMg, 0)} mg`}
            progress={sodiumProgress}
            status={sodiumStatus}
          />
          <NutritionCard
            label="Protein"
            value={`${formatAmount(selectedReport.totals.protein, 1)} / ${formatAmount(profile.proteinMinG, 0)}–${formatAmount(profile.proteinMaxG, 0)} g`}
            progress={proteinProgress}
            status={proteinStatus}
          />
        </div>

        <section className="history-meals-report" aria-labelledby="history-meals-title">
          <header>
            <h3 id="history-meals-title">Meals logged</h3>
            {selectedReport.items.length ? <span>{selectedReport.items.length} item{selectedReport.items.length === 1 ? "" : "s"}</span> : null}
          </header>
          {selectedMeals.length ? (
            <div className="history-meal-report-list">
              {selectedMeals.map(({ meal, items, totals }) => {
                const MealIcon = mealIcons[meal] || Package;
                return (
                  <article className="history-meal-report-row" key={meal}>
                    <span className="history-meal-report-icon"><MealIcon aria-hidden="true" /></span>
                    <div><strong>{meal}</strong><small>{items.length} item{items.length === 1 ? "" : "s"}</small></div>
                    <span><strong>{formatAmount(totals.calories, 0)} kcal</strong><small>calories</small></span>
                    <span><strong>{formatAmount(totals.sodium, 0)} mg</strong><small>sodium</small></span>
                    <span><strong>{formatAmount(totals.protein, 1)} g</strong><small>protein</small></span>
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

        <p className="history-report-note"><Info aria-hidden="true" /> Totals describe recorded food only. Review includes incomplete logs, estimated food, or values outside saved targets. A green mark does not certify nutritional adequacy.</p>
        <p className="history-privacy">Confirmed food records are saved to your private cloud account. Care-team accounts can read them only when you grant access.</p>
      </section>
    </main>
  );
}
