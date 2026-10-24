from typing import Literal

from pydantic import BaseModel, Field as PydanticField, model_validator


BloomStage = Literal["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
Difficulty = Literal["too-easy", "about-right", "too-hard"]


class LearnerContextPayload(BaseModel):
    examDate: str = ""
    timeAvailable: str = "About 20 minutes a day"
    preferredLength: Literal["Short", "Balanced", "Detailed"] = "Short"
    tutorEnabled: bool = True
    focus: str = ""


class WeeklyGoalPayload(BaseModel):
    weeklyGoalMinutes: int = PydanticField(ge=15, le=1200)


class RenameSourcePayload(BaseModel):
    name: str = PydanticField(min_length=1, max_length=240)


class AnswerPayload(BaseModel):
    questionId: str
    answer: str = PydanticField(min_length=1, max_length=12000)
    hintsUsed: int = PydanticField(default=0, ge=0, le=3)
    tutorUsed: bool = False
    difficulty: Difficulty | None = None


class DifficultyPayload(BaseModel):
    difficulty: Difficulty


class SourceReference(BaseModel):
    sourceName: str = PydanticField(min_length=1, max_length=240)
    location: str = PydanticField(default="", max_length=80)
    excerpt: str = PydanticField(min_length=8, max_length=400)


class ReasoningNode(BaseModel):
    id: str = PydanticField(min_length=1, max_length=64)
    step: str = PydanticField(min_length=1, max_length=600)


class ReasoningEdge(BaseModel):
    source: str = PydanticField(min_length=1, max_length=64)
    target: str = PydanticField(min_length=1, max_length=64)
    deduction: str = PydanticField(min_length=1, max_length=400)


class ReasoningGraph(BaseModel):
    nodes: list[ReasoningNode] = PydanticField(min_length=2, max_length=12)
    edges: list[ReasoningEdge] = PydanticField(min_length=1, max_length=24)

    @model_validator(mode="after")
    def validate_dag(self) -> "ReasoningGraph":
        ids = [node.id for node in self.nodes]
        if len(ids) != len(set(ids)):
            raise ValueError("Reasoning node identifiers must be unique.")
        known = set(ids)
        adjacency = {node_id: [] for node_id in ids}
        indegree = {node_id: 0 for node_id in ids}
        seen: set[tuple[str, str]] = set()
        for edge in self.edges:
            pair = (edge.source, edge.target)
            if edge.source not in known or edge.target not in known or edge.source == edge.target or pair in seen:
                raise ValueError("Reasoning edges must connect distinct known nodes exactly once.")
            seen.add(pair)
            adjacency[edge.source].append(edge.target)
            indegree[edge.target] += 1
        ready = [node_id for node_id, degree in indegree.items() if degree == 0]
        visited = 0
        while ready:
            current = ready.pop()
            visited += 1
            for target in adjacency[current]:
                indegree[target] -= 1
                if indegree[target] == 0:
                    ready.append(target)
        if visited != len(ids):
            raise ValueError("The question reasoning graph must be acyclic.")
        sinks = [node_id for node_id, targets in adjacency.items() if not targets]
        if len(sinks) != 1:
            raise ValueError("The question reasoning graph must have one final conclusion node.")
        reverse = {node_id: [] for node_id in ids}
        for source, targets in adjacency.items():
            for target in targets:
                reverse[target].append(source)
        reaches_conclusion = set()
        pending = sinks[:]
        while pending:
            current = pending.pop()
            if current in reaches_conclusion:
                continue
            reaches_conclusion.add(current)
            pending.extend(reverse[current])
        if reaches_conclusion != known:
            raise ValueError("Every reasoning step must lead to the final conclusion.")
        return self


class ChatPart(BaseModel):
    type: str
    text: str | None = PydanticField(default=None, max_length=5000)


class ChatUIMessage(BaseModel):
    id: str | None = None
    role: Literal["system", "user", "assistant", "developer"]
    parts: list[ChatPart] = PydanticField(default_factory=list)


class ChatStreamPayload(BaseModel):
    topicId: str | None = None
    questionId: str | None = None
    messages: list[ChatUIMessage] = PydanticField(min_length=1, max_length=30)


class TopicMetaChanges(BaseModel):
    title: str | None = PydanticField(default=None, max_length=180)
    subject: str | None = PydanticField(default=None, max_length=120)
    description: str | None = PydanticField(default=None, max_length=1200)


class LearnerContextChanges(BaseModel):
    examDate: str | None = PydanticField(default=None, max_length=40)
    timeAvailable: str | None = PydanticField(default=None, max_length=160)
    preferredLength: Literal["Short", "Balanced", "Detailed"] | None = None
    tutorEnabled: bool | None = None
    focus: str | None = PydanticField(default=None, max_length=600)


class PlanNodeChange(BaseModel):
    id: str = PydanticField(min_length=1, max_length=80)
    label: str | None = PydanticField(default=None, max_length=180)
    description: str | None = PydanticField(default=None, max_length=1000)
    prerequisites: list[str] | None = PydanticField(default=None, max_length=8)


class PlanQuestionChange(BaseModel):
    id: str = PydanticField(min_length=1, max_length=80)
    title: str | None = PydanticField(default=None, max_length=180)
    prompt: str | None = PydanticField(default=None, max_length=5000)
    stage: BloomStage | None = None
    mode: Literal["Solo", "Partner"] | None = None
    durationMinutes: int | None = PydanticField(default=None, ge=1, le=30)
    sources: list[SourceReference] | None = PydanticField(default=None, max_length=3)


class PlanNodeAddition(BaseModel):
    key: str = PydanticField(min_length=1, max_length=64)
    label: str = PydanticField(min_length=1, max_length=180)
    description: str = PydanticField(min_length=1, max_length=1000)
    prerequisites: list[str] = PydanticField(default_factory=list, max_length=8)


class PlanQuestionAddition(BaseModel):
    nodeRef: str = PydanticField(min_length=1, max_length=80)
    title: str = PydanticField(min_length=1, max_length=180)
    prompt: str = PydanticField(min_length=1, max_length=5000)
    stage: BloomStage
    mode: Literal["Solo", "Partner"] = "Solo"
    durationMinutes: int = PydanticField(default=5, ge=1, le=30)
    sources: list[SourceReference] = PydanticField(default_factory=list, max_length=3)


class TopicChangeSet(BaseModel):
    assistantMessage: str = PydanticField(min_length=1, max_length=1200)
    proposalType: Literal["requested", "alternative"] = "requested"
    topic: TopicMetaChanges = PydanticField(default_factory=TopicMetaChanges)
    context: LearnerContextChanges = PydanticField(default_factory=LearnerContextChanges)
    nodes: list[PlanNodeChange] = PydanticField(default_factory=list, max_length=8)
    questions: list[PlanQuestionChange] = PydanticField(default_factory=list, max_length=96)
    addNodes: list[PlanNodeAddition] = PydanticField(default_factory=list, max_length=8)
    addQuestions: list[PlanQuestionAddition] = PydanticField(default_factory=list, max_length=96)
    deleteNodeIds: list[str] = PydanticField(default_factory=list, max_length=8)
    deleteQuestionIds: list[str] = PydanticField(default_factory=list, max_length=96)
    baseVersion: str = PydanticField(min_length=1, max_length=64)


class TopicChangeProposal(BaseModel):
    proposal: TopicChangeSet


class ApplyTopicChangesPayload(BaseModel):
    proposal: TopicChangeSet


class PlanNodeOutput(BaseModel):
    key: str = PydanticField(min_length=1, max_length=64)
    label: str = PydanticField(min_length=1, max_length=180)
    description: str = PydanticField(min_length=1, max_length=1000)
    prerequisites: list[str] = PydanticField(default_factory=list)


class PlanQuestionOutput(BaseModel):
    nodeKey: str = PydanticField(min_length=1, max_length=64)
    title: str = PydanticField(min_length=1, max_length=180)
    prompt: str = PydanticField(min_length=1, max_length=5000)
    stage: BloomStage
    mode: Literal["Solo", "Partner"] = "Solo"
    durationMinutes: int = PydanticField(default=5, ge=1, le=30)
    sources: list[SourceReference] = PydanticField(default_factory=list, max_length=3)
    reasoningGraph: ReasoningGraph


class GeneratedPlan(BaseModel):
    title: str = PydanticField(min_length=1, max_length=180)
    subject: str = PydanticField(min_length=1, max_length=120)
    description: str = PydanticField(min_length=1, max_length=1200)
    focus: str = PydanticField(max_length=600)
    nodes: list[PlanNodeOutput] = PydanticField(min_length=3, max_length=8)
    questions: list[PlanQuestionOutput] = PydanticField(min_length=24, max_length=96)

    @model_validator(mode="after")
    def validate_question_coverage(self) -> "GeneratedPlan":
        if not self.nodes:
            return self
        node_keys = {node.key for node in self.nodes}
        questions_by_node: dict[str, list[PlanQuestionOutput]] = {key: [] for key in node_keys}
        for question in self.questions:
            if question.nodeKey not in questions_by_node:
                raise ValueError("Every question must reference a learning node in the plan.")
            questions_by_node[question.nodeKey].append(question)

        advanced_stages = {"Analyze", "Evaluate", "Create"}
        covered_advanced_stages: set[str] = set()
        for node_key, questions in questions_by_node.items():
            for stage in ("Remember", "Understand", "Apply"):
                count = sum(question.stage == stage for question in questions)
                if not 2 <= count <= 3:
                    raise ValueError(f"Node {node_key} must have 2–3 {stage} questions.")
            advanced_count = sum(question.stage in advanced_stages for question in questions)
            if not 2 <= advanced_count <= 3:
                raise ValueError(f"Node {node_key} must have 2–3 Analyze/Evaluate/Create questions.")
            covered_advanced_stages.update(question.stage for question in questions if question.stage in advanced_stages)

        if covered_advanced_stages != advanced_stages:
            raise ValueError("The plan must include Analyze, Evaluate, and Create questions across its nodes.")
        return self


class AnswerEvaluation(BaseModel):
    correctness: Literal["strong", "partial", "incorrect"]
    estimatedPointsPercent: int = PydanticField(ge=0, le=100)
    headline: str = PydanticField(min_length=1, max_length=160)
    feedback: str = PydanticField(min_length=1, max_length=1800)
    nextActivity: str = PydanticField(min_length=1, max_length=240)
    nextReason: str = PydanticField(min_length=1, max_length=900)
    nextQuestionId: str = PydanticField(max_length=80)
    sources: list[SourceReference] = PydanticField(default_factory=list, max_length=3)


class GeneratedPracticeQuestion(BaseModel):
    title: str = PydanticField(min_length=1, max_length=180)
    prompt: str = PydanticField(min_length=1, max_length=5000)
    stage: BloomStage
    durationMinutes: int = PydanticField(default=5, ge=1, le=30)
    sources: list[SourceReference] = PydanticField(default_factory=list, max_length=3)
    reasoningGraph: ReasoningGraph
