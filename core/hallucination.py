import re
from openai import OpenAI
from dataclasses import dataclass, field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


@dataclass
class HallucinationReport:
    back_translation: str
    alignment_score: float        # 0.0 to 1.0
    alignment_flag: bool          # True = possible hallucination
    sanity_issues: list[str] = field(default_factory=list)
    final_confidence: str = "high"   # high / medium / low
    confidence_breakdown: dict = field(default_factory=dict)


def back_translate(sql: str) -> str:
    """Ask the LLM what question this SQL answers."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a SQL expert. Given a SQL query, describe in one plain English "
                    "sentence what question it answers. Be concise and specific. "
                    "Do not explain the SQL syntax — just state what data it retrieves."
                )
            },
            {
                "role": "user",
                "content": f"SQL:\n{sql}"
            }
        ],
        temperature=0,
        max_tokens=100,
    )
    return response.choices[0].message.content.strip()


def score_alignment(original_question: str, back_translated: str) -> float:
    """
    Score how well the back-translation matches the original question.
    Uses keyword overlap as a lightweight similarity metric.
    No embeddings needed — good enough for portfolio + interview demos.
    """
    stop_words = {
        "the", "a", "an", "is", "are", "of", "in", "to", "for",
        "and", "or", "all", "me", "show", "give", "what", "how",
        "many", "much", "which", "where", "who", "with", "from",
        "that", "this", "have", "has", "been", "be", "by", "on"
    }

    def keywords(text: str) -> set:
        words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
        return {w for w in words if w not in stop_words and len(w) > 2}

    orig_kw = keywords(original_question)
    trans_kw = keywords(back_translated)

    if not orig_kw:
        return 1.0

    overlap = orig_kw & trans_kw
    score = len(overlap) / len(orig_kw)
    return round(score, 2)


def sanity_check(columns: list, rows: list) -> list[str]:
    """Check results for common signs of a bad query."""
    issues = []

    if not rows:
        issues.append("Query returned no rows — possible over-filtering or bad JOIN.")
        return issues

    if not columns:
        return issues

    # Check for NULL-heavy columns
    for i, col in enumerate(columns):
        null_count = sum(1 for row in rows if row[i] is None)
        null_rate = null_count / len(rows)
        if null_rate > 0.8:
            issues.append(
                f"Column '{col}' is {int(null_rate * 100)}% NULL — "
                f"possible bad JOIN or missing data."
            )

    # Check for suspiciously single-row aggregation results
    if len(rows) == 1 and len(columns) == 1:
        val = rows[0][0]
        if isinstance(val, (int, float)) and val == 0:
            issues.append(
                "Aggregation returned 0 — possible mismatched filter or empty group."
            )

    # Check for duplicate rows (sign of a bad JOIN producing a cartesian product)
    if len(rows) > 1:
        str_rows = [str(r) for r in rows]
        if len(set(str_rows)) < len(str_rows) * 0.5:
            issues.append(
                "More than 50% duplicate rows detected — possible cartesian JOIN."
            )

    return issues


def aggregate_confidence(
    schema_confidence: str,
    alignment_score: float,
    sanity_issues: list[str]
) -> tuple[str, dict]:
    """
    Combine all signals into a final confidence level and breakdown dict.
    """
    breakdown = {
        "schema_validation": schema_confidence,
        "back_translation_alignment": (
            "pass" if alignment_score >= 0.4 else "fail"
        ),
        "alignment_score": alignment_score,
        "result_sanity": "pass" if not sanity_issues else "fail",
        "sanity_issues_count": len(sanity_issues),
    }

    # Scoring logic
    score = 3  # start at high

    if schema_confidence == "low":
        score -= 2
    elif schema_confidence == "medium":
        score -= 1

    if alignment_score < 0.4:
        score -= 1

    if sanity_issues:
        score -= 1

    if score >= 3:
        final = "high"
    elif score == 2:
        final = "medium"
    else:
        final = "low"

    breakdown["final"] = final
    return final, breakdown


def analyze(
    original_question: str,
    sql: str,
    columns: list,
    rows: list,
    schema_confidence: str
) -> HallucinationReport:
    """Full hallucination analysis pipeline."""

    back_translated = back_translate(sql)
    alignment_score = score_alignment(original_question, back_translated)
    alignment_flag = alignment_score < 0.4

    sanity_issues = sanity_check(columns, rows)

    final_confidence, breakdown = aggregate_confidence(
        schema_confidence, alignment_score, sanity_issues
    )

    return HallucinationReport(
        back_translation=back_translated,
        alignment_score=alignment_score,
        alignment_flag=alignment_flag,
        sanity_issues=sanity_issues,
        final_confidence=final_confidence,
        confidence_breakdown=breakdown,
    )