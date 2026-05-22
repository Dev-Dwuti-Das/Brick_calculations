import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calculator,
  Clipboard,
  Download,
  Factory,
  RefreshCw,
  Table2,
} from "lucide-react";

const FEEDS = [
  { key: "feed1", label: "HotFaceA" },
  { key: "feed2", label: "ColdFaceA" },
  { key: "feed3", label: "HotFaceB" },
  { key: "feed4", label: "ColdFaceB" },
  { key: "feed5", label: "Brick Height" },
  { key: "feed6", label: "Kill Dia" },
];

const EMPTY_FEEDS = FEEDS.reduce((values, feed) => {
  values[feed.key] = "";
  return values;
}, {});

const PI_VALUE = 3.14;
const numericInputPattern = /^-?\d+(\.\d)?$/;

function formatNumber(value) {
  if (!Number.isFinite(value)) return "--";
  return String(value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5));
}

function parseValue(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function excelValue(value) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeCode(value) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function parseStaticBrickRows(workbook, spreadsheet) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = spreadsheet.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const blockStarts = [0, 7, 14];
  const entries = [];

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    for (const start of blockStarts) {
      const row = rows[rowIndex];
      const shape = String(row[start] ?? "").trim();
      const length = Number(row[start + 1]);
      const height = Number(row[start + 2]);
      const cold = Number(row[start + 3]);
      const hot = Number(row[start + 4]);
      const volume = Number(row[start + 5]);

      if (shape && [length, height, cold, hot].every(Number.isFinite)) {
        entries.push({
          id: `${shape}-${rowIndex}-${start}`,
          shape,
          length,
          height,
          cold,
          hot,
          volume: Number.isFinite(volume) ? volume : "",
        });
      }
    }
  }

  return entries;
}

