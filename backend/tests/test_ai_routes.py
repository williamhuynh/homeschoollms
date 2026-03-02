"""
Tests for AI routes (/api/v1/ai/*).

Covers the four AI endpoints:
- POST /api/v1/ai/generate-description
- POST /api/v1/ai/analyze-image
- POST /api/v1/ai/suggest-outcomes
- POST /api/v1/ai/chat

All endpoints require authentication. The AI service calls are mocked
since we don't have an actual Gemini API key in tests.
"""

import io
import json

import pytest
from unittest.mock import patch, AsyncMock
from bson import ObjectId


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_image_files(count=1, filename="test.png", content_type="image/png", data=b"fake-image-data"):
    """Create a list of file tuples suitable for httpx multipart upload."""
    return [
        ("files", (f"{i}_{filename}", io.BytesIO(data), content_type))
        for i in range(count)
    ]


def _make_empty_image_files():
    """Create file tuples with zero-length content."""
    return [("files", ("empty.png", io.BytesIO(b""), "image/png"))]


def _make_non_image_files():
    """Create file tuples with a non-image MIME type."""
    return [("files", ("doc.pdf", io.BytesIO(b"pdf-data"), "application/pdf"))]


# =========================================================================
# POST /api/v1/ai/generate-description
# =========================================================================

class TestGenerateDescription:
    """Tests for the generate-description endpoint."""

    ENDPOINT = "/api/v1/ai/generate-description"

    # ----- Authentication -----

    async def test_unauthenticated_returns_401(self, unauthenticated_client):
        """Unauthenticated requests should be rejected with 401."""
        files = _make_image_files()
        resp = await unauthenticated_client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Math worksheet"},
        )
        assert resp.status_code == 401

    # ----- Input validation -----

    async def test_missing_files_returns_422(self, client):
        """Request without files should return 422."""
        resp = await client.post(
            self.ENDPOINT,
            data={"context_description": "Some context"},
        )
        assert resp.status_code == 422

    async def test_missing_context_description_returns_422(self, client):
        """Request without context_description should return 422."""
        files = _make_image_files()
        resp = await client.post(self.ENDPOINT, files=files)
        assert resp.status_code == 422

    async def test_empty_context_description_returns_422(self, client):
        """An empty or whitespace-only context_description should be rejected."""
        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "   "},
        )
        assert resp.status_code == 422

    async def test_empty_file_content_returns_422(self, client):
        """Files with zero-length content should be treated as invalid."""
        files = _make_empty_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Some context"},
        )
        assert resp.status_code == 422

    async def test_non_image_file_only_returns_422(self, client):
        """Only non-image files should result in no valid images and 422."""
        files = _make_non_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Some context"},
        )
        assert resp.status_code == 422

    # ----- Successful calls -----

    @patch(
        "app.routes.ai_routes.ai_service.generate_title_from_images",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.ai_routes.ai_service.generate_description_from_images",
        new_callable=AsyncMock,
    )
    async def test_single_image_success(self, mock_desc, mock_title, client):
        """A valid single-image request should return description and title."""
        mock_desc.return_value = "The student completed a math worksheet."
        mock_title.return_value = "Math Worksheet Activity"

        files = _make_image_files(count=1)
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Math practice"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["description"] == "The student completed a math worksheet."
        assert body["title"] == "Math Worksheet Activity"
        mock_desc.assert_called_once()
        mock_title.assert_called_once()

    @patch(
        "app.routes.ai_routes.ai_service.generate_title_from_images",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.ai_routes.ai_service.generate_description_from_images",
        new_callable=AsyncMock,
    )
    async def test_multiple_images_success(self, mock_desc, mock_title, client):
        """A valid multi-image request should pass all images to the AI service."""
        mock_desc.return_value = "Multiple images showing progress."
        mock_title.return_value = "Multi-Image Evidence"

        files = _make_image_files(count=3)
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Art project stages"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["description"] == "Multiple images showing progress."
        assert body["title"] == "Multi-Image Evidence"

        # Verify the AI service received 3 image dicts
        call_kwargs = mock_desc.call_args
        images_arg = call_kwargs.kwargs.get("images") or call_kwargs[1].get("images") or call_kwargs[0][0]
        if isinstance(images_arg, list):
            assert len(images_arg) == 3

    @patch(
        "app.routes.ai_routes.ai_service.generate_title_from_images",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.ai_routes.ai_service.generate_description_from_images",
        new_callable=AsyncMock,
    )
    async def test_title_failure_uses_fallback(self, mock_desc, mock_title, client):
        """If title generation fails, a fallback title should be returned."""
        mock_desc.return_value = "Valid description."
        mock_title.side_effect = Exception("AI title generation exploded")

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Science experiment"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["description"] == "Valid description."
        # Fallback title starts with "AI Analyzed Evidence"
        assert body["title"].startswith("AI Analyzed Evidence")

    @patch(
        "app.routes.ai_routes.ai_service.generate_title_from_images",
        new_callable=AsyncMock,
    )
    @patch(
        "app.routes.ai_routes.ai_service.generate_description_from_images",
        new_callable=AsyncMock,
    )
    async def test_empty_title_uses_fallback(self, mock_desc, mock_title, client):
        """If AI returns an empty title string, fallback should be used."""
        mock_desc.return_value = "Valid description."
        mock_title.return_value = "   "

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Reading lesson"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["title"].startswith("AI Analyzed Evidence")

    # ----- Error handling -----

    @patch(
        "app.routes.ai_routes.ai_service.generate_description_from_images",
        new_callable=AsyncMock,
    )
    async def test_ai_service_failure_returns_500(self, mock_desc, client):
        """An unexpected error in the AI service should yield 500."""
        mock_desc.side_effect = RuntimeError("Gemini API unreachable")

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Some context"},
        )

        assert resp.status_code == 500
        assert "internal error" in resp.json()["detail"].lower()

    @patch(
        "app.routes.ai_routes.ai_service.generate_description_from_images",
        new_callable=AsyncMock,
    )
    async def test_ai_service_http_exception_propagates(self, mock_desc, client):
        """HTTPExceptions raised by the AI service should propagate status code."""
        from fastapi import HTTPException

        mock_desc.side_effect = HTTPException(status_code=422, detail="API key not configured")

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data={"context_description": "Some context"},
        )

        assert resp.status_code == 422
        assert "API key" in resp.json()["detail"]


# =========================================================================
# POST /api/v1/ai/analyze-image
# =========================================================================

class TestAnalyzeImage:
    """Tests for the analyze-image endpoint."""

    ENDPOINT = "/api/v1/ai/analyze-image"

    # ----- Authentication -----

    async def test_unauthenticated_returns_401(self, unauthenticated_client):
        """Unauthenticated requests should be rejected with 401."""
        files = _make_image_files()
        resp = await unauthenticated_client.post(self.ENDPOINT, files=files)
        assert resp.status_code == 401

    # ----- Input validation -----

    async def test_missing_files_returns_422(self, client):
        """Request without files should return 422."""
        resp = await client.post(self.ENDPOINT)
        assert resp.status_code == 422

    async def test_empty_file_content_returns_422(self, client):
        """Files with zero-length content should be treated as invalid."""
        files = _make_empty_image_files()
        resp = await client.post(self.ENDPOINT, files=files)
        assert resp.status_code == 422

    async def test_non_image_file_only_returns_422(self, client):
        """Only non-image files should be rejected."""
        files = _make_non_image_files()
        resp = await client.post(self.ENDPOINT, files=files)
        assert resp.status_code == 422

    # ----- Successful calls -----

    @patch(
        "app.routes.ai_routes.ai_service.analyze_image_for_questions",
        new_callable=AsyncMock,
    )
    async def test_single_image_success(self, mock_analyze, client):
        """A valid request should return a list of questions."""
        mock_analyze.return_value = [
            {
                "question": "What subject is this work for?",
                "type": "multiple_choice",
                "options": ["Mathematics", "English", "Science", "Art"],
            },
            {
                "question": "What was the student working on?",
                "type": "free_text",
            },
        ]

        files = _make_image_files()
        resp = await client.post(self.ENDPOINT, files=files)

        assert resp.status_code == 200
        body = resp.json()
        assert "questions" in body
        assert isinstance(body["questions"], list)
        assert len(body["questions"]) == 2
        mock_analyze.assert_called_once()

    @patch(
        "app.routes.ai_routes.ai_service.analyze_image_for_questions",
        new_callable=AsyncMock,
    )
    async def test_multiple_images_success(self, mock_analyze, client):
        """Multiple valid images should all be passed to the AI service."""
        mock_analyze.return_value = [
            {"question": "Describe the activity", "type": "free_text"}
        ]

        files = _make_image_files(count=2)
        resp = await client.post(self.ENDPOINT, files=files)

        assert resp.status_code == 200
        assert len(resp.json()["questions"]) == 1

        # Verify 2 images were passed
        call_kwargs = mock_analyze.call_args
        images_arg = call_kwargs.kwargs.get("images") or call_kwargs[0][0]
        if isinstance(images_arg, list):
            assert len(images_arg) == 2

    # ----- Error handling -----

    @patch(
        "app.routes.ai_routes.ai_service.analyze_image_for_questions",
        new_callable=AsyncMock,
    )
    async def test_ai_service_failure_returns_500(self, mock_analyze, client):
        """An unexpected error in the AI service should yield 500."""
        mock_analyze.side_effect = RuntimeError("Model failure")

        files = _make_image_files()
        resp = await client.post(self.ENDPOINT, files=files)

        assert resp.status_code == 500
        assert "internal error" in resp.json()["detail"].lower()

    @patch(
        "app.routes.ai_routes.ai_service.analyze_image_for_questions",
        new_callable=AsyncMock,
    )
    async def test_ai_service_http_exception_propagates(self, mock_analyze, client):
        """HTTPExceptions raised by the AI service should propagate."""
        from fastapi import HTTPException

        mock_analyze.side_effect = HTTPException(
            status_code=422, detail="API key not configured"
        )

        files = _make_image_files()
        resp = await client.post(self.ENDPOINT, files=files)

        assert resp.status_code == 422


# =========================================================================
# POST /api/v1/ai/suggest-outcomes
# =========================================================================

class TestSuggestOutcomes:
    """Tests for the suggest-outcomes endpoint."""

    ENDPOINT = "/api/v1/ai/suggest-outcomes"

    VALID_QUESTION_ANSWERS = json.dumps({"What subject?": "Mathematics"})
    VALID_CURRICULUM_DATA = json.dumps({
        "subjects": [
            {
                "name": "Mathematics",
                "outcomes": [
                    {"code": "MA2-RN-01", "description": "Recognises and classifies numbers"},
                ],
            }
        ]
    })
    VALID_STUDENT_GRADE = "Year 3"

    def _form_data(self, **overrides):
        """Return default form data dict, with optional overrides."""
        data = {
            "question_answers": self.VALID_QUESTION_ANSWERS,
            "curriculum_data": self.VALID_CURRICULUM_DATA,
            "student_grade": self.VALID_STUDENT_GRADE,
        }
        data.update(overrides)
        return data

    # ----- Authentication -----

    async def test_unauthenticated_returns_401(self, unauthenticated_client):
        """Unauthenticated requests should be rejected with 401."""
        files = _make_image_files()
        resp = await unauthenticated_client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )
        assert resp.status_code == 401

    # ----- Input validation -----

    async def test_missing_files_returns_422(self, client):
        """Request without files should return 422."""
        resp = await client.post(self.ENDPOINT, data=self._form_data())
        assert resp.status_code == 422

    async def test_missing_question_answers_returns_422(self, client):
        """Request without question_answers should return 422."""
        files = _make_image_files()
        data = self._form_data()
        del data["question_answers"]
        resp = await client.post(self.ENDPOINT, files=files, data=data)
        assert resp.status_code == 422

    async def test_missing_curriculum_data_returns_422(self, client):
        """Request without curriculum_data should return 422."""
        files = _make_image_files()
        data = self._form_data()
        del data["curriculum_data"]
        resp = await client.post(self.ENDPOINT, files=files, data=data)
        assert resp.status_code == 422

    async def test_missing_student_grade_returns_422(self, client):
        """Request without student_grade should return 422."""
        files = _make_image_files()
        data = self._form_data()
        del data["student_grade"]
        resp = await client.post(self.ENDPOINT, files=files, data=data)
        assert resp.status_code == 422

    async def test_invalid_question_answers_json_returns_422(self, client):
        """Malformed JSON in question_answers should return 422."""
        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(question_answers="not-valid-json{{{"),
        )
        assert resp.status_code == 422

    async def test_invalid_curriculum_data_json_returns_422(self, client):
        """Malformed JSON in curriculum_data should return 422."""
        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(curriculum_data="[broken json"),
        )
        assert resp.status_code == 422

    async def test_empty_file_content_returns_422(self, client):
        """Files with zero-length content should be treated as invalid."""
        files = _make_empty_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )
        assert resp.status_code == 422

    async def test_non_image_file_only_returns_422(self, client):
        """Only non-image files should be rejected."""
        files = _make_non_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )
        assert resp.status_code == 422

    # ----- Successful calls -----

    @patch(
        "app.routes.ai_routes.ai_service.suggest_learning_outcomes",
        new_callable=AsyncMock,
    )
    async def test_success_returns_outcomes(self, mock_suggest, client):
        """A valid request should return suggested outcomes."""
        mock_suggest.return_value = [
            {
                "outcome_code": "MA2-RN-01",
                "outcome_description": "Recognises and classifies numbers",
                "confidence": 85,
                "reason": "The worksheet shows number classification exercises.",
            },
        ]

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )

        assert resp.status_code == 200
        body = resp.json()
        assert "outcomes" in body
        assert isinstance(body["outcomes"], list)
        assert len(body["outcomes"]) == 1
        assert body["outcomes"][0]["outcome_code"] == "MA2-RN-01"
        mock_suggest.assert_called_once()

    @patch(
        "app.routes.ai_routes.ai_service.suggest_learning_outcomes",
        new_callable=AsyncMock,
    )
    async def test_success_passes_parsed_json_to_service(self, mock_suggest, client):
        """The route should parse JSON strings and pass dicts to the service."""
        mock_suggest.return_value = []

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )

        assert resp.status_code == 200

        # Inspect what the AI service received
        call_kwargs = mock_suggest.call_args.kwargs
        assert isinstance(call_kwargs.get("question_answers"), dict)
        assert isinstance(call_kwargs.get("curriculum_data"), dict)
        assert call_kwargs.get("student_grade") == "Year 3"

    @patch(
        "app.routes.ai_routes.ai_service.suggest_learning_outcomes",
        new_callable=AsyncMock,
    )
    async def test_multiple_images_passed_to_service(self, mock_suggest, client):
        """Multiple valid images should all be sent to the AI service."""
        mock_suggest.return_value = []

        files = _make_image_files(count=4)
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )

        assert resp.status_code == 200
        images_arg = mock_suggest.call_args.kwargs.get("images")
        assert len(images_arg) == 4

    # ----- Error handling -----

    @patch(
        "app.routes.ai_routes.ai_service.suggest_learning_outcomes",
        new_callable=AsyncMock,
    )
    async def test_ai_service_failure_returns_500(self, mock_suggest, client):
        """An unexpected error in the AI service should yield 500."""
        mock_suggest.side_effect = RuntimeError("Gemini crashed")

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )

        assert resp.status_code == 500
        assert "internal error" in resp.json()["detail"].lower()

    @patch(
        "app.routes.ai_routes.ai_service.suggest_learning_outcomes",
        new_callable=AsyncMock,
    )
    async def test_ai_service_http_exception_propagates(self, mock_suggest, client):
        """HTTPExceptions raised by the AI service should propagate."""
        from fastapi import HTTPException

        mock_suggest.side_effect = HTTPException(
            status_code=422, detail="API key not configured"
        )

        files = _make_image_files()
        resp = await client.post(
            self.ENDPOINT,
            files=files,
            data=self._form_data(),
        )

        assert resp.status_code == 422


