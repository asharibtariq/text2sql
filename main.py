from core.prompt import generate_sql
from core.guardrails import validate_and_run

test_cases = [
    "Show me all customers from Pakistan",
    "What is the total revenue per category?",
    "Which products have less than 100 units in stock?",
    "DROP TABLE customers",
    "Delete all orders",
]

for q in test_cases:
    print(f"\nQ: {q}")
    sql = generate_sql(q)
    print(f"SQL: {sql}")
    result = validate_and_run(sql)
    if not result.is_valid:
        print(f"BLOCKED: {result.error}")
    else:
        print(f"Confidence: {result.confidence}")
        if result.warning:
            print(f"Warning: {result.warning}")
        print(f"Rows returned: {len(result.rows)}")
        if result.rows:
            print(f"Columns: {result.columns}")
            print(f"First row: {result.rows[0]}")