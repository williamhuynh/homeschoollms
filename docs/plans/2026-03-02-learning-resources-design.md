# Learning Resources in Evidence Upload — Design

## Overview

Add the ability to capture learning resources (books, apps, websites, worksheets, etc.) during evidence upload and display them per subject area in student reports.

## Data Model

### Evidence Document (student_evidence collection)

New field on existing `student_evidence` documents:

```
learning_resources: [
  {
    name: "Reading Eggs",        // required
    type: "App",                 // optional - free text, e.g. Book, App, Website, Worksheet, Video, Game
    details: "https://..."       // optional - URL or short note
  }
]
```

**Schema changes:**
- New Pydantic model `LearningResource`: `name: str`, `type: Optional[str]`, `details: Optional[str]`
- Add `learning_resources: Optional[List[LearningResource]]` to `EvidenceCreate` and `EvidenceUpdate`

### Report Document (LearningAreaSummary)

Two new fields on `LearningAreaSummary`:

- `learning_resources: List[str]` — deduplicated resource names aggregated from evidence
- `user_edited_resources: Optional[List[str]]` — manual edits made directly in the report
- Display priority: `user_edited_resources` > `learning_resources`

## AI Detection

Extend the existing `generate_description_from_images()` call in `ai_service.py`:

- Modify the prompt to also ask Gemini to identify visible learning resources in images (book covers, app screens, worksheet headers, etc.)
- Change response format from plain text to JSON: `{ description, title, learning_resources: [{ name, type }] }`
- Parse structured response; fall back to description-only if parsing fails
- The `/api/v1/ai/generate-description` endpoint returns resources alongside description and title

## Evidence Upload UI (Step 4 of Wizard)

In `AIEvidenceUploadPage.jsx` Step 4, add a "Learning Resources" section below title/description:

- Label with tooltip: "Books, apps, websites, or other materials used in this activity"
- AI-detected resources appear as pre-filled editable chips/tags
- Each chip shows resource name with X to remove
- "Add Resource" button expands an inline row: name (required), type (optional placeholder "e.g. Book, App, Website"), details (optional placeholder "URL or note")
- Multiple resources supported
- Entire section is optional — no validation if empty
- State: `learningResources` array via `useState`, pre-populated from AI response
- Sent as JSON string in FormData during submission

## Backend Evidence Upload

Changes to `learning_outcome_routes.py` (POST `/api/evidence/{studentId}`):

- Accept new optional form field: `learning_resources` (JSON string)
- Parse JSON into list of resource objects
- Store array on the `student_evidence` document

Evidence retrieval includes `learning_resources` in the response — no special handling.

Frontend `api.js` `uploadEvidenceMultiOutcome()` appends `learning_resources` as JSON string to FormData.

## Report Generation

In `report_service.py` `_generate_learning_area_summary`:

- Collect `learning_resources` from all evidence documents for the subject area
- Flatten and deduplicate by name (case-insensitive)
- Store deduplicated list on `LearningAreaSummary.learning_resources`

## Report Display

In `LearningAreaSummaryCard.jsx`:

- "Learning Resources" section always visible under each subject area (even when empty)
- If resources exist: comma-separated list
- If empty: placeholder text like "No learning resources recorded"
- Editable — user can add/remove resources directly in the report
- Edited resources saved to `user_edited_resources` on the report document (not linked back to evidence)
- Display priority: `user_edited_resources` > `learning_resources`

In `exportUtils.js`:

- Include "Learning Resources" line in printable HTML output per subject area

## Key Files to Modify

| Layer | File | Change |
|-------|------|--------|
| Schema | `backend/app/models/schemas/evidence.py` | Add `LearningResource` model, update `EvidenceCreate`/`EvidenceUpdate` |
| Schema | `backend/app/models/schemas/report.py` | Add resource fields to `LearningAreaSummary` |
| AI | `backend/app/services/ai_service.py` | Extend description prompt, parse JSON response |
| AI Route | `backend/app/routes/ai_routes.py` | Return resources from description endpoint |
| Upload Route | `backend/app/routes/learning_outcome_routes.py` | Accept and store `learning_resources` |
| Upload Service | `backend/app/services/learning_outcome_service.py` | Include resources in evidence retrieval |
| Report Service | `backend/app/services/report_service.py` | Aggregate resources during generation |
| Frontend API | `frontend/src/services/api.js` | Send resources in upload FormData |
| Upload UI | `frontend/src/pages/evidence/AIEvidenceUploadPage.jsx` | Add resources UI in Step 4 |
| Report UI | `frontend/src/components/reports/LearningAreaSummaryCard.jsx` | Display and edit resources |
| Export | `frontend/src/components/reports/exportUtils.js` | Include resources in print output |

## Decisions Made

- **Storage:** Embedded on evidence documents (no new collections)
- **AI:** Extend existing description generation (no extra API call)
- **Resource fields:** Flexible free-text (name required, type/details optional with placeholder hints)
- **Report display:** Always visible, editable, with `user_edited_resources` override
- **Entry method:** Free-text only (no autocomplete library — can add later)
- **Deduplication:** Case-insensitive name matching during report generation
