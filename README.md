# QueryAI - Text-to-SQL with Guardrails

> Plain English questions. Safe SQL execution. Hallucination detection built in.

**76% execution accuracy · 100% dangerous query block rate · 82% high-confidence responses · 55 test cases**

> Clone and run in one command with Docker.

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
| Execution success rate | 100% (49/49 safe queries) |
| Full accuracy rate | 86% (42/49) |
| Guardrail block rate | 100% (6/6 dangerous queries) |
| High confidence rate | 82% |
| Avg alignment score | 0.69 |
| Avg response time | ~2.5s |

By category:

| Category | Accuracy | Notes |
|---|---|---|
| Simple lookups | 88% | Strong on direct filters |
| Aggregations | 86% | Good GROUP BY and COUNT handling |
| Multi-table JOINs | 75% | Complex joins sometimes miss expected columns |
| Date filters | 71% | Interval syntax mostly correct |
| Edge cases | 67% | Subqueries and percentage calculations vary |

---

### Quick start

### Clone the repo

```bash
git clone https://github.com/asharibtariq/text2sql.git
cd text2sql
```
### Configure .env

```bash
cp .env.example .env
```
Replace with your values

### Start everything with docker

```bash
docker-compose up --build
```

This starts PostgreSQL, seeds the database, starts the FastAPI backend, and starts the React frontend — all in order.

Open http://localhost:5173


### To Stop the app

```bash
docker-compose down
```

To also wipe the database volume:

```bash
docker-compose down -v
```

---

## Setup Manually

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Groq API key (free at https://console.groq.com)

### 1. Clone the repo

```bash
git clone https://github.com/asharibtariq/text2sql.git
cd text2sql
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

### 4. Seed the database

```bash
py -3.11 -m db.seed
```

### 5. Run the backend

```bash
py -3.11 -m uvicorn api.main:app --reload
```

API runs at http://localhost:8000
Swagger docs at http://localhost:8000/docs

### 6. Run the frontend

```bash
cd text2sql-ui
npm install
npm run dev
```

Frontend runs at http://localhost:5173

### 7. Run the eval suite

```bash
py -3.11 -m evals.runner
```