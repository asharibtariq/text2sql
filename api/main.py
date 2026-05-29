from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.prompt import generate_sql
from core.guardrails import validate_and_run
from core.hallucination import analyze

app = FastAPI(title="Text-to-SQL API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

query_history = []


class QueryRequest(BaseModel):
    question: str


class ColumnResult(BaseModel):
    columns: list[str]
    rows: list[list]


class QueryResponse(BaseModel):
    question: str
    sql: str
    is_valid: bool
    error: Optional[str] = None
    warning: Optional[str] = None
    columns: Optional[list[str]] = None
    rows: Optional[list[list]] = None
    rows_returned: Optional[int] = None
    back_translation: Optional[str] = None
    alignment_score: Optional[float] = None
    confidence: str
    confidence_breakdown: Optional[dict] = None
    sanity_issues: Optional[list[str]] = None


@app.get("/")
def root():
    return {"status": "ok", "message": "Text-to-SQL API is running"}


@app.post("/query", response_model=QueryResponse)
def run_query(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    sql = generate_sql(request.question)
    result = validate_and_run(sql)

    if not result.is_valid:
        response = QueryResponse(
            question=request.question,
            sql=result.sql,
            is_valid=False,
            error=result.error,
            confidence="low",
        )
        query_history.append(response.dict())
        return response

    report = analyze(
        original_question=request.question,
        sql=sql,
        columns=result.columns,
        rows=result.rows,
        schema_confidence=result.confidence,
    )

    rows_serializable = []
    for row in (result.rows or []):
        rows_serializable.append([
            str(v) if not isinstance(v, (int, float, str, bool, type(None))) else v
            for v in row
        ])

    response = QueryResponse(
        question=request.question,
        sql=result.sql,
        is_valid=True,
        warning=result.warning,
        columns=result.columns,
        rows=rows_serializable,
        rows_returned=len(result.rows or []),
        back_translation=report.back_translation,
        alignment_score=report.alignment_score,
        confidence=report.final_confidence,
        confidence_breakdown=report.confidence_breakdown,
        sanity_issues=report.sanity_issues,
    )
    query_history.append(response.dict())
    return response


@app.get("/schema")
def get_schema():
    from core.extractor import extract_schema, schema_to_text
    tables = extract_schema()
    return {"schema": schema_to_text(tables)}


@app.get("/history")
def get_history():
    return {"history": query_history}