import { useState, useEffect, useRef } from "react"
import axios from "axios"

const API = "/api"

const SUGGESTIONS = [
  "Show me all customers from Canada",
  "What is the total revenue per category?",
  "Which products have less than 100 units in stock?",
  "List the top 3 customers by total spending",
  "How many orders were placed in the last 30 days?",
]

function ConfidenceBadge({ level }) {
  const map = {
    high:   { bg: "rgba(29,158,117,0.15)", color: "#4ade80", dot: "#4ade80", label: "High confidence" },
    medium: { bg: "rgba(186,117,23,0.15)", color: "#fbbf24", dot: "#fbbf24", label: "Medium confidence" },
    low:    { bg: "rgba(226,75,74,0.15)",  color: "#f87171", dot: "#f87171", label: "Low confidence" },
  }
  const s = map[level] || map.low
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: s.bg, color: s.color, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, border: `0.5px solid ${s.dot}40` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {s.label}
    </span>
  )
}

function TypewriterText({ text }) {
  const [displayed, setDisplayed] = useState("")
  useEffect(() => {
    setDisplayed("")
    let i = 0
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1))
      i++
      if (i >= text.length) clearInterval(interval)
    }, 16)
    return () => clearInterval(interval)
  }, [text])
  return (
    <span style={{ color: "#94a3b8" }}>
      {displayed}
      <span style={{ borderRight: "2px solid #378ADD", animation: "blink 1s step-end infinite", marginLeft: 1 }} />
    </span>
  )
}

function ParticleCanvas() {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -999, y: -999 })

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas.parentElement
    canvas.width = parent.offsetWidth
    canvas.height = parent.offsetHeight
    const ctx = canvas.getContext("2d")

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      opacity: Math.random() * 0.5 + 0.1,
    }))

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    canvas.parentElement.addEventListener("mousemove", onMouseMove)

    let raf
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const mouse = mouseRef.current

      particles.forEach(p => {
        // Cursor repulsion
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < 100 && dist > 0) {
          const force = (100 - dist) / 100
          p.x += (dx / dist) * force * 2
          p.y += (dy / dist) * force * 2
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(55,138,221,${p.opacity})`
        ctx.fill()

        p.x += p.dx
        p.y += p.dy
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1
      })

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y)
          if (dist < 90) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(55,138,221,${0.15 * (1 - dist / 90)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Cursor glow ring
      if (mouse.x > 0) {
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 40, 0, Math.PI * 2)
        ctx.strokeStyle = "rgba(55,138,221,0.12)"
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(55,138,221,0.3)"
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      canvas.parentElement?.removeEventListener("mousemove", onMouseMove)
    }
  }, [])

  return (
    <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
  )
}

function highlightSQL(sql) {
  const KEYWORDS = [
    "SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","FULL",
    "CROSS","ON","GROUP BY","ORDER BY","HAVING","LIMIT","OFFSET","AS",
    "AND","OR","NOT","IN","IS","NULL","LIKE","BETWEEN","CASE","WHEN",
    "THEN","ELSE","END","DISTINCT","COUNT","SUM","AVG","MIN","MAX",
    "UNION","ALL","EXISTS","BY","ASC","DESC","INTERVAL","NOW",
  ]
  const tokens = []
  let remaining = sql
  while (remaining.length > 0) {
    if (remaining[0] === "'") {
      const end = remaining.indexOf("'", 1)
      if (end === -1) { tokens.push({ type: "string", value: remaining }); break }
      tokens.push({ type: "string", value: remaining.slice(0, end + 1) })
      remaining = remaining.slice(end + 1)
      continue
    }
    const numMatch = remaining.match(/^\d+(\.\d+)?/)
    if (numMatch) {
      tokens.push({ type: "number", value: numMatch[0] })
      remaining = remaining.slice(numMatch[0].length)
      continue
    }
    let matched = false
    for (const kw of ["GROUP BY", "ORDER BY"]) {
      if (remaining.toUpperCase().startsWith(kw)) {
        tokens.push({ type: "keyword", value: remaining.slice(0, kw.length) })
        remaining = remaining.slice(kw.length)
        matched = true
        break
      }
    }
    if (matched) continue
    const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)
    if (wordMatch) {
      const word = wordMatch[0]
      tokens.push({ type: KEYWORDS.includes(word.toUpperCase()) ? "keyword" : "identifier", value: word })
      remaining = remaining.slice(word.length)
      continue
    }
    tokens.push({ type: "plain", value: remaining[0] })
    remaining = remaining.slice(1)
  }
  return tokens
}

function SqlBlock({ sql }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const colorMap = { keyword: "#60a5fa", string: "#4ade80", number: "#fbbf24", identifier: "#e2e8f0", plain: "#64748b" }
  return (
    <div style={{ background: "#080d14", borderRadius: 10, overflow: "hidden", marginTop: 16, border: "0.5px solid #1e2d40" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "0.5px solid #1e2d40" }}>
        <span style={{ fontSize: 11, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase" }}>Generated SQL</span>
        <button onClick={copy} style={{ background: "none", border: "none", color: copied ? "#4ade80" : "#475569", cursor: "pointer", fontSize: 12, padding: "2px 8px", borderRadius: 4 }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "16px", fontSize: 13, lineHeight: 1.8, overflowX: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", whiteSpace: "pre-wrap" }}>
        {highlightSQL(sql).map((token, i) => (
          <span key={i} style={{ color: colorMap[token.type] }}>{token.value}</span>
        ))}
      </pre>
    </div>
  )
}

function ResultTable({ columns, rows }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "0.5px solid #1e2d40", marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#0d1520" }}>
            {columns.map(col => (
              <th key={col} style={{ textAlign: "left", padding: "10px 14px", borderBottom: "0.5px solid #1e2d40", fontWeight: 500, color: "#64748b", whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}
              style={{ background: i % 2 === 0 ? "#080d14" : "#0a1018", transition: "background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f1e30"}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#080d14" : "#0a1018"}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 14px", borderBottom: "0.5px solid #0f1a24", color: cell === null ? "#334155" : "#cbd5e1" }}>
                  {cell ?? <em style={{ color: "#334155" }}>NULL</em>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function App() {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  async function handleSubmit(q) {
    const query = q || question
    if (!query.trim()) return
    setQuestion(query)
    setShowSuggestions(false)
    setLoading(true)
    setResult(null)
    try {
      const res = await axios.post(`${API}/query`, { question: query })
      setResult(res.data)
      setHistory(h => [res.data, ...h].slice(0, 8))
    } catch (e) {
      setResult({ error: e.response?.data?.detail || "Something went wrong.", is_valid: false, confidence: "low", sql: "", question: query })
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === "Escape") setShowSuggestions(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060b12", fontFamily: "system-ui, -apple-system, sans-serif", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4} }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .suggestion-item:hover { background: #0d1a2a !important; }
        .history-item:hover { border-color: #378ADD !important; background: #0a1520 !important; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #060b12; }
        ::-webkit-scrollbar-thumb { background: #1e2d40; border-radius: 3px; }
      `}</style>

      {/* Full-page canvas background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <ParticleCanvas />
      </div>

      {/* Content */}
      <div style={{position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column"  }}>

        {/* Nav */}
        {/* Nav */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 40px", borderBottom: "0.5px solid #0f1a24", background: "rgba(6,11,18,0.85)", backdropFilter: "blur(12px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#fff" }}>Q</div>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#e2e8f0" }}>QueryAI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(29,158,117,0.1)", border: "0.5px solid rgba(29,158,117,0.3)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#4ade80" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            Guardrails active
          </div>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", padding: "140px 24px 80px" }}>
          <div style={{ display: "inline-block", background: "rgba(24,95,165,0.1)", border: "0.5px solid rgba(55,138,221,0.25)", borderRadius: 20, padding: "6px 16px", fontSize: 12, color: "#378ADD", marginBottom: 24, letterSpacing: "0.04em" }}>
            Natural language → SQL
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 700, color: "#f1f5f9", margin: "0 0 16px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Ask your database<br />
            <span style={{ color: "#378ADD" }}>anything.</span>
          </h1>
          <p style={{ fontSize: 17, color: "#64748b", margin: "0 0 48px", maxWidth: 500, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
            Plain English questions, safe SQL execution, hallucination detection built in.
          </p>

          {/* Search */}
          <div style={{ maxWidth: 660, margin: "0 auto", position: "relative" }}>
            <div style={{ display: "flex", gap: 0, background: "#0a1520", border: "0.5px solid #1e3a5f", borderRadius: 14, overflow: "visible", padding: 0 }}>
              <input
                value={question}
                onChange={e => { setQuestion(e.target.value); setShowSuggestions(e.target.value.length === 0) }}
                onFocus={() => question.length === 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={handleKey}
                placeholder="e.g. Show me total revenue by category..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 15, padding: "16px 20px", fontFamily: "inherit" }}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                style={{ background: loading ? "#0c3060" : "#185FA5", border: "none", borderRadius: "0 13px 13px 0", padding: "14px 28px", color: "#fff", fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.2s", whiteSpace: "nowrap" }}
              >
                {loading
                  ? <span style={{ width: 14, height: 14, border: "2px solid #ffffff30", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  : <span style={{ fontSize: 16 }}>→</span>
                }
                {loading ? "Running" : "Run"}
              </button>
            </div>

            {showSuggestions && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#0a1520", borderRadius: 12, border: "0.5px solid #1e3a5f", overflow: "hidden", zIndex: 20, textAlign: "left" }}>
                <div style={{ padding: "8px 16px", fontSize: 10, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "0.5px solid #0f1a24" }}>
                  Suggestions
                </div>
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} className="suggestion-item" onMouseDown={() => handleSubmit(s)}
                    style={{ padding: "11px 16px", fontSize: 14, color: "#94a3b8", cursor: "pointer", borderBottom: i < SUGGESTIONS.length - 1 ? "0.5px solid #0f1a24" : "none", transition: "background 0.1s", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#334155", fontSize: 12 }}>→</span>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {(result || history.length > 0) && (
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 80px" }}>

            {result && (
              <div className="fade-up" style={{ marginBottom: 40 }}>
                <div style={{ background: "#080d14", border: "0.5px solid #1e2d40", borderRadius: 14, overflow: "hidden" }}>

                  {/* Result header */}
                  <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #0f1a24", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <ConfidenceBadge level={result.confidence} />
                      {result.rows_returned != null && (
                        <span style={{ fontSize: 13, color: "#475569" }}>{result.rows_returned} row{result.rows_returned !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {result.alignment_score != null && (
                      <span style={{ fontSize: 12, color: "#334155" }}>Alignment {Math.round(result.alignment_score * 100)}%</span>
                    )}
                  </div>

                  <div style={{ padding: "20px" }}>

                    {result.error && (
                      <div style={{ background: "rgba(226,75,74,0.1)", border: "0.5px solid rgba(226,75,74,0.3)", borderRadius: 8, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 12 }}>
                        Blocked: {result.error}
                      </div>
                    )}

                    {result.warning && (
                      <div style={{ background: "rgba(186,117,23,0.1)", border: "0.5px solid rgba(186,117,23,0.3)", borderRadius: 8, padding: "12px 16px", color: "#fbbf24", fontSize: 13, marginBottom: 12 }}>
                        {result.warning}
                      </div>
                    )}

                    {result.sanity_issues?.map((issue, i) => (
                      <div key={i} style={{ background: "rgba(186,117,23,0.1)", border: "0.5px solid rgba(186,117,23,0.3)", borderRadius: 8, padding: "12px 16px", color: "#fbbf24", fontSize: 13, marginBottom: 12 }}>
                        {issue}
                      </div>
                    ))}

                    {result.sql && <SqlBlock sql={result.sql} />}

                    {result.back_translation && (
                      <div style={{ marginTop: 12, fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#334155", flexShrink: 0 }}>Interpreted as:</span>
                        <TypewriterText text={result.back_translation} />
                      </div>
                    )}

                    {result.rows?.length > 0 && <ResultTable columns={result.columns} rows={result.rows} />}

                    {result.confidence_breakdown && (
                      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {[
                          { label: "Schema", value: result.confidence_breakdown.schema_validation },
                          { label: "Alignment", value: result.confidence_breakdown.back_translation_alignment },
                          { label: "Sanity", value: result.confidence_breakdown.result_sanity },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a1118", border: "0.5px solid #1e2d40", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: value === "pass" || value === "high" ? "#4ade80" : value === "medium" ? "#fbbf24" : "#f87171", display: "inline-block" }} />
                            <span style={{ color: "#475569" }}>{label}</span>
                            <span style={{ color: "#94a3b8", fontWeight: 500 }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {history.length > 1 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Recent queries
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {history.slice(1).map((h, i) => (
                    <div key={i} className="history-item"
                      onClick={() => handleSubmit(h.question)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 10, border: "0.5px solid #1e2d40", background: "#080d14", cursor: "pointer", transition: "all 0.15s" }}>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{h.question}</span>
                      <ConfidenceBadge level={h.confidence} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Footer */}
        {/* Footer */}
<div style={{ marginTop: "auto", borderTop: "0.5px solid #0f1a24", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
    <span style={{ fontSize: 12, color: "#334155" }}>76% accuracy</span>
    <span style={{ fontSize: 12, color: "#334155" }}>100% guardrail block rate</span>
    <span style={{ fontSize: 12, color: "#334155" }}>82% high confidence</span>
    <span style={{ fontSize: 12, color: "#334155" }}>55 test cases</span>
  </div>
  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
    <a href="https://www.linkedin.com/in/asharib-tariq/" target="_blank" rel="noreferrer"
      style={{ fontSize: 12, color: "#334155", textDecoration: "none" }}
      onMouseEnter={e => e.target.style.color = "#378ADD"}
      onMouseLeave={e => e.target.style.color = "#334155"}
    >LinkedIn</a>
    <a href="https://github.com/asharibtariq/text-to-sql" target="_blank" rel="noreferrer"
      style={{ fontSize: 12, color: "#334155", textDecoration: "none" }}
      onMouseEnter={e => e.target.style.color = "#378ADD"}
      onMouseLeave={e => e.target.style.color = "#334155"}
    >GitHub</a>
    <span style={{ fontSize: 12, color: "#1e3a5f" }}>Built by Asharib Tariq</span>
  </div>
</div>
    </div>
  )
}