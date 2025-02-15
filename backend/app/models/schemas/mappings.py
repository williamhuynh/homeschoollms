from .base import MongoBaseModel, PyObjectId

class ContentLearningOutcomeMap(MongoBaseModel):
    content_id: PyObjectId
    learning_outcome_id: PyObjectId
    relevance_score: float = 1.0