# QueryAI — Text-to-SQL with Guardrails

> Plain English questions. Safe SQL execution. Hallucination detection built in.

**71% execution accuracy · 100% dangerous query block rate · 82% high-confidence responses · 40 test cases**

---

## What is this?

QueryAI is a natural language interface that translates plain English questions into validated PostgreSQL queries. It combines a schema-aware prompt engine, a safety middleware layer, and a hallucination detection system — so bad, dangerous, or hallucinated queries never reach the database.

Built to demonstrate production-grade AI engineering: not just "call an LLM and return the result," but a system a compliance team would actually approve.

---

## Live demo

Ask: *"What is the total revenue per category?"*

Generated SQL:
```sql
SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
GROUP BY p.category
ORDER BY revenue DESC
LIMIT 1000;
```

Back-translation: *"This query retrieves the total revenue for each product category, ordered from highest to lowest."*

Confidence: **high** · Alignment: **75%** · 4 rows returned

---

## Architecture
User question
│
▼
┌─────────────────────┐
│  Prompt constructor  │  Schema-aware, few-shot, filtered to relevant tables
└─────────────────────┘
│
▼
┌─────────────────────┐
│     LLM (Groq)      │  Llama 3.3 70B, temperature=0
└─────────────────────┘
│
▼
┌─────────────────────┐
│  Danger blocker     │  Blocks DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE
└─────────────────────┘
│
▼
┌─────────────────────┐
│  Schema validator   │  Checks all identifiers exist in the real schema
└─────────────────────┘
│
▼
┌─────────────────────┐
│  SQL executor       │  Read-only DB user, LIMIT enforced, sqlparse validated
└─────────────────────┘
│
▼
┌─────────────────────┐
│  Hallucination      │  Back-translation alignment + result sanity checks
│  detection          │
└─────────────────────┘
│
▼
┌─────────────────────┐
│  Confidence scorer  │  Aggregates all signals → high / medium / low
└─────────────────────┘
│
▼
Result + confidence breakdown returned to user

---

## How each layer works

### 1. Schema-aware prompt engine
SQLAlchemy introspects the live database on every query — extracting tables, columns, types, primary/foreign keys, and sample values for categorical columns. A keyword-based filter selects only relevant tables, keeping the prompt focused. Three few-shot examples of question-to-SQL pairs anchor the LLM's output format.

### 2. Safety guardrails
Every generated query passes through middleware before touching the database:
- Blocks all DDL: `DROP`, `ALTER`, `CREATE`, `TRUNCATE`
- Blocks all DML writes: `INSERT`, `UPDATE`, `DELETE`
- Enforces `LIMIT 1000` on unbounded queries
- Validates SQL syntax with `sqlparse`
- Executes under a `SELECT`-only database user as a second permission layer

Zero unsafe queries have executed across all test cases.

### 3. Hallucination detection
After SQL generation, the system back-translates the query by asking the LLM: *"What question does this SQL answer?"* It then scores keyword overlap between the back-translation and the original question. A score below 0.4 flags a possible hallucination before results reach the user.

### 4. Result sanity checks
After execution:
- Flags columns that are 80%+ NULL (sign of a bad JOIN)
- Flags aggregations that return 0 (sign of a mismatched filter)
- Flags 50%+ duplicate rows (sign of a cartesian product)

### 5. Confidence scoring
Three signals combine into a final confidence level (high / medium / low):
- Schema validation result
- Back-translation alignment score
- Result sanity check pass/fail

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| LLM | Llama 3.3 70B via Groq | Free tier, fast, strong SQL generation |
| Database | PostgreSQL | Real SQL engine |
| Schema extraction | SQLAlchemy | Automatic introspection |
| SQL validation | sqlparse | Syntax checking before execution |
| Guardrails | Custom middleware | Configurable safety rules |
| API | FastAPI | Production-grade serving |
| Frontend | React + Vite | Clean, interactive UI |
| Eval suite | Custom Python runner | 40 test cases, 5 categories |

