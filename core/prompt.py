from openai import OpenAI
from core.extractor import extract_schema, schema_to_text, TableInfo
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

FEW_SHOT_EXAMPLES = [
    {
        "question": "How many orders were placed in the last 30 days?",
        "sql": "SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '30 days';"
    },
    {
        "question": "What is the total revenue by product category?",
        "sql": """SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
GROUP BY p.category
ORDER BY revenue DESC;"""
    },
    {
        "question": "List the top 3 customers by total spending.",
        "sql": """SELECT c.name, SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status != 'cancelled'
GROUP BY c.id, c.name
ORDER BY total_spent DESC
LIMIT 3;"""
    },
]


def filter_relevant_tables(question: str, all_tables: list[TableInfo]) -> list[TableInfo]:
    question_lower = question.lower()
    keywords = {
        "customers": ["customer", "user", "buyer", "country"],
        "orders": ["order", "purchase", "buy", "revenue", "total", "status", "cancel"],
        "products": ["product", "item", "category", "price", "stock"],
        "order_items": ["item", "quantity", "product", "order"],
    }
    relevant = set()
    for table in all_tables:
        for kw in keywords.get(table.name, []):
            if kw in question_lower:
                relevant.add(table.name)

    if "orders" in relevant or "products" in relevant:
        relevant.add("order_items")

    if not relevant:
        return all_tables

    return [t for t in all_tables if t.name in relevant]


def build_system_prompt(question: str) -> str:
    all_tables = extract_schema()
    relevant_tables = filter_relevant_tables(question, all_tables)
    schema_text = schema_to_text(relevant_tables)

    examples_text = "\n\n".join(
        f"Question: {ex['question']}\nSQL: {ex['sql']}"
        for ex in FEW_SHOT_EXAMPLES
    )

    return f"""You are an expert SQL assistant. Convert natural language questions into PostgreSQL queries.

DATABASE SCHEMA:
{schema_text}

RULES:
- Only use tables and columns that exist in the schema above.
- Always use explicit JOINs, never implicit comma joins.
- Use table aliases for clarity.
- Add LIMIT 1000 if the query could return many rows and no LIMIT is specified.
- If the question is ambiguous, write the most reasonable interpretation.
- Return ONLY the SQL query. No explanation, no markdown, no backticks.

EXAMPLES:
{examples_text}"""


def generate_sql(question: str) -> str:
    system_prompt = build_system_prompt(question)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {question}"}
        ],
        temperature=0,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()