import { useState, useEffect, useRef } from "react"
import axios from "axios"

const API = "http://localhost:8000"

const SUGGESTIONS = [
  "Show me all customers from Canada",
  "What is the total revenue per category?",
  "Which products have less than 100 units in stock?",
  "List the top 3 customers by total spending",
  "How many orders were placed in the last 30 days?",
]

function ConfidenceBadge({ level }) {
  const map = {
    high:   { bg: "#e1f5ee", color: "#085041", dot: "#1D9E75", label: "High confidence" },
    medium: { bg: "#faeeda", color: "#633806", dot: "#BA7517", label: "Medium confidence" },
    low:    { bg: "#fcebeb", color: "#791f1f", dot: "#E24B4A", label: "Low confidence" },
  }
  const s = map[level] || map.low
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: s.bg, color: s.color, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
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
    }, 18)
    return () => clearInterval(interval)
  }, [text])
  return <span>{displayed}<span style={{ borderRight: "2px solid #185FA5", animation: "blink 1s step-end infinite", marginLeft: 1 }} /></span>
}

function ParticleCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas.parentElement
    canvas.width = parent.offsetWidth
    canvas.height = parent.offsetHeight
    const ctx = canvas.getContext("2d")
    const particles = Array.from({ length: 38 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.4 + 0.1,
    }))
    let raf
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(24, 95, 165, ${p.opacity})`
        ctx.fill()
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1
      })
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y)
          if (dist < 80) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(24, 95, 165, ${0.12 * (1 - dist / 80)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  )
}

function SqlBlock({ sql }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const keywords = ["SELECT", "FROM", "WHERE", "JOIN", "ON", "GROUP BY", "ORDER BY", "LIMIT", "LEFT", "INNER", "RIGHT", "AS", "AND", "OR", "NOT", "IN", "IS", "NULL", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "HAVING", "BY"]
  let highlighted = sql
  keywords.forEach(kw => {
    highlighted = highlighted.replace(new RegExp(`\\b(${kw})\\b`, "g"), `<span style="color:#185FA5;font-weight:500">$1</span>`)
  })
  highlighted = highlighted.replace(/'([^']*)'/g, `<span style="color:#1D9E75">'$1'</span>`)
  highlighted = highlighted.replace(/\b(\d+)\b/g, `<span style="color:#BA7517">$1</span>`)
  return (
    <div style={{ background: "#0f1117", borderRadius: 10, overflow: "hidden", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "0.5px solid #ffffff18" }}>
        <span style={{ fontSize: 11, color: "#666", letterSpacing: "0.06em", textTransform: "uppercase" }}>Generated SQL</span>
        <button onClick={copy} style={{ background: "none", border: "none", color: copied ? "#1D9E75" : "#888", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", fontSize: 13, lineHeight: 1.7, color: "#e2e8f0", overflowX: "auto", fontFamily: "monospace" }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  )
}

function ResultTable({ columns, rows }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "0.5px solid #e5e7eb", marginTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {columns.map(col => (
              <th key={col} style={{ textAlign: "left", padding: "10px 14px", borderBottom: "0.5px solid #e5e7eb", fontWeight: 500, color: "#374151", whiteSpace: "nowrap", fontSize: 12, letterSpacing: "0.03em" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 14px", borderBottom: "0.5px solid #f3f4f6", color: cell === null ? "#9ca3af" : "#111827" }}>
                  {cell ?? <em style={{ color: "#9ca3af" }}>NULL</em>}
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
  const inputRef = useRef(null)

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
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        .suggestion:hover { background: #f0f7ff !important; }
      `}</style>

      <div style={{ position: "relative", background: "linear-gradient(135deg, #0f1729 0%, #0c2340 50%, #0f1729 100%)", padding: "60px 24px 80px", overflow: "hidden", textAlign: "center", minHeight: 420 }}>
        <ParticleCanvas />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(24,95,165,0.2)", border: "0.5px solid rgba(55,138,221,0.4)", borderRadius: 20, padding: "6px 16px", fontSize: 12, color: "#85B7EB", marginBottom: 20, letterSpacing: "0.04em" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            AI-powered — guardrails active
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 600, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Ask your database
          </h1>
          <p style={{ fontSize: 16, color: "#85B7EB", margin: "0 0 36px", maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            Natural language to SQL — with hallucination detection and safety guardrails
          </p>

          <div style={{ maxWidth: 620, margin: "0 auto", position: "relative" }}>
            <div style={{ display: "flex", gap: 10, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: 6 }}>
              <input
                ref={inputRef}
                value={question}
                onChange={e => { setQuestion(e.target.value); setShowSuggestions(e.target.value.length === 0) }}
                onFocus={() => question.length === 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your data..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15, padding: "8px 12px" }}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                style={{ background: loading ? "#1a3a5c" : "#185FA5", border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff", fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.2s" }}
              >
                {loading
                  ? <span style={{ width: 14, height: 14, border: "2px solid #ffffff44", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  : null}
                {loading ? "Running" : "Run query"}
              </button>
            </div>

            {showSuggestions && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", overflow: "hidden", zIndex: 10 }}>
                <div style={{ padding: "8px 14px", fontSize: 11, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "0.5px solid #f3f4f6" }}>Try asking</div>
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} className="suggestion" onMouseDown={() => handleSubmit(s)}
                    style={{ padding: "10px 14px", fontSize: 14, color: "#374151", cursor: "pointer", borderBottom: i < SUGGESTIONS.length - 1 ? "0.5px solid #f9fafb" : "none" }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>

        {result && (
          <div className="fade-up">

            {result.error && !result.sql && (
              <div style={{ background: "#fcebeb", border: "0.5px solid #f09595", borderRadius: 10, padding: "14px 18px", color: "#791f1f", fontSize: 14 }}>
                {result.error}
              </div>
            )}

            {result.sql && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ConfidenceBadge level={result.confidence} />
                    {result.rows_returned != null && (
                      <span style={{ fontSize: 13, color: "#6b7280" }}>{result.rows_returned} row{result.rows_returned !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {result.alignment_score != null && (
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                      Alignment {Math.round(result.alignment_score * 100)}%
                    </span>
                  )}
                </div>

                {result.error && (
                  <div style={{ background: "#fcebeb", border: "0.5px solid #f09595", borderRadius: 10, padding: "12px 16px", color: "#791f1f", fontSize: 13, marginBottom: 12 }}>
                    Blocked: {result.error}
                  </div>
                )}

                {result.warning && (
                  <div style={{ background: "#faeeda", border: "0.5px solid #FAC775", borderRadius: 10, padding: "12px 16px", color: "#633806", fontSize: 13, marginBottom: 12 }}>
                    {result.warning}
                  </div>
                )}

                {result.sanity_issues?.map((issue, i) => (
                  <div key={i} style={{ background: "#faeeda", border: "0.5px solid #FAC775", borderRadius: 10, padding: "12px 16px", color: "#633806", fontSize: 13, marginBottom: 12 }}>
                    {issue}
                  </div>
                ))}

                <SqlBlock sql={result.sql} />

                {result.back_translation && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: "#9ca3af", flexShrink: 0 }}>Interpreted as:</span>
                    <TypewriterText text={result.back_translation} />
                  </div>
                )}

                {result.rows?.length > 0 && (
                  <ResultTable columns={result.columns} rows={result.rows} />
                )}

                {result.confidence_breakdown && (
                  <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "Schema", value: result.confidence_breakdown.schema_validation },
                      { label: "Alignment", value: result.confidence_breakdown.back_translation_alignment },
                      { label: "Sanity", value: result.confidence_breakdown.result_sanity },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: value === "pass" || value === "high" ? "#1D9E75" : value === "medium" ? "#BA7517" : "#E24B4A", display: "inline-block" }} />
                        <span style={{ color: "#6b7280" }}>{label}</span>
                        <span style={{ color: "#374151", fontWeight: 500 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {history.length > 1 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent queries</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.slice(1).map((h, i) => (
                <div key={i} onClick={() => handleSubmit(h.question)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, border: "0.5px solid #e5e7eb", background: "#fff", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#185FA5"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}
                >
                  <span style={{ fontSize: 13, color: "#374151" }}>{h.question}</span>
                  <ConfidenceBadge level={h.confidence} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}