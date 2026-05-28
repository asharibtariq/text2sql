import sys
import os
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.prompt import generate_sql
from core.guardrails import validate_and_run
from core.hallucination import analyze
from evals.golden_dataset import GOLDEN_QUERIES
from dataclasses import dataclass
from typing import Optional


@dataclass
class EvalResult:
    id: int
    question: str
    category: str
    should_block: bool
    was_blocked: bool
    execution_success: bool
    columns_match: bool
    min_rows_met: bool
    confidence: str
    alignment_score: Optional[float]
    error: Optional[str]
    duration_ms: int


def check_columns(returned: list, expected: list) -> bool:
    if not expected:
        return True
    returned_lower = [c.lower() for c in returned]
    for col in expected:
        col_lower = col.lower()
        found = any(
            col_lower in r or r in col_lower
            for r in returned_lower
        )
        if not found:
            return False
    return True


def run_eval(case: dict) -> EvalResult:
    start = time.time()
    question = case["question"]
    should_block = case["should_block"]

    try:
        sql = generate_sql(question)
        result = validate_and_run(sql)

        duration_ms = int((time.time() - start) * 1000)

        if not result.is_valid:
            return EvalResult(
                id=case["id"],
                question=question,
                category=case["category"],
                should_block=should_block,
                was_blocked=True,
                execution_success=False,
                columns_match=False,
                min_rows_met=False,
                confidence="low",
                alignment_score=None,
                error=result.error,
                duration_ms=duration_ms,
            )

        report = analyze(
            original_question=question,
            sql=sql,
            columns=result.columns or [],
            rows=result.rows or [],
            schema_confidence=result.confidence,
        )

        columns_match = check_columns(
            result.columns or [],
            case["expected_columns"]
        )
        min_rows_met = len(result.rows or []) >= case["expected_min_rows"]

        return EvalResult(
            id=case["id"],
            question=question,
            category=case["category"],
            should_block=should_block,
            was_blocked=False,
            execution_success=True,
            columns_match=columns_match,
            min_rows_met=min_rows_met,
            confidence=report.final_confidence,
            alignment_score=report.alignment_score,
            error=None,
            duration_ms=duration_ms,
        )

    except Exception as e:
        return EvalResult(
            id=case["id"],
            question=question,
            category=case["category"],
            should_block=should_block,
            was_blocked=False,
            execution_success=False,
            columns_match=False,
            min_rows_met=False,
            confidence="low",
            alignment_score=None,
            error=str(e),
            duration_ms=int((time.time() - start) * 1000),
        )


def run_all_evals(verbose: bool = True):
    results = []
    total = len(GOLDEN_QUERIES)

    print(f"\nRunning {total} eval cases...\n")

    for i, case in enumerate(GOLDEN_QUERIES):
        print(f"[{i+1}/{total}] {case['question'][:60]}...", end=" ", flush=True)
        result = run_eval(case)
        results.append(result)

        if result.should_block and result.was_blocked:
            print("BLOCKED (correct)")
        elif result.should_block and not result.was_blocked:
            print("SHOULD HAVE BEEN BLOCKED (fail)")
        elif result.execution_success:
            status = "pass" if result.columns_match and result.min_rows_met else "partial"
            print(f"{status} — confidence: {result.confidence}, alignment: {result.alignment_score}")
        else:
            print(f"ERROR: {result.error}")

    print_summary(results)
    return results


def print_summary(results: list[EvalResult]):
    total = len(results)
    dangerous = [r for r in results if r.should_block]
    safe = [r for r in results if not r.should_block]

    guardrail_correct = sum(1 for r in dangerous if r.was_blocked)
    guardrail_rate = guardrail_correct / len(dangerous) * 100 if dangerous else 0

    execution_pass = sum(1 for r in safe if r.execution_success)
    execution_rate = execution_pass / len(safe) * 100 if safe else 0

    full_pass = sum(1 for r in safe if r.execution_success and r.columns_match and r.min_rows_met)
    accuracy_rate = full_pass / len(safe) * 100 if safe else 0

    high_confidence = sum(1 for r in safe if r.execution_success and r.confidence == "high")
    high_conf_rate = high_confidence / execution_pass * 100 if execution_pass else 0

    avg_alignment = sum(r.alignment_score for r in safe if r.alignment_score is not None)
    alignment_count = sum(1 for r in safe if r.alignment_score is not None)
    avg_alignment_score = avg_alignment / alignment_count if alignment_count else 0

    avg_duration = sum(r.duration_ms for r in results) / total

    categories = {}
    for r in safe:
        cat = r.category
        if cat not in categories:
            categories[cat] = {"total": 0, "pass": 0}
        categories[cat]["total"] += 1
        if r.execution_success and r.columns_match and r.min_rows_met:
            categories[cat]["pass"] += 1

    print("\n" + "="*55)
    print("EVAL SUMMARY")
    print("="*55)
    print(f"Total cases:              {total}")
    print(f"Dangerous queries:        {len(dangerous)}")
    print(f"Safe queries:             {len(safe)}")
    print(f"")
    print(f"Guardrail block rate:     {guardrail_rate:.1f}%  ({guardrail_correct}/{len(dangerous)})")
    print(f"Execution success rate:   {execution_rate:.1f}%  ({execution_pass}/{len(safe)})")
    print(f"Full accuracy rate:       {accuracy_rate:.1f}%  ({full_pass}/{len(safe)})")
    print(f"High confidence rate:     {high_conf_rate:.1f}%")
    print(f"Avg alignment score:      {avg_alignment_score:.2f}")
    print(f"Avg response time:        {avg_duration:.0f}ms")
    print(f"")
    print("By category:")
    for cat, stats in categories.items():
        rate = stats["pass"] / stats["total"] * 100 if stats["total"] else 0
        print(f"  {cat:<20} {rate:.0f}%  ({stats['pass']}/{stats['total']})")
    print("="*55)
    print(f"\nREADME headline:")
    print(f'"{accuracy_rate:.0f}% execution accuracy, {guardrail_rate:.0f}% dangerous query block rate,')
    print(f'{high_conf_rate:.0f}% high-confidence responses across {total} test cases"')
    print("="*55)


if __name__ == "__main__":
    run_all_evals()