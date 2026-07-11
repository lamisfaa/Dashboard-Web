import json
import os
import re
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables before importing local modules that read them.
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(CURRENT_DIR, ".env"))
load_dotenv()

from auth import (
    PublicUser,
    get_current_user,
    get_email_delivery_status,
    is_email_delivery_configured,
    router as auth_router,
)
from dashboard_store import get_excel_workbook_path, load_dashboard_data, replace_table
from database import get_connection, get_database_status, init_db

# =========================================================================
# PASTE YOUR GEMINI API KEY DIRECTLY HERE
# If left blank, it will fall back to reading GEMINI_API_KEY from backend/.env
# =========================================================================
GEMINI_API_KEY_OVERRIDE = ""

app = FastAPI(title="Dashboard Chatbot Backend", version="1.0")
app.include_router(auth_router)


@app.on_event("startup")
def startup_event():
    init_db()


def get_cors_origins() -> list[str]:
    default_origins = [
        "https://projex-dashboard-web.vercel.app",
    ]
    raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    origins = [
        origin.strip().rstrip("/")
        for origin in raw_origins.split(",")
        if origin.strip()
    ]

    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)

    for origin in default_origins:
        if origin not in origins:
            origins.append(origin)

    return origins or ["*"]


# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dashboard_data = load_dashboard_data()

# Minimize the data by converting it to a highly optimized, normalized CSV structure to reduce token count
def to_csv_string(table_data):
    if not table_data:
        return ""
    if isinstance(table_data[0], list):
        return "\n".join(",".join(map(str, row)) for row in table_data)
    
    keys = list(table_data[0].keys())
    lines = [",".join(keys)]
    for item in table_data:
        row = []
        for k in keys:
            val = item.get(k)
            if val is None:
                val = ""
            elif isinstance(val, (int, float)):
                if isinstance(val, float):
                    val = f"{val:.4f}".rstrip('0').rstrip('.')
                else:
                    val = str(val)
            else:
                val_str = str(val).replace('"', '""')
                if ',' in val_str or '"' in val_str or '\n' in val_str:
                    val = f'"{val_str}"'
                else:
                    val = val_str
            row.append(val)
        lines.append(",".join(row))
    return "\n".join(lines)

def get_optimized_dataset_csv(data):
    opt_data = {}
    
    # 1. Dashboard: keep as is
    opt_data['Dashboard'] = data.get('Dashboard', [])
    
    # 2. Departments: keep as is
    opt_data['Departments'] = data.get('Departments', [])
    
    # 3. Employees: drop Department name and Email (keep ID, Job Title, Level, Manager, Location, Hire Date, Status)
    opt_employees = []
    for emp in data.get('Employees', []):
        emp_copy = emp.copy()
        emp_copy.pop('Department', None)
        emp_copy.pop('Email', None)
        opt_employees.append(emp_copy)
    opt_data['Employees'] = opt_employees
    
    # 4. Projects: drop Department name
    opt_projects = []
    for proj in data.get('Projects', []):
        proj_copy = proj.copy()
        proj_copy.pop('Department', None)
        opt_projects.append(proj_copy)
    opt_data['Projects'] = opt_projects
    
    # 5. Tasks: drop Project name, Assigned To name, Department name
    opt_tasks = []
    for task in data.get('Tasks', []):
        task_copy = task.copy()
        task_copy.pop('Project', None)
        task_copy.pop('Assigned To', None)
        task_copy.pop('Department', None)
        opt_tasks.append(task_copy)
    opt_data['Tasks'] = opt_tasks
    
    # 6. Meetings: drop Project name, Organizer name, keep only latest 100
    opt_meetings = []
    for mtg in data.get('Meetings', [])[-100:]:
        mtg_copy = mtg.copy()
        mtg_copy.pop('Project', None)
        mtg_copy.pop('Organizer', None)
        opt_meetings.append(mtg_copy)
    opt_data['Meetings'] = opt_meetings
    
    # 7. Weekly Updates: drop Project name, Department name, keep only latest 100
    opt_weekly = []
    for wu in data.get('Weekly Updates', data.get('WeeklyUpdates', []))[-100:]:
        wu_copy = wu.copy()
        wu_copy.pop('Project', None)
        wu_copy.pop('Department', None)
        opt_weekly.append(wu_copy)
    opt_data['Weekly Updates'] = opt_weekly
    
    # 8. Activity Log: drop Employee name, Department name, Project name, keep only latest 100
    opt_act = []
    for act in data.get('Activity Log', data.get('ActivityLog', []))[-100:]:
        act_copy = act.copy()
        act_copy.pop('Employee', None)
        act_copy.pop('Department', None)
        act_copy.pop('Project', None)
        opt_act.append(act_copy)
    opt_data['Activity Log'] = opt_act
    
    # Build the final CSV text
    csv_text = ""
    for k, v in opt_data.items():
        csv_text += f"=== TABLE: {k} ===\n{to_csv_string(v)}\n\n"
    
    return csv_text