# =========================================================================
# POST /api/v1/ai/chat
# =========================================================================

class TestAIChat:
    """Tests for the AI chat endpoint."""

    ENDPOINT = "/api/v1/ai/chat"

    # ----- Authentication -----

    async def test_unauthenticated_returns_401(self, unauthenticated_client, test_student_id):
        """Unauthenticated requests should be rejected with 401."""
        resp = await unauthenticated_client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )
        assert resp.status_code == 401

    # ----- Input validation -----

    async def test_invalid_json_body_returns_400(self, client):
        """A non-JSON body should return 400."""
        resp = await client.post(
            self.ENDPOINT,
            content=b"this is not json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert "Invalid JSON" in resp.json()["detail"]

    async def test_empty_messages_returns_422(self, client, test_student_id):
        """An empty messages array should return 422."""
        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": [],
            },
        )
        assert resp.status_code == 422
        assert "non-empty" in resp.json()["detail"].lower()

    async def test_missing_messages_returns_422(self, client, test_student_id):
        """Missing messages field (defaults to []) should return 422."""
        resp = await client.post(
            self.ENDPOINT,
            json={"student_id": str(test_student_id)},
        )
        assert resp.status_code == 422

    async def test_messages_not_array_returns_422(self, client, test_student_id):
        """Non-array messages should return 422."""
        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": "not an array",
            },
        )
        assert resp.status_code == 422

    async def test_no_student_identifier_returns_404(self, client):
        """Without student_id or student_slug, student lookup should fail with 404."""
        resp = await client.post(
            self.ENDPOINT,
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert resp.status_code == 404
        assert "Student not found" in resp.json()["detail"]

    async def test_nonexistent_student_id_returns_404(self, client):
        """A student_id that does not exist should return 404."""
        fake_id = str(ObjectId())
        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": fake_id,
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )
        assert resp.status_code == 404

    async def test_nonexistent_student_slug_returns_404(self, client):
        """A student_slug that does not exist should return 404."""
        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_slug": "nonexistent-slug",
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )
        assert resp.status_code == 404

    # ----- Successful calls -----

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_chat_with_student_id_success(self, mock_chat, client, test_student_id):
        """A valid chat request with student_id should return the AI reply."""
        mock_chat.return_value = "Here is some advice for Alice's math learning."

        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": [
                    {"role": "user", "content": "How can I help Alice with math?"},
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["reply"] == "Here is some advice for Alice's math learning."
        mock_chat.assert_called_once()

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_chat_with_student_slug_success(self, mock_chat, client, test_student_id):
        """A valid chat request using student_slug should also work."""
        mock_chat.return_value = "Great question about Alice!"

        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_slug": "alice-smith",
                "messages": [
                    {"role": "user", "content": "Tell me about Alice's progress"},
                ],
            },
        )

        assert resp.status_code == 200
        assert resp.json()["reply"] == "Great question about Alice!"
        mock_chat.assert_called_once()

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_chat_includes_student_context(self, mock_chat, client, test_student_id):
        """The system context passed to the AI should include student name and grade."""
        mock_chat.return_value = "Sure, here's some advice."

        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": [{"role": "user", "content": "Help"}],
            },
        )

        assert resp.status_code == 200

        # Inspect the system_context argument
        call_kwargs = mock_chat.call_args.kwargs
        system_context = call_kwargs.get("system_context", "")
        assert "Alice Smith" in system_context
        assert "Year 3" in system_context

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_chat_passes_messages_to_service(self, mock_chat, client, test_student_id):
        """The messages array should be forwarded to the AI service as-is."""
        mock_chat.return_value = "Reply"
        messages = [
            {"role": "user", "content": "First message"},
            {"role": "assistant", "content": "AI response"},
            {"role": "user", "content": "Follow-up"},
        ]

        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": messages,
            },
        )

        assert resp.status_code == 200
        call_kwargs = mock_chat.call_args.kwargs
        assert call_kwargs["messages"] == messages

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_chat_student_id_takes_precedence_over_slug(
        self, mock_chat, client, test_student_id
    ):
        """When both student_id and student_slug are provided, student_id should be used first."""
        mock_chat.return_value = "Reply for Alice"

        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "student_slug": "alice-smith",
                "messages": [{"role": "user", "content": "Hi"}],
            },
        )

        assert resp.status_code == 200
        call_kwargs = mock_chat.call_args.kwargs
        assert "Alice Smith" in call_kwargs.get("system_context", "")

    # ----- Error handling -----

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_ai_service_failure_raises_error(self, mock_chat, client, test_student_id):
        """An unexpected error in the AI service should propagate as an unhandled exception.

        The chat endpoint does not wrap the ai_service call in try/except,
        so a RuntimeError will propagate through the ASGI stack. We verify
        that the endpoint does not silently swallow the error.
        """
        mock_chat.side_effect = RuntimeError("Model overloaded")

        with pytest.raises(RuntimeError, match="Model overloaded"):
            await client.post(
                self.ENDPOINT,
                json={
                    "student_id": str(test_student_id),
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

    @patch(
        "app.routes.ai_routes.ai_service.chat_with_ai",
        new_callable=AsyncMock,
    )
    async def test_ai_service_http_exception_propagates(
        self, mock_chat, client, test_student_id
    ):
        """HTTPExceptions raised by the AI service should propagate as error responses."""
        from fastapi import HTTPException

        mock_chat.side_effect = HTTPException(
            status_code=429, detail="Rate limit exceeded"
        )

        resp = await client.post(
            self.ENDPOINT,
            json={
                "student_id": str(test_student_id),
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert resp.status_code == 429
        assert "Rate limit" in resp.json()["detail"]
