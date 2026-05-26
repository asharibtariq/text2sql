from sqlalchemy import create_engine, inspect, text
from dataclasses import dataclass, field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass
class ColumnInfo:
    name: str
    type: str
    nullable: bool
    is_primary_key: bool
    is_foreign_key: bool
    references: Optional[str] = None
    sample_values: list = field(default_factory=list)

@dataclass
class TableInfo:
    name: str
    columns: list[ColumnInfo]
    row_count: int = 0


def extract_schema(table_names: list[str] = None) -> list[TableInfo]:
    engine = create_engine(os.getenv("DATABASE_URL"))
    inspector = inspect(engine)

    all_tables = inspector.get_table_names()
    target_tables = table_names if table_names else all_tables

    schema = []
    with engine.connect() as conn:
        for table_name in target_tables:
            if table_name not in all_tables:
                continue

            fk_map = {}
            for fk in inspector.get_foreign_keys(table_name):
                for col in fk["constrained_columns"]:
                    ref = f"{fk['referred_table']}.{fk['referred_columns'][0]}"
                    fk_map[col] = ref

            pk_cols = set(inspector.get_pk_constraint(table_name).get("constrained_columns", []))
            columns = []

            for col in inspector.get_columns(table_name):
                col_name = col["name"]

                samples = []
                col_type = str(col["type"]).upper()
                if any(t in col_type for t in ["VARCHAR", "CHAR", "TEXT", "ENUM"]):
                    result = conn.execute(
                        text(f"SELECT DISTINCT {col_name} FROM {table_name} "
                             f"WHERE {col_name} IS NOT NULL LIMIT 5")
                    )
                    samples = [str(row[0]) for row in result]

                columns.append(ColumnInfo(
                    name=col_name,
                    type=col_type,
                    nullable=col.get("nullable", True),
                    is_primary_key=col_name in pk_cols,
                    is_foreign_key=col_name in fk_map,
                    references=fk_map.get(col_name),
                    sample_values=samples
                ))

            row_count = conn.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")
            ).scalar()

            schema.append(TableInfo(
                name=table_name,
                columns=columns,
                row_count=row_count
            ))

    return schema


def schema_to_text(tables: list[TableInfo]) -> str:
    lines = []
    for table in tables:
        lines.append(f"Table: {table.name} ({table.row_count} rows)")
        for col in table.columns:
            flags = []
            if col.is_primary_key: flags.append("PK")
            if col.is_foreign_key: flags.append(f"FK → {col.references}")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            sample_str = f" -- e.g. {', '.join(col.sample_values[:3])}" if col.sample_values else ""
            lines.append(f"  {col.name}: {col.type}{flag_str}{sample_str}")
        lines.append("")
    return "\n".join(lines)