def build_system_instruction(dataset_csv: str) -> str:
    return f"""You are the Dashboard AI Assistant for the Saudi Arabian Enterprise Projects & Workforce Dashboard.
You have direct, complete access to the entire dashboard dataset.

Here is the dataset in CSV format. It is structured like a normalized database. Perform JOINs using IDs (like Employee ID, Department ID, Project ID, Task ID, etc.) when needed to reconstruct names:
{dataset_csv}

Use this dataset to answer the user's questions. Follow these strict guidelines:
1. Base your answers primarily on the facts, numbers, and dates in the provided dataset.
2. CHATBOT RULES:
   - Priority 1 (Available Data): If the answer or data requested is present in the data file, you MUST answer directly and accurately using that data.
   - Priority 2 (Unavailable Data): If the answer/data is NOT available in the data file, answer that this is not avaivable in the data file.
     - For queries about employee demographics or attributes not explicitly stored in columns (e.g., employee gender), you MUST deduce the answer by analyzing other available data, such as classifying the employee names (e.g., Fatimah, Renad, Reem, Salwa, Abeer, Raghad are female names; Saad, Khalid, Mohammed, Yousef, Ahmed are male names). Count and summarize them to answer the user's request.
   - MAKE ALL ANSWERS HIGHLY CONCISE. Avoid fluff and wordy explanations, getting straight to the numbers or details requested.
3. The dataset contains several tables/sections:
   - Dashboard: high-level summary KPIs (note: Cell B7 formula was fixed, there are 285 open tasks).
   - Departments: details on 14 departments (headcount, annual budget in SAR, director, location, etc.).
   - Employees: 124 employees (hire date, status, manager, level, role, department).
   - Projects: 24 projects (budget, actual spend, progress %, status, priority, risk, strategic theme).
   - Tasks: 336 tasks with estimated and actual hours, due dates, completion % and assigned employees.
   - Meetings: 100 latest meetings details (outcomes, organizer, attendees count, location).
   - Weekly Updates: 100 latest weekly progress, health, key accomplishments, blocker/risk, next steps.
   - Activity Log: 100 latest audit log entries.
4. Format your answers in clean Markdown (including tables and lists if appropriate).
5. If the user asks for calculations (e.g. total budgets, average task completion), perform them accurately based on the data.
6. Saudi Arabian Currency is SAR (Saudi Riyal). Always output budgets and spends in SAR if they relate to financial metrics.
"""


def refresh_dashboard_context(next_data: dict[str, Any] | None = None) -> dict[str, Any]:
    global dashboard_data, dataset_csv_str, SYSTEM_INSTRUCTION

    dashboard_data = next_data or load_dashboard_data()
    dataset_csv_str = get_optimized_dataset_csv(dashboard_data)
    SYSTEM_INSTRUCTION = build_system_instruction(dataset_csv_str)
    return dashboard_data


# Generate the optimized dataset
dataset_csv_str = get_optimized_dataset_csv(dashboard_data)

# Define Request and Response models
class ChatMessage(BaseModel):
    role: str = Field(description="Must be 'user' or 'model' (or 'assistant' which we will map to 'model')")
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str

SYSTEM_INSTRUCTION = build_system_instruction(dataset_csv_str)


class DashboardTableUpdate(BaseModel):
    rows: list[dict[str, Any]]


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class PageWidgetAutofillRequest(BaseModel):
    title: str


class PageWidgetAutofillResponse(BaseModel):
    label: str
    source_table: str
    metric: str
    field: str = ""
    filter_field: str = ""
    filter_value: str = ""
    graph_type: str = ""
    group_field: str = ""
    note: str = ""


def require_admin(current_user: PublicUser = Depends(get_current_user)) -> PublicUser:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )
    return current_user


def public_user_from_admin_row(user) -> dict[str, Any]:
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "is_active": bool(user["is_active"]),
        "auth_provider": user["auth_provider"],
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }

# Initialize Gemini Client helper
def get_gemini_client():
    api_key = GEMINI_API_KEY_OVERRIDE or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is missing. Please paste it in backend/main.py or configure backend/.env file."
        )
    return genai.Client(api_key=api_key)


def get_dashboard_schema(data: dict[str, Any]) -> dict[str, list[str]]:
    schema: dict[str, list[str]] = {}
    for table_name, rows in data.items():
        if table_name == "Page Settings" or not isinstance(rows, list):
            continue

        columns: list[str] = []
        for row in rows:
            if isinstance(row, dict):
                columns = list(row.keys())
                break

        if columns:
            schema[table_name] = columns

    return schema


def normalize_match_text(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())).strip()


def get_text_acronym(value: Any) -> str:
    return "".join(word[0] for word in normalize_match_text(value).split() if word)


def get_distinct_values(rows: list[Any], field: str, limit: int = 40) -> list[str]:
    values: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        value = row.get(field)
        if value is None or str(value).strip() == "":
            continue
        text = str(value).strip()
        if text not in values:
            values.append(text)
        if len(values) >= limit:
            break
    return values


def get_dashboard_value_samples(data: dict[str, Any], schema: dict[str, list[str]]) -> dict[str, dict[str, list[str]]]:
    categorical_words = (
        "status", "risk", "priority", "health", "department", "location", "level",
        "type", "category", "director", "manager", "owner", "organizer", "assigned"
    )
    samples: dict[str, dict[str, list[str]]] = {}
    for table_name, columns in schema.items():
        rows = data.get(table_name, [])
        if not isinstance(rows, list):
            continue
        table_samples: dict[str, list[str]] = {}
        for column in columns:
            normalized_column = column.lower()
            if column.endswith("ID") or any(word in normalized_column for word in categorical_words):
                values = get_distinct_values(rows, column, limit=18)
                if values:
                    table_samples[column] = values
        if table_samples:
            samples[table_name] = table_samples
    return samples


def best_value_match(query: str, candidates: list[str]) -> str:
    normalized_query = normalize_match_text(query)
    query_parts = [part for part in normalized_query.split() if part]
    if not normalized_query or not candidates:
        return ""

    best_candidate = ""
    best_score = 0
    for candidate in candidates:
        normalized_candidate = normalize_match_text(candidate)
        candidate_words = normalized_candidate.split()
        candidate_acronym = get_text_acronym(candidate)
        score = 0

        if normalized_candidate == normalized_query:
            score += 100
        if candidate_acronym and candidate_acronym == normalized_query:
            score += 95
        if normalized_query in normalized_candidate:
            score += 75
        if normalized_candidate in normalized_query:
            score += 65
        if query_parts and all(
            any(word.startswith(part) for word in candidate_words)
            for part in query_parts
        ):
            score += 55
        score += sum(8 for part in query_parts if part in candidate_words)

        if score > best_score:
            best_candidate = candidate
            best_score = score

    return best_candidate if best_score >= 55 else ""


def resolve_department_filter_value(
    data: dict[str, Any],
    source_table: str,
    filter_field: str,
    filter_value: str,
    title: str,
) -> str:
    if filter_field not in {"Department", "Department Name", "Department ID"}:
        return ""

    departments = data.get("Departments", [])
    if not isinstance(departments, list):
        return ""

    query = f"{filter_value or title} {title}"
    query_tokens = set(normalize_match_text(query).split())
    for department in departments:
        if not isinstance(department, dict):
            continue
        department_name = str(department.get("Department Name", "")).strip()
        department_id = str(department.get("Department ID", "")).strip()
        department_acronym = get_text_acronym(department_name)
        aliases = [
            department_name,
            department_id,
            department_acronym,
            department.get("Cost Center", ""),
            department.get("Director", ""),
        ]
        direct_match = any(
            normalize_match_text(alias) in query_tokens
            for alias in aliases
            if str(alias).strip()
        )
        acronym_match = bool(department_acronym and department_acronym in query_tokens)
        fuzzy_match = bool(best_value_match(query, [department_name, department_id]))

        if direct_match or acronym_match or fuzzy_match:
            if filter_field == "Department ID":
                return department_id
            if filter_field in {"Department", "Department Name"}:
                return department_name

    rows = data.get(source_table, [])
    if isinstance(rows, list):
        return best_value_match(filter_value or title, get_distinct_values(rows, filter_field))
    return ""