---

## Eval results

Evaluated across 40 test cases covering 5 categories.

| Metric | Result |
|---|---|
| Execution success rate | 100% (34/34 safe queries) |
| Full accuracy rate | 71% (24/34) |
| Guardrail block rate | 100% (6/6 dangerous queries) |
| High confidence rate | 82% |
| Avg alignment score | 0.70 |
| Avg response time | ~2.1s |

By category:

| Category | Accuracy | Notes |
|---|---|---|
| Simple lookups | 88% | Strong on direct filters |
| Aggregations | 86% | Good GROUP BY and COUNT handling |
| Multi-table JOINs | 57% | Complex joins sometimes miss expected columns |
| Date filters | 67% | Interval syntax mostly correct |
| Edge cases | 67% | Subqueries and percentage calculations vary |

---

## Project structure
text2sql/
├── api/
│   ├── init.py
│   └── main.py              # FastAPI: /query, /schema, /history
├── core/
│   ├── init.py
│   ├── extractor.py         # SQLAlchemy schema introspection
│   ├── prompt.py            # Dynamic prompt constructor (Groq)
│   ├── guardrails.py        # Safety layer, validator, executor
│   └── hallucination.py     # Back-translation + confidence scoring
├── db/
│   ├── init.py
│   ├── schema.py            # SQLAlchemy models
│   └── seed.py              # Sample e-commerce data seeder
├── evals/
│   ├── init.py
│   ├── golden_dataset.py    # 40 labeled test cases
│   └── runner.py            # Eval runner + summary report
├── text2sql-ui/             # React + Vite frontend
│   └── src/
│       └── App.jsx
├── .env.example
├── requirements.txt
└── README.md

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Groq API key (free at https://console.groq.com)

### 1. Clone the repo

```bash
git clone https://github.com/asharibtariq/text2sql.git
cd text-to-sql
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/text2sql
DATABASE_READONLY_URL=postgresql+psycopg://text2sql_readonly:readonly123@localhost:5432/text2sql
GROQ_API_KEY=gsk_...

### 4. Set up PostgreSQL

```sql
-- In psql as superuser
CREATE DATABASE text2sql;

CREATE USER text2sql_readonly WITH PASSWORD 'readonly123';
GRANT CONNECT ON DATABASE text2sql TO text2sql_readonly;

\c text2sql

GRANT USAGE ON SCHEMA public TO text2sql_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO text2sql_readonly;
```

### 5. Seed the database

```bash
py -3.11 -m db.seed
```

### 6. Run the backend

```bash
py -3.11 -m uvicorn api.main:app --reload
```

API runs at http://localhost:8000
Swagger docs at http://localhost:8000/docs

### 7. Run the frontend

```bash
cd text2sql-ui
npm install
npm run dev
```

Frontend runs at http://localhost:5173

### 8. Run the eval suite

```bash
py -3.11 -m evals.runner
```

---

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/query` | Submit a natural language question |
| GET | `/schema` | Return the current database schema |
| GET | `/history` | Return past queries for the session |
| GET | `/` | Health check |

### POST /query

Request:
```json
{
  "question": "Show me all customers from Canada"
}
```

Response:
```json
{
  "question": "Show me all customers from Canada",
  "sql": "SELECT c.id, c.name, c.email, c.country FROM customers c WHERE c.country = 'Canada' LIMIT 1000;",
  "is_valid": true,
  "columns": ["id", "name", "email", "country", "created_at"],
  "rows": [[1, "Alice Khan", "alice@example.com", "Canada", "2026-04-27"]],
  "rows_returned": 3,
  "back_translation": "This query retrieves customers from Canada.",
  "alignment_score": 1.0,
  "confidence": "high",
  "confidence_breakdown": {
    "schema_validation": "high",
    "back_translation_alignment": "pass",
    "result_sanity": "pass"
  },
  "sanity_issues": []
}
```