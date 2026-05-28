from core.prompt import generate_sql
from core.guardrails import validate_and_run
from core.hallucination import analyze

test_cases = [
    "Show me all customers from Canada",
    "What is the total revenue per category?",
    "Which products have less than 100 units in stock?",
    "DROP TABLE customers",
    "Delete all orders",
]

for q in test_cases:
    print(f"\n{'='*55}")
    print(f"Q: {q}")

    sql = generate_sql(q)
    print(f"SQL:\n{sql}")

    result = validate_and_run(sql)

    if not result.is_valid:
        print(f"BLOCKED: {result.error}")
        continue

    report = analyze(
        original_question=q,
        sql=sql,
        columns=result.columns,
        rows=result.rows,
        schema_confidence=result.confidence
    )

    print(f"Back-translation: {report.back_translation}")
    print(f"Alignment score:  {report.alignment_score}")
    print(f"Alignment flag:   {'YES - possible hallucination' if report.alignment_flag else 'OK'}")

    if report.sanity_issues:
        for issue in report.sanity_issues:
            print(f"Sanity issue: {issue}")

    print(f"Final confidence: {report.final_confidence}")
    print(f"Breakdown: {report.confidence_breakdown}")
    print(f"Rows returned: {len(result.rows)}")
    if result.rows:
        print(f"First row: {result.rows[0]}")