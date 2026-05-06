# from core.extractor import extract_schema, schema_to_text

# tables = extract_schema()
# print(schema_to_text(tables))

from core.prompt import generate_sql

questions = [
    "Show me all customers from Pakistan",
    "What is the total revenue per category?",
    "Which products have less than 100 units in stock?",
]

for q in questions:
    print(f"Q: {q}")
    print(f"SQL: {generate_sql(q)}")
    print()