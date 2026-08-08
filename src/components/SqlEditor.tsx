import { useState, useMemo, useEffect } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { sql, SQLite } from "@codemirror/lang-sql"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { Play, Database as DbIcon, Loader2, AlertCircle, RotateCcw, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { SectionTitle } from "@/components/SectionTitle"
import { SortableTh } from "@/components/SortableTh"
import { EmptyState } from "@/components/EmptyState"
import { useTheme } from "@/hooks/useTheme"
import { executeQuery } from "@/lib/db"
import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema"
import { toast } from "sonner"

interface SqlEditorProps {
  query: string
  setQuery: (query: string) => void
}

/**
 * Whether a result value should be rendered as a number.
 *
 * SQLite hands most columns back as strings, so the check is on the shape of
 * the value rather than its type — an all-digit issue number is still worth
 * aligning right.
 */
function isNumericValue(value: unknown): boolean {
  if (typeof value === "number") return true
  if (typeof value !== "string" || value.trim() === "") return false
  return /^-?\d+(\.\d+)?$/.test(value.trim())
}

/** Returns a CodeMirror SQL extension pre-loaded with DB schema for autocompletion */
function useSqlExtension(schema: Record<string, string[]>) {
  return useMemo(() => {
    const dialect = SQLite
    if (Object.keys(schema).length === 0) {
      return sql({ dialect })
    }
    const tables: Record<string, string[]> = schema
    return sql({
      dialect,
      schema: tables,
      defaultSchema: "main",
    })
  }, [schema])
}

export function SqlEditor({ query, setQuery }: SqlEditorProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
    key: "",
    direction: null,
  })
  const [rotating, setRotating] = useState(false)
  const [dbSchema, setDbSchema] = useState<Record<string, string[]>>(DEFAULT_DB_SCHEMA)

  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  // Kept apart from `hiddenColumns`: that set is the user's own choice, and a
  // new result set must not quietly inherit it.
  const [showEmptyColumns, setShowEmptyColumns] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRows, setTotalRows] = useState<number | null>(null)
  const ROWS_PER_PAGE = 1000

  // Ensure fallback works if columns is not set but results are
  useEffect(() => {
    if (results.length > 0 && columnOrder.length === 0) {
      setColumnOrder(Object.keys(results[0]).filter(k => isNaN(Number(k))))
      setHiddenColumns(new Set())
      setShowEmptyColumns(false)
    }
  }, [results, columnOrder])

  /**
   * Columns with nothing in them on this page.
   *
   * Inducks rows are sparse — `doubt`, `error`, `locked` and the various
   * `*comment` fields are empty far more often than not — so a `SELECT *`
   * spends most of its width on blanks. They are folded away by default and
   * can be brought back, rather than dropped silently.
   */
  const emptyColumns = useMemo(() => {
    if (results.length === 0) return new Set<string>()
    const empty = columnOrder.filter((col) =>
      results.every((row) => {
        const value = row[col]
        return value === null || value === undefined || value === ""
      })
    )
    // Folding every column away would leave an empty grid and no way back.
    return empty.length === columnOrder.length ? new Set<string>() : new Set(empty)
  }, [results, columnOrder])

  /**
   * Columns whose every filled value is a number.
   *
   * Alignment is a property of the column, not of the cell: deciding per cell
   * sent `12` right and `12bis` left inside the same column, which reads as a
   * rendering fault. One doubtful value is enough to keep the column textual.
   */
  const numericColumns = useMemo(() => {
    if (results.length === 0) return new Set<string>()
    return new Set(
      columnOrder.filter((col) => {
        let sawValue = false
        for (const row of results) {
          const value = row[col]
          if (value === null || value === undefined || value === "") continue
          if (!isNumericValue(value)) return false
          sawValue = true
        }
        return sawValue
      })
    )
  }, [results, columnOrder])

  const visibleColumns = useMemo(() => {
    return columnOrder.filter(
      (col) => !hiddenColumns.has(col) && (showEmptyColumns || !emptyColumns.has(col))
    )
  }, [columnOrder, hiddenColumns, emptyColumns, showEmptyColumns])

  const handleHideColumn = (col: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      next.add(col)
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, col: string) => {
    e.dataTransfer.setData("text/plain", col)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault() // Required to allow dropping
  }

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetCol: string) => {
    e.preventDefault()
    const sourceCol = e.dataTransfer.getData("text/plain")
    if (sourceCol === targetCol) return

    setColumnOrder((prev) => {
      const newOrder = [...prev]
      const sourceIdx = newOrder.indexOf(sourceCol)
      const targetIdx = newOrder.indexOf(targetCol)
      if (sourceIdx !== -1 && targetIdx !== -1) {
        newOrder.splice(sourceIdx, 1)
        newOrder.splice(targetIdx, 0, sourceCol)
      }
      return newOrder
    })
  }

  // Use default schema for autocompletion (standalone mode)
  useEffect(() => {
    setDbSchema(DEFAULT_DB_SCHEMA)
  }, [])

  const sqlExtension = useSqlExtension(dbSchema)

  // Light theme customization for the editor
  const lightTheme = EditorView.theme({
    "&": {
      backgroundColor: "hsl(var(--surface))",
      color: "hsl(var(--text-body))",
      fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      fontSize: "13px",
    },
    ".cm-gutters": {
      backgroundColor: "hsl(var(--surface-2))",
      borderRight: "1px solid hsl(var(--border-subtle))",
      color: "hsl(var(--text-hint))",
    },
    ".cm-activeLineGutter": { backgroundColor: "hsl(var(--surface-3))" },
    ".cm-activeLine": { backgroundColor: "hsl(var(--surface-2))" },
    ".cm-cursor": { borderLeftColor: "hsl(var(--primary))" },
    ".cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.15) !important" },
    ".cm-tooltip": {
      backgroundColor: "hsl(var(--surface))",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 4px 16px rgba(0,0,0,.12)",
      borderRadius: "8px",
    },
    ".cm-tooltip-autocomplete > ul": {
      maxHeight: "220px",
      fontFamily: "'Fira Code', monospace",
      fontSize: "12px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "hsl(var(--primary))",
      color: "#fff",
    },
    ".cm-completionLabel": { color: "hsl(var(--text-body))" },
    ".cm-completionDetail": { color: "hsl(var(--text-hint))", fontStyle: "italic" },
  })

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("inducks_sql_history")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const executeQueryWithPage = async (page: number) => {
    setLoading(true)
    setError(null)
    setSortConfig({ key: "", direction: null })

    if (query.trim() && page === 1) {
      setHistory((prev) => {
        const filtered = prev.filter((q) => q.trim() !== query.trim())
        const nextHistory = [...filtered, query]
        if (nextHistory.length > 50) nextHistory.shift()
        localStorage.setItem("inducks_sql_history", JSON.stringify(nextHistory))
        setHistoryIndex(nextHistory.length - 1)
        return nextHistory
      })
    }

    try {
      const lowerQuery = query.trim().toLowerCase()
      if (!lowerQuery.startsWith("select") && !lowerQuery.startsWith("with") && !lowerQuery.startsWith("pragma")) {
        throw new Error("Only SELECT, WITH, and PRAGMA queries are allowed.")
      }

      let executableSql = query.trim()
      let finalTotalRows = null
      let hasLimit = /\blimit\s+\d+/i.test(executableSql)

      if (!hasLimit && !lowerQuery.startsWith("pragma")) {
        try {
          const countRes = await executeQuery({ sql: `SELECT COUNT(*) as count FROM (${executableSql})`, args: [] })
          if (countRes.rows && countRes.rows[0]) {
            finalTotalRows = Number(countRes.rows[0].count)
          }
        } catch(e) {
          console.error("Failed to count rows:", e)
        }
        executableSql = `${executableSql} LIMIT ${ROWS_PER_PAGE} OFFSET ${(page - 1) * ROWS_PER_PAGE}`
      }

      const result = await executeQuery({ sql: executableSql, args: [] })
      const rows = result.rows || []
      const columns = result.columns || (rows.length > 0 ? Object.keys(rows[0]).filter(k => isNaN(Number(k))) : [])

      // `getColumnNames()` keeps duplicates — `SELECT *` over a join returns
      // `storycode` twice — but the rows are objects keyed by column name, so
      // sql.js has already collapsed them to a single value. Rendering the
      // second column would fill it with the first one's data, which is worse
      // than not showing it: the value is genuinely no longer distinguishable.
      const uniqueColumns = [...new Set(columns as string[])]

      setColumnOrder(uniqueColumns)
      setHiddenColumns(new Set())
      setResults(rows)
      
      setTotalRows(finalTotalRows)
      setCurrentPage(page)
      
      const count = rows.length
      const displayTotal = finalTotalRows !== null ? finalTotalRows : count
      
      toast.success(
        t("sql.results_count", { count: displayTotal, defaultValue: `${displayTotal} result(s) found` }), 
        { description: t("sql.query_success") }
      )
    } catch (err: any) {
      setError(err?.message || "Unable to execute SQL query")
    } finally {
      setLoading(false)
    }
  }

  const handleRunQuery = () => executeQueryWithPage(1)

  const handleGoBack = () => {
    if (history.length === 0) return
    setRotating(true)
    setTimeout(() => setRotating(false), 400)

    let nextIndex = historyIndex
    if (nextIndex === -1) nextIndex = history.length - 1
    else nextIndex = nextIndex - 1
    if (nextIndex < 0) nextIndex = history.length - 1

    setHistoryIndex(nextIndex)
    setQuery(history[nextIndex])
  }

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc"
    else if (sortConfig.key === key && sortConfig.direction === "desc") direction = null
    setSortConfig({ key, direction })
  }

  const sortedResults = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return results
    return [...results].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum
      }
      const sA = String(aVal).toLowerCase()
      const sB = String(bVal).toLowerCase()
      if (sA < sB) return sortConfig.direction === "asc" ? -1 : 1
      if (sA > sB) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
  }, [results, sortConfig])

  const editorExtensions = useMemo(
    () => [sqlExtension, EditorView.lineWrapping],
    [sqlExtension]
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <SectionTitle icon={DbIcon}>{t("sql.title")}</SectionTitle>
                <a
                  href="https://inducks.org/bolderbast/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-hint hover:text-text-secondary transition-colors"
                  title={t("sql.docs_title")}
                >
                  <Info className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleGoBack}
                  disabled={history.length === 0}
                  title={t("sql.previous_query")}
                  type="button"
                >
                  <RotateCcw
                    className={cn("w-4 h-4 transition-transform duration-300", rotating && "-rotate-45")}
                  />
                </Button>
                <Button onClick={handleRunQuery} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {t("sql.run_query")}
                </Button>
              </div>
            </div>

            {/* Schema hint */}
            {Object.keys(dbSchema).length > 0 && (
              <div className="flex overflow-x-auto gap-2 text-[10px] items-center pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <span className="text-text-hint font-medium whitespace-nowrap shrink-0">{t("sql.tables")}</span>
                {Object.keys(dbSchema).map((tbl) => (
                  <span
                    key={tbl}
                    className="px-2 py-0.5 bg-surface-2 border border-border-subtle rounded font-mono text-primary cursor-pointer hover:bg-surface-3 transition-colors whitespace-nowrap shrink-0"
                    onClick={() => setQuery(`SELECT * FROM ${tbl} LIMIT 20`)}
                    title={`Colonnes : ${dbSchema[tbl].join(", ")}`}
                  >
                    {tbl}
                  </span>
                ))}
              </div>
            )}

            {/* CodeMirror editor */}
            <div className="rounded-xl overflow-hidden border border-border ring-0 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <CodeMirror
                value={query}
                height="220px"
                extensions={editorExtensions}
                theme={isDark ? oneDark : lightTheme}
                onChange={(val) => setQuery(val)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault()
                    handleRunQuery()
                  }
                }}
                placeholder={t("sql.placeholder")}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  foldGutter: false,
                  autocompletion: true,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
              />
            </div>


          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md flex gap-3 text-destructive items-center">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <Card className="rounded-2xl border border-border shadow-xl overflow-hidden bg-surface">
          {emptyColumns.size > 0 && (
            <div className="px-4 py-2 border-b border-border-subtle bg-surface-2/50 flex items-center justify-between gap-3 text-xs">
              <span className="text-text-hint">
                {t("sql.empty_columns_hidden", { count: emptyColumns.size })}
              </span>
              <button
                onClick={() => setShowEmptyColumns((prev) => !prev)}
                className="font-semibold text-primary hover:underline underline-offset-2 shrink-0"
              >
                {showEmptyColumns ? t("sql.empty_columns_fold") : t("sql.empty_columns_show")}
              </button>
            </div>
          )}
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 z-10 text-xs text-text-hint uppercase border-b border-border font-bold tracking-wider bg-surface/95 backdrop-blur-sm shadow-sm shadow-border/40">
                <tr>
                  {visibleColumns.map((col) => (
                    <SortableTh
                      key={col}
                      col={col}
                      sortKey={sortConfig.key}
                      direction={sortConfig.direction}
                      onSort={handleSort}
                      onHide={handleHideColumn}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/60">
                {sortedResults.map((row, i) => (
                  // Zebra striping earns its keep here: a result set can be
                  // dozens of columns wide, and the eye needs something to hold
                  // on to when tracking a row across a horizontal scroll.
                  <tr
                    key={i}
                    className={cn(
                      "transition-colors hover:bg-primary/5",
                      i % 2 === 0 ? "bg-surface" : "bg-surface-2/40"
                    )}
                  >
                    {visibleColumns.map((col) => {
                      const value = row[col]
                      const isEmpty = value === null || value === undefined || value === ""
                      return (
                        <td
                          key={col}
                          className={cn(
                            "px-4 py-2.5 text-text-body whitespace-nowrap border-r border-border-subtle/40 last:border-r-0",
                            // Everything stays left-aligned: mixing left and
                            // right columns reads as a rendering fault. Digits
                            // still line up thanks to the tabular figures.
                            numericColumns.has(col) && "tabular-nums",
                            isEmpty && "text-text-hint/50 italic"
                          )}
                        >
                          {isEmpty ? "—" : String(value)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalRows !== null && totalRows > ROWS_PER_PAGE && (
            <div className="p-4 bg-surface-2 border-t border-border flex items-center justify-between text-sm">
              <div className="text-text-hint">
                Affichage de {(currentPage - 1) * ROWS_PER_PAGE + 1} à {Math.min(currentPage * ROWS_PER_PAGE, totalRows)} sur {totalRows} résultats
              </div>
              <div className="flex gap-2">
                <Button 
                  disabled={currentPage === 1 || loading} 
                  onClick={() => executeQueryWithPage(currentPage - 1)} 
                  variant="outline" 
                  size="sm"
                >
                  Précédent
                </Button>
                <Button 
                  disabled={currentPage * ROWS_PER_PAGE >= totalRows || loading} 
                  onClick={() => executeQueryWithPage(currentPage + 1)} 
                  variant="outline" 
                  size="sm"
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {results.length === 0 && !loading && !error && (
        <EmptyState
          icon={DbIcon}
          title={t("sql.no_results")}
          description={t("sql.no_results_desc")}
        />
      )}
    </div>
  )
}
