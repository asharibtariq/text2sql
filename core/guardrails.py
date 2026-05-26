import re
from sqlalchemy import create_engine, text
from core.extractor import extract_schema
from dataclasses import dataclass
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

DANGEROUS_KEYWORDS = [
    "DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE",
    "INSERT", "CREATE", "REPLACE", "EXEC", "EXECUTE",
    "GRANT", "REVOKE", "COMMIT", "ROLLBACK"
]

@dataclass
class ValidationResult:
    is_valid: bool
    sql: str
    error: Optional[str] = None
    warning: Optional[str] = None
    confidence: str = "high"
    rows: Optional[list] = None
    columns: Optional[list] = None


def check_dangerous(sql: str) -> Optional[str]:
    sql_upper = sql.upper()
    for keyword in DANGEROUS_KEYWORDS:
        pattern = rf'\b{keyword}\b'
        if re.search(pattern, sql_upper):
            return f"Blocked: query contains '{keyword}' which is not allowed."
    return None


def check_schema(sql: str) -> Optional[str]:
    tables = extract_schema()
    valid_tables = {t.name.lower() for t in tables}
    valid_columns = {
        col.name.lower()
        for t in tables
        for col in t.columns
    }

    # Extract table aliases: "customers c" or "customers AS c"
    aliases = set(re.findall(
        r'\b(?:from|join)\s+\w+\s+(?:as\s+)?([a-zA-Z_]\w*)',
        sql, re.IGNORECASE
    ))

    # Extract column aliases: "SUM(...) AS revenue"
    col_aliases = set(re.findall(
        r'\bAS\s+([a-zA-Z_]\w*)',
        sql, re.IGNORECASE
    ))

    aliases = aliases | col_aliases

    # Strip quoted strings before checking identifiers
    sql_stripped = re.sub(r"'[^']*'", "", sql)

    words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', sql_stripped)

    sql_keywords = {
        "select", "from", "where", "join", "on", "group", "by",
        "order", "limit", "offset", "having", "as", "and", "or",
        "not", "in", "is", "null", "like", "between", "case",
        "when", "then", "else", "end", "count", "sum", "avg",
        "min", "max", "distinct", "inner", "left", "right",
        "outer", "full", "cross", "union", "all", "exists",
        "interval", "now", "true", "false", "asc", "desc"
    }

    unknown = []
    for word in words:
        w = word.lower()
        if w in sql_keywords:
            continue
        if w in valid_tables:
            continue
        if w in valid_columns:
            continue
        if w in aliases:
            continue
        if w.isdigit():
            continue
        unknown.append(word)

    if unknown:
        return f"Warning: unrecognized identifiers: {', '.join(set(unknown))}. Possible hallucination."
    return None


def score_confidence(sql: str, schema_warning: Optional[str]) -> str:
    if schema_warning:
        return "low"
    subquery_count = sql.upper().count("SELECT")
    if subquery_count > 2:
        return "medium"
    joins = len(re.findall(r'\bJOIN\b', sql.upper()))
    if joins > 3:
        return "medium"
    return "high"


def execute_sql(sql: str) -> tuple:
    engine = create_engine(os.getenv("DATABASE_URL"))
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [list(row) for row in result.fetchmany(100)]
    return columns, rows


def validate_and_run(sql: str) -> ValidationResult:
    sql = sql.strip().rstrip(";") + ";"

    danger = check_dangerous(sql)
    if danger:
        return ValidationResult(is_valid=False, sql=sql, error=danger)

    schema_warning = check_schema(sql)
    confidence = score_confidence(sql, schema_warning)

    try:
        columns, rows = execute_sql(sql)
        return ValidationResult(
            is_valid=True,
            sql=sql,
            warning=schema_warning,
            confidence=confidence,
            rows=rows,
            columns=columns
        )
    except Exception as e:
        return ValidationResult(
            is_valid=False,
            sql=sql,
            error=f"Execution error: {str(e)}",
            confidence="low"
        )