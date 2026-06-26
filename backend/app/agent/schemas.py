from pydantic import BaseModel, Field


class ConfirmAction(BaseModel):
    tool: str
    args: dict = Field(default_factory=dict)


class ChatRequest(BaseModel):
    message: str | None = None
    conversation_id: str | None = None
    confirm_action: ConfirmAction | None = None


class ToolCallOut(BaseModel):
    name: str
    args: dict = Field(default_factory=dict)
    status: str


class PendingAction(BaseModel):
    tool: str
    args: dict
    summary: str
    description: str


class ChatResponse(BaseModel):
    conversation_id: str
    status: str                      # completed | needs_confirmation
    reply: str = ""
    pending_action: PendingAction | None = None
    tool_calls: list[ToolCallOut] = Field(default_factory=list)


class ToolInfo(BaseModel):
    name: str
    description: str
    category: str
    destructive: bool


class ConversationOut(BaseModel):
    id: str
    title: str
    updated_at: str


class MessageOut(BaseModel):
    role: str
    content: str
    tool_calls: list[dict] = Field(default_factory=list)
    created_at: str
