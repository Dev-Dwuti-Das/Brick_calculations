import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calculator,
  Clipboard,
  Download,
  Factory,
  RefreshCw,
  Sigma,
} from "lucide-react";

const FEEDS = [
  { key: "feed1", label: "HotFaceA" },
  { key: "feed2", label: "ColdFaceA" },
  { key: "feed3", label: "HotFaceB" },
  { key: "feed4", label: "ColdFaceB" },
  { key: "feed5", label: "Brick Height" },
  { key: "feed6", label: "Big Dia" },
];

const EMPTY_FEEDS = FEEDS.reduce((values, feed) => {
  values[feed.key] = "";
  return values;
}, {});

const PI_VALUE = 3.14;
const numericInputPattern = /^-?\d+(\.\d)?$/;

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "--";
}

function parseValue(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function EngineeringFeedCalculationSystem() {
  const [feeds, setFeeds] = useState(EMPTY_FEEDS);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const values = Object.fromEntries(
      Object.entries(feeds).map(([key, value]) => [key, parseValue(value)]),
    );

    const missing = FEEDS.filter((feed) => values[feed.key] === null).map(
      (feed) => feed.label,
    );

    const precisionErrors = FEEDS.filter((feed) => {
      const value = feeds[feed.key];
      return value !== "" && !numericInputPattern.test(value);
    }).map((feed) => feed.label);

    const difference =
      values.feed6 !== null && values.feed5 !== null
        ? values.feed6 - values.feed5
        : Number.NaN;

    const smallDia =
      values.feed6 !== null && values.feed5 !== null
        ? values.feed6 - 2 * values.feed5
        : Number.NaN;

    const equation2Right = Number.isFinite(smallDia)
      ? PI_VALUE * smallDia
      : Number.NaN;

    const equation3Right =
      values.feed6 !== null ? PI_VALUE * values.feed6
      : Number.NaN;

    const errors = [];

    if (missing.length) {
      errors.push(`Missing required fields: ${missing.join(", ")}.`);
    }

    if (precisionErrors.length) {
      errors.push(
        `Use whole numbers or one decimal place for: ${precisionErrors.join(", ")}.`,
      );
    }

    const determinant =
      values.feed1 !== null &&
      values.feed2 !== null &&
      values.feed3 !== null &&
      values.feed4 !== null
        ? values.feed1 * values.feed4 - values.feed2 * values.feed3
        : Number.NaN;

    if (
      !missing.length &&
      !precisionErrors.length &&
      Number.isFinite(determinant) &&
      Math.abs(determinant) < 1e-9
    ) {
      errors.push(
        "Cannot calculate X and Y because HotFaceA × ColdFaceB equals ColdFaceA × HotFaceB. Change one of those four values.",
      );
    }

    // Solve the corrected 2x2 linear system using Cramer's rule:
    // Feed1 * X + Feed3 * Y = 3.14 * Small Dia
    // Feed2 * X + Feed4 * Y = 3.14 * Big Dia
    const canSolve =
      !missing.length &&
      !precisionErrors.length &&
      Number.isFinite(determinant) &&
      Math.abs(determinant) >= 1e-9 &&
      Number.isFinite(equation2Right) &&
      Number.isFinite(equation3Right);

    const xNumerator = canSolve
      ? equation2Right * values.feed4 - values.feed3 * equation3Right
      : Number.NaN;

    const yNumerator = canSolve
      ? values.feed1 * equation3Right - equation2Right * values.feed2
      : Number.NaN;

    const x = canSolve
      ? xNumerator / determinant
      : Number.NaN;

    const y = canSolve ? yNumerator / determinant : Number.NaN;

    return {
      values,
      difference,
      smallDia,
      equation2Right,
      equation3Right,
      determinant,
      errors,
      x,
      y,
    };
  }, [feeds]);

  const visibleErrors = submitted
    ? result.errors
    : result.errors.filter((error) => !error.startsWith("Missing"));

  function updateFeed(key, value) {
    setFeeds((current) => ({ ...current, [key]: value }));
    setCopied(false);
  }

  function resetForm() {
    setFeeds(EMPTY_FEEDS);
    setSubmitted(false);
    setCopied(false);
  }

  async function copyResults() {
    const summary = [
      "Engineering Feed Calculation System",
      `Difference: ${formatNumber(result.difference)}`,
      `Small Dia: ${formatNumber(result.smallDia)}`,
      `X: ${formatNumber(result.x)}`,
      `Y: ${formatNumber(result.y)}`,
      `HotFaceA × X + HotFaceB × Y RHS: ${formatNumber(result.equation2Right)}`,
      `ColdFaceA × X + ColdFaceB × Y RHS: ${formatNumber(result.equation3Right)}`,
      `Determinant: ${formatNumber(result.determinant)}`,
      `Status: ${result.errors.length ? result.errors.join(" ") : "Ready"}`,
    ].join("\n");

    await navigator.clipboard.writeText(summary);
    setCopied(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.055)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-950 text-white shadow-sm dark:bg-blue-700">
                <Factory className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Feed Calculation
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
                  Feed Calculation System
                </h1>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200 dark:bg-slate-800 sm:grid-cols-4">
            <HeaderStat label="Difference" value={formatNumber(result.difference)} />
            <HeaderStat label="Small Dia" value={formatNumber(result.smallDia)} />
            <HeaderStat label="X Value" value={formatNumber(result.x)} />
            <HeaderStat label="Y Value" value={formatNumber(result.y)} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.86fr)_1.14fr]">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <SectionTitle
              title="Feed Inputs"
              subtitle="Enter whole numbers or decimal values with one decimal place."
              icon={Calculator}
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {FEEDS.map((feed) => {
                const value = feeds[feed.key];
                const invalidPrecision =
                  value !== "" && !numericInputPattern.test(value);
                const missing = submitted && value === "";
                const invalid = invalidPrecision || missing;

                return (
                  <label key={feed.key} className="group block">
                    <span className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-200">
                      {feed.label}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={value}
                      onChange={(event) => updateFeed(feed.key, event.target.value)}
                      placeholder="0.0"
                      className={`h-12 w-full rounded-xl border bg-slate-50 px-4 text-lg font-bold text-slate-950 outline-none transition duration-200 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:ring-4 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 dark:focus:bg-slate-900 dark:focus:text-white ${
                        invalid
                          ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-950"
                          : "border-slate-200 focus:border-blue-900 focus:ring-blue-100 dark:border-slate-800 dark:focus:border-blue-500 dark:focus:ring-blue-950"
                      }`}
                    />
                    {invalid && (
                      <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">
                        Required format: whole number or 1 decimal place.
                      </p>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="sticky bottom-0 -mx-5 mt-6 border-t border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  onClick={() => setSubmitted(true)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-950 px-5 text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-blue-950"
                >
                  <Calculator className="h-5 w-5" />
                  Calculate
                </button>
                <button
                  onClick={resetForm}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-base font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                >
                  <RefreshCw className="h-5 w-5" />
                  Reset
                </button>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid gap-6"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SectionTitle
                title="Calculation Model"
                subtitle="Formula trace and live right-side evaluation."
                icon={Sigma}
              />

              <div className="mt-5 grid gap-3">
                <Equation
                  label="Equation 1"
                  formula="Difference = Big Dia - Brick Height"
                />
                <Equation
                  label="Small Dia"
                  formula="Small Dia = Big Dia - 2 x Brick Height"
                />
                <Equation
                  label="Equation 2"
                  formula="HotFaceA x X + HotFaceB x Y = 3.14 x Small Dia"
                />
                <Equation
                  label="Equation 3"
                  formula="ColdFaceA x X + ColdFaceB x Y = 3.14 x Big Dia"
                />
              </div>

              {visibleErrors.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <h3 className="font-black">System Notice</h3>
                      <div className="mt-2 space-y-1 text-sm font-medium leading-6">
                        {visibleErrors.map((error) => (
                          <p key={error}>{error}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle
                  title="Engineering Report"
                  subtitle="Final calculated outputs rounded to two decimals."
                  icon={Factory}
                />

                <div className="flex gap-2">
                  <button
                    onClick={copyResults}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    <Clipboard className="h-4 w-4" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-4">
                <Output label="Difference" value={formatNumber(result.difference)} />
                <Output label="Small Dia" value={formatNumber(result.smallDia)} />
                <Output label="X Value" value={formatNumber(result.x)} />
                <Output label="Y Value" value={formatNumber(result.y)} />
              </div>

            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-blue-950 dark:bg-slate-800 dark:text-blue-300">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function HeaderStat({ label, value }) {
  return (
    <div className="bg-slate-50 px-5 py-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-300">
        {value}
      </p>
    </div>
  );
}

function Equation({ label, formula }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition dark:border-slate-800 dark:bg-slate-950"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-base">
        {formula}
      </p>
    </motion.div>
  );
}

function Output({ label, value }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-blue-950 dark:text-blue-200">
        {value}
      </p>
    </motion.div>
  );
}