def resolve_filter_value(
    data: dict[str, Any],
    source_table: str,
    filter_field: str,
    filter_value: str,
    title: str,
) -> str:
    if not filter_field:
        return ""

    department_match = resolve_department_filter_value(data, source_table, filter_field, filter_value, title)
    if department_match:
        return department_match

    rows = data.get(source_table, [])
    if not isinstance(rows, list):
        return filter_value or title

    exact_values = get_distinct_values(rows, filter_field, limit=500)
    query = filter_value or title
    for value in exact_values:
        if normalize_match_text(value) == normalize_match_text(query):
            return value

    fuzzy_match = best_value_match(query, exact_values)
    return fuzzy_match or query


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found.")

    return json.loads(cleaned[start:end + 1])

@app.get("/api/health")
def health_check():
    api_key = GEMINI_API_KEY_OVERRIDE or os.getenv("GEMINI_API_KEY")
    return {
        "status": "healthy",
        "data_loaded": True,
        "api_key_configured": bool(api_key),
        "email_configured": is_email_delivery_configured(),
        "email": get_email_delivery_status(),
        "database": get_database_status(),
        "data_size_chars": len(dataset_csv_str)
    }


@app.get("/api/dashboard-data")
def get_dashboard_data():
    return refresh_dashboard_context()


@app.put("/api/admin/dashboard-data/{table_name}")
def update_dashboard_table(
    table_name: str,
    payload: DashboardTableUpdate,
    current_user: PublicUser = Depends(require_admin),
):
    updated_data = replace_table(table_name, payload.rows)
    refresh_dashboard_context(updated_data)
    return {
        "message": f"{table_name} saved.",
        "table": table_name,
        "rows": updated_data[table_name],
        "data": updated_data,
    }


@app.get("/api/admin/workbook")
def download_workbook(current_user: PublicUser = Depends(require_admin)):
    workbook_path = get_excel_workbook_path()
    return FileResponse(
        workbook_path,
        filename="sample_data.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.post("/api/admin/page-editor/autofill", response_model=PageWidgetAutofillResponse)
def autofill_page_widget(
    payload: PageWidgetAutofillRequest,
    current_user: PublicUser = Depends(require_admin),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Card title is required.",
        )

    data = refresh_dashboard_context()
    schema = get_dashboard_schema(data)
    if not schema:
        raise HTTPException(status_code=500, detail="Dashboard schema is unavailable.")
    value_samples = get_dashboard_value_samples(data, schema)

    prompt = f"""
You are configuring one custom KPI card for an admin dashboard.
The admin typed this card title: {title!r}

Choose the best table, metric, metric field, and optional filter from this exact schema:
{json.dumps(schema, ensure_ascii=False)}

Use these real example values when choosing filters. If the admin uses an abbreviation
or close wording, convert it to the closest real value. Example: IT means Information
Technology or the matching Department ID if you choose Department ID.
{json.dumps(value_samples, ensure_ascii=False)}

Return JSON only with these exact keys:
{{
  "label": "short KPI title",
  "source_table": "one table name from the schema",
  "metric": "count | sum | average",
  "field": "required only for sum or average; otherwise empty string",
  "filter_field": "optional column name from the same source table, otherwise empty string",
  "filter_value": "optional exact likely value, otherwise empty string",
  "graph_type": "optional bar | donut | stacked | line, otherwise empty string",
  "group_field": "optional column name used to build the graph categories, otherwise empty string",
  "note": "short note explaining what the card shows"
}}

Rules:
- source_table must exactly match a table in the schema.
- field and filter_field must exactly match columns in source_table, or be empty strings.
- metric must be only count, sum, or average.
- graph_type must be one of bar, donut, stacked, or line, or empty string.
- group_field must exactly match a column in source_table, or be empty string.
- Prefer count for titles like High Risk Projects, Active Employees, Blocked Tasks.
- Prefer sum for budget, spend, cost, hours, or countable numeric totals.
- Prefer average for progress, utilization, completion, rating, or percentage titles.
- Do not invent tables, columns, or values.
"""

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
            config=types.GenerateContentConfig(temperature=0.1),
        )

        if not response.text:
            raise ValueError("Empty response from Gemini API.")

        suggestion = parse_json_object(response.text)
        source_table = str(suggestion.get("source_table", "")).strip()
        metric = str(suggestion.get("metric", "")).strip().lower()
        field = str(suggestion.get("field", "")).strip()
        filter_field = str(suggestion.get("filter_field", "")).strip()
        filter_value = str(suggestion.get("filter_value", "")).strip()
        graph_type = str(suggestion.get("graph_type", "")).strip().lower()
        group_field = str(suggestion.get("group_field", "")).strip()

        if source_table not in schema:
            raise ValueError("Gemini selected an unknown table.")
        if metric not in {"count", "sum", "average"}:
            raise ValueError("Gemini selected an unsupported metric.")
        if metric in {"sum", "average"} and field not in schema[source_table]:
            raise ValueError("Gemini selected an invalid metric field.")
        if metric == "count":
            field = "" if field not in schema[source_table] else field
        if filter_field and filter_field not in schema[source_table]:
            raise ValueError("Gemini selected an invalid filter field.")
        if filter_field:
            filter_value = resolve_filter_value(data, source_table, filter_field, filter_value, title)
        if graph_type and graph_type not in {"bar", "donut", "stacked", "line"}:
            raise ValueError("Gemini selected an invalid graph type.")
        if group_field and group_field not in schema[source_table]:
            raise ValueError("Gemini selected an invalid group field.")

        return PageWidgetAutofillResponse(
            label=str(suggestion.get("label", title)).strip() or title,
            source_table=source_table,
            metric=metric,
            field=field,
            filter_field=filter_field,
            filter_value=filter_value,
            graph_type=graph_type,
            group_field=group_field,
            note=str(suggestion.get("note", "")).strip(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not infer KPI settings: {exc}",
        )


@app.get("/api/admin/users")
def list_users(current_user: PublicUser = Depends(require_admin)):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, full_name, email, role, is_active, auth_provider, created_at, updated_at
            FROM users
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    return [public_user_from_admin_row(row) for row in rows]


@app.patch("/api/admin/users/{user_id}")
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: PublicUser = Depends(require_admin),
):
    updates = []
    values: list[Any] = []

    if payload.full_name is not None:
        full_name = payload.full_name.strip()
        if not full_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Full name cannot be empty.",
            )
        updates.append("full_name = ?")
        values.append(full_name)

    if payload.role is not None:
        if payload.role not in {"admin", "user"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Role must be admin or user.",
            )
        if user_id == current_user.id and payload.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove your own admin access.",
            )
        updates.append("role = ?")
        values.append(payload.role)

    if payload.is_active is not None:
        if user_id == current_user.id and not payload.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot disable your own account.",
            )
        updates.append("is_active = ?")
        values.append(1 if payload.is_active else 0)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No user fields were provided.",
        )

    values.append(user_id)
    with get_connection() as connection:
        cursor = connection.execute(
            f"""
            UPDATE users
            SET {", ".join(updates)},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            values,
        )
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        connection.commit()
        user = connection.execute(
            """
            SELECT id, full_name, email, role, is_active, auth_provider, created_at, updated_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    return public_user_from_admin_row(user)


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, current_user: PublicUser = Depends(require_admin)):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        connection.execute("DELETE FROM password_reset_otps WHERE user_id = ?", (user_id,))
        connection.execute("DELETE FROM users WHERE id = ?", (user_id,))
        connection.commit()

    return {"message": "User deleted."}

@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, current_user: PublicUser = Depends(get_current_user)):
    try:
        client = get_gemini_client()
        
        # Build contents structure with history
        contents = []
        for msg in payload.history:
            role = msg.role
            # Map assistant -> model as expected by Gemini API
            if role in ("assistant", "system_instruction"):
                role = "model"
            
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part(text=msg.content)]
                )
            )
            
        # Append the new user message
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=payload.message)]
            )
        )
        
        # Call Gemini API
        # We use gemini-2.5-flash which is fast, cost-effective and has a large context window
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2, # Lower temperature for factual, data-driven responses
            )
        )
        
        if not response.text:
            raise HTTPException(status_code=500, detail="Empty response from Gemini API.")
            
        return ChatResponse(response=response.text)
        
    except Exception as e:
        # Check if it's already an HTTPException
        if isinstance(e, HTTPException):
            raise e
        # Otherwise wrap it
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
