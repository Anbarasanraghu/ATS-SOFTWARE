# ATS AI Agent

An enterprise AI agent embedded in the ATS ERP, built to the architecture in
*ATS AI Agent Architecture & Tool Registry Guide*.

The LLM (Gemini) **only reasons and selects tools**. Every action runs through a
secure, audited, tenant-scoped backend tool — the model never sees the database
or writes SQL.

## How it works

```
Frontend (AssistantPage)  →  POST /agent/chat
        │
        ▼
  orchestrator.run_turn ──► Gemini generateContent (with tool declarations)
        │                         │
        │   ◄── functionCall ─────┘
        ▼
  registry tool handler  ──► parameterized query on the tenant-scoped session
        │                     (PostgreSQL RLS keeps it inside the tenant)
        ▼
  audit row (agent_tool_calls)  +  result fed back to Gemini  →  final answer
```

- **Permissions** — every tool declares optional `roles`. Tools the user may not
  run are never shown to the model (`REGISTRY.available_for(user)`).
- **Human confirmation** — tools marked `destructive=True` (writes) are never
  auto-run. The loop returns `needs_confirmation`; the UI asks the user, then
  re-calls `/agent/chat` with `confirm_action`.
- **Audit trail** — `agent_tool_calls` records every invocation (args, status,
  error, duration) per the guide's "audit log for every tool call".
- **Memory** — `agent_conversations` / `agent_messages` store transcripts; the
  last 20 messages are replayed as context.

## Files

| File | Purpose |
|------|---------|
| `registry.py` | `ToolSpec`, the `@tool` decorator, and the global `REGISTRY` |
| `tools.py` | The actual tool handlers (importing this registers them) |
| `gemini.py` | Async REST client for Gemini function calling |
| `orchestrator.py` | The understand→select→validate→execute→summarize loop |
| `router.py` | `/agent/chat`, `/agent/tools`, `/agent/conversations[...]` |
| `schemas.py` | Request/response models |

## Setup

1. **Run the migration** (Supabase SQL Editor or psql):
   `sql/016_agent.sql` — creates the three agent tables with RLS.
2. **Add a Gemini key** to `backend/.env`:
   `GEMINI_API_KEY=AIza...` (get one at <https://aistudio.google.com/apikey>).
3. **Install deps**: `pip install -r requirements.txt` (adds `httpx`).
4. Restart the backend. Open the app → **AI Assistant** in the sidebar.

## Adding a new tool

```python
from app.agent.registry import tool

@tool(
    name="get_supplier_list",
    description="List suppliers with contact details.",
    category="inventory",
    # roles={"owner", "admin"},   # optional role gate
    # destructive=True,           # set for writes → requires confirmation
)
async def get_supplier_list(ctx, limit: int = 25) -> dict:
    rows = await _rows(ctx, "select name, phone from suppliers limit :lim", {"lim": limit})
    return {"suppliers": rows}
```

Add parameters as JSON Schema in the `parameters=` argument; the orchestrator
filters incoming args to the declared properties before calling the handler.

## Currently registered tools (15)

Dashboard/reports: `get_dashboard_summary`, `get_today_sales`,
`generate_sales_report`, `get_report_list`, `get_cash_flow`.
CRM: `get_customer_list`, `search_customer`, `get_pending_tasks`,
`create_customer`*, `record_customer_followup`*.
Inventory: `get_inventory_status`, `get_low_stock_products`,
`predict_stock_requirement`.
Billing: `get_invoice`. HR: `get_employee_list` (manager+).

`*` = destructive (requires confirmation).