export default function EngineeringFeedCalculationSystem() {
  const [feeds, setFeeds] = useState(EMPTY_FEEDS);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [brickRows, setBrickRows] = useState([]);
  const [sourceWorkbook, setSourceWorkbook] = useState(null);
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [excelStatus, setExcelStatus] = useState("Loading static Excel file...");
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");

  useEffect(() => {
    async function loadStaticWorkbook() {
      try {
        const xlsxModule = await import("xlsx");
        const response = await fetch("/iso-vdz.xls");
        if (!response.ok) throw new Error("Excel file could not be loaded.");

        const buffer = await response.arrayBuffer();
        const workbook = xlsxModule.read(buffer, { type: "array" });
        const rows = parseStaticBrickRows(workbook, xlsxModule);

        setSpreadsheet(xlsxModule);
        setSourceWorkbook(workbook);
        setBrickRows(rows);
        setExcelStatus(`${rows.length} brick rows loaded from iso-vdz.xls`);
      } catch (error) {
        setExcelStatus(error.message);
      }
    }

    loadStaticWorkbook();
  }, []);

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
    // Feed2 * X + Feed4 * Y = 3.14 * Kill Dia
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
    setSelectedA("");
    setSelectedB("");
  }

  function applyBrickRow(side, code) {
    const normalizedCode = normalizeCode(code);
    const row = brickRows.find(
      (entry) => normalizeCode(entry.shape) === normalizedCode,
    );

    if (side === "A") setSelectedA(code);
    if (side === "B") setSelectedB(code);
    if (!row) return;

    setFeeds((current) => ({
      ...current,
      ...(side === "A"
        ? {
            feed1: excelValue(row.hot),
            feed2: excelValue(row.cold),
            feed5: excelValue(row.height),
          }
        : {
            feed3: excelValue(row.hot),
            feed4: excelValue(row.cold),
            feed5: excelValue(row.height),
          }),
    }));
    setCopied(false);
  }

  function exportExcelResults() {
    if (!spreadsheet) {
      setExcelStatus("Excel tools are still loading. Try again in a moment.");
      return;
    }

    const workbook = spreadsheet.utils.book_new();

    if (sourceWorkbook) {
      for (const sheetName of sourceWorkbook.SheetNames) {
        workbook.SheetNames.push(sheetName);
        workbook.Sheets[sheetName] = sourceWorkbook.Sheets[sheetName];
      }
    }

    const outputRows = [
      ["Engineering Feed Calculation Output"],
      [],
      ["Input", "Value"],
      ["HotFaceA", feeds.feed1],
      ["ColdFaceA", feeds.feed2],
      ["HotFaceB", feeds.feed3],
      ["ColdFaceB", feeds.feed4],
      ["Brick Height", feeds.feed5],
      ["Kill Dia", feeds.feed6],
      [],
      ["Calculated Output", "Value"],
      ["A", formatNumber(result.x)],
      ["B", formatNumber(result.y)],
      ["Status", result.errors.length ? result.errors.join(" ") : "Ready"],
    ];

    const outputSheet = spreadsheet.utils.aoa_to_sheet(outputRows);
    const sheetName = "Calculation Output";

    if (workbook.Sheets[sheetName]) {
      delete workbook.Sheets[sheetName];
      workbook.SheetNames = workbook.SheetNames.filter((name) => name !== sheetName);
    }

    spreadsheet.utils.book_append_sheet(workbook, outputSheet, sheetName);
    spreadsheet.writeFile(workbook, "iso-vdz-with-calculation.xlsx");
  }

  async function copyResults() {
    const summary = [
      "Engineering Feed Calculation System",
      `A: ${formatNumber(result.x)}`,
      `B: ${formatNumber(result.y)}`,
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
      <div className="screen-only fixed inset-0 -z-10 bg-[linear-gradient(rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.055)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />

      <section className="print-only">
        <h1>Engineering Report</h1>
        <div className="print-grid">
          <div>
            <span>Shape A</span>
            <strong>{selectedA || "--"}</strong>
          </div>
          <div>
            <span>Shape B</span>
            <strong>{selectedB || "--"}</strong>
          </div>
          <div>
            <span>A Value</span>
            <strong>{formatNumber(result.x)}</strong>
          </div>
          <div>
            <span>B Value</span>
            <strong>{formatNumber(result.y)}</strong>
          </div>
        </div>
      </section>

      <div className="screen-only mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
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

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-950 dark:bg-slate-900 dark:text-blue-300">
                  <Table2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Static Excel Source
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {excelStatus}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <BrickCodeInput
                  label="Shape A Code"
                  value={selectedA}
                  rows={brickRows}
                  onChange={(value) => applyBrickRow("A", value)}
                />
                <BrickCodeInput
                  label="Shape B Code"
                  value={selectedB}
                  rows={brickRows}
                  onChange={(value) => applyBrickRow("B", value)}
                />
              </div>
            </div>

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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle
                  title="Engineering Report"
                  subtitle="Final calculated outputs rounded to the nearest whole number."
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
                  <button
                    onClick={exportExcelResults}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-950 px-3 text-sm font-black text-white transition hover:bg-blue-900 dark:bg-blue-700 dark:hover:bg-blue-600"
                  >
                    <Table2 className="h-4 w-4" />
                    Excel
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Output label="A Value" value={formatNumber(result.x)} />
                <Output label="B Value" value={formatNumber(result.y)} />
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

function BrickCodeInput({ label, value, rows, onChange }) {
  const matchedRow = rows.find(
    (row) => normalizeCode(row.shape) === normalizeCode(value),
  );
  const listId = `${label.toLowerCase().replace(/\s+/g, "-")}-options`;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="3K 209"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition focus:border-blue-900 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-950"
      />
      <datalist id={listId}>
        {rows.map((row) => (
          <option key={row.id} value={row.shape} />
        ))}
      </datalist>
      {matchedRow && (
        <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          Brick Height {matchedRow.height} | Cold {matchedRow.cold} | Hot{" "}
          {matchedRow.hot}
        </p>
      )}
    </label>
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
