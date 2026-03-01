# Learning Resources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow parents to capture learning resources (books, apps, websites) during evidence upload, detect them via AI from images, and display them per subject area in student reports.

**Architecture:** Extend the existing evidence upload flow with a `learning_resources` array field on `student_evidence` documents. AI detection piggybacks on the existing description generation call. Reports aggregate and deduplicate resources per subject area, with manual editing support.

**Tech Stack:** FastAPI + Pydantic (backend schemas), Motor/MongoDB (storage), Google Gemini AI (detection), React + Chakra UI (frontend)

---

### Task 1: Backend Schemas — Evidence & Report Models

**Files:**
- Modify: `backend/app/models/schemas/evidence.py` (lines 1-16)
- Modify: `backend/app/models/schemas/report.py` (lines 27-38, 76-77)

**Step 1: Add LearningResource model and update evidence schemas**

In `backend/app/models/schemas/evidence.py`, add a `LearningResource` model and update both `EvidenceCreate` and `EvidenceUpdate`:

```python
from typing import Optional, List
from pydantic import BaseModel

class LearningResource(BaseModel):
    name: str
    type: Optional[str] = None
    details: Optional[str] = None

class EvidenceUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    learning_area_codes: Optional[List[str]]
    learning_outcome_codes: Optional[List[str]]
    learning_resources: Optional[List[LearningResource]] = None

class EvidenceCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    learning_outcome_codes: List[str]
    learning_area_codes: Optional[List[str]] = None
    location: Optional[str] = None
    student_grade: Optional[str] = None
    learning_resources: Optional[List[LearningResource]] = None
```

**Step 2: Add resource fields to LearningAreaSummary and UpdateLearningAreaSummaryRequest**

In `backend/app/models/schemas/report.py`:

Add to `LearningAreaSummary` (after line 37, before `last_updated`):
```python
    learning_resources: List[str] = []
    user_edited_resources: Optional[List[str]] = None
```

Update `UpdateLearningAreaSummaryRequest` (line 76-77) to accept optional resources:
```python
class UpdateLearningAreaSummaryRequest(BaseModel):
    user_edited_summary: Optional[str] = None
    user_edited_resources: Optional[List[str]] = None
```

**Step 3: Commit**

```bash
git add backend/app/models/schemas/evidence.py backend/app/models/schemas/report.py
git commit -m "feat: add learning resources to evidence and report schemas"
```

---

### Task 2: Backend — Accept & Store Learning Resources on Evidence Upload

**Files:**
- Modify: `backend/app/routes/learning_outcome_routes.py` (lines 239-250, 357-376)

**Step 1: Add `learning_resources` form field to endpoint signature**

At `learning_outcome_routes.py` line 248, add after `student_grade`:
```python
    learning_resources: Optional[str] = Form(None),
```

**Step 2: Parse the JSON and add to evidence document**

After the existing form field parsing (around line 270), add parsing logic:
```python
    # Parse learning resources JSON
    parsed_resources = []
    if learning_resources:
        try:
            import json
            raw = json.loads(learning_resources)
            if isinstance(raw, list):
                for r in raw:
                    if isinstance(r, dict) and r.get("name"):
                        parsed_resources.append({
                            "name": r["name"].strip(),
                            "type": r.get("type", "").strip() if r.get("type") else None,
                            "details": r.get("details", "").strip() if r.get("details") else None
                        })
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse learning_resources JSON: {e}")
```

**Step 3: Add `learning_resources` to the evidence document**

In the `evidence_doc` dict (line 357-376), add after `"deleted": False`:
```python
                "learning_resources": parsed_resources if parsed_resources else []
```

**Step 4: Commit**

```bash
git add backend/app/routes/learning_outcome_routes.py
git commit -m "feat: accept and store learning resources on evidence upload"
```

---

### Task 3: Backend — AI Detection of Learning Resources

**Files:**
- Modify: `backend/app/services/ai_service.py` (lines 126-138 — prompt, lines 143-146 — response handling)
- Modify: `backend/app/routes/ai_routes.py` (lines 104-124 — return statement)

**Step 1: Update the description generation prompt in `ai_service.py`**

Replace the prompt at lines 126-138 of `generate_description_from_images()` with a JSON-structured prompt:

```python
            prompt = f"""You are a parent creating a short learning journal entry for your child. Look at the images and context provided.

        <Context Information> {context_description} </Context Information>

        Respond with a JSON object containing:
        1. "description": A short description (max 500 characters) of what the child is doing. Draw connections between images if multiple. If it relates to learning outcomes, explain how. Use a warm, reflective tone. Avoid emotive language. Only describe what is shown.
        2. "learning_resources": An array of learning resources visible in the images (book titles, app names, website names, worksheet titles, educational games, etc.). Each item should have "name" (required) and "type" (optional - one of: Book, App, Website, Worksheet, Video, Game, or other). If no resources are visible, return an empty array.

        IMPORTANT: Return ONLY valid JSON, no markdown backticks, no preamble. Example:
        {{"description": "Your description here", "learning_resources": [{{"name": "Reading Eggs", "type": "App"}}]}}"""
```

**Step 2: Update the response parsing in `generate_description_from_images()`**

After the Gemini API call (around line 145), replace the simple text return with JSON parsing:

```python
            response_text = response.text.strip()
            # Try to parse as JSON for structured response
            try:
                import json
                # Remove markdown backticks if present
                cleaned = response_text
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()

                parsed = json.loads(cleaned)
                return {
                    "description": parsed.get("description", response_text),
                    "learning_resources": parsed.get("learning_resources", [])
                }
            except (json.JSONDecodeError, AttributeError):
                # Fallback: treat entire response as description, no resources
                logger.warning("AI response was not valid JSON, falling back to plain text")
                return {
                    "description": response_text,
                    "learning_resources": []
                }
```

Note: The function currently returns a plain string. This changes it to return a dict. All callers must be updated.

**Step 3: Update `ai_routes.py` to handle the new return format**

In `ai_routes.py` at lines 104-124, the endpoint calls `generate_description_from_images()` and expects a string. Update to handle the dict:

```python
        result = await ai_service.generate_description_from_images(
            images=image_data_list,
            context_description=context_description
        )

        # Handle both dict (new format) and string (fallback) returns
        if isinstance(result, dict):
            generated_text = result.get("description", "")
            learning_resources = result.get("learning_resources", [])
        else:
            generated_text = result
            learning_resources = []
```

Update the return statement (around line 124) to include resources:
```python
        return {
            "description": generated_text,
            "title": generated_title,
            "learning_resources": learning_resources
        }
```

**Step 4: Verify the backend starts without errors**

Run: `cd backend && python -c "from app.main import app; print('OK')"`

**Step 5: Commit**

```bash
git add backend/app/services/ai_service.py backend/app/routes/ai_routes.py
git commit -m "feat: extend AI description to detect learning resources from images"
```

---

### Task 4: Frontend — Upload UI Learning Resources in Step 4

**Files:**
- Modify: `frontend/src/pages/evidence/AIEvidenceUploadPage.jsx` (lines 69-83 state, 708-729 transition, 749-776 step 4 render, 356-389 submit)

**Step 1: Add learning resources state**

Near the other `useState` declarations (around line 69-83), add:
```javascript
const [learningResources, setLearningResources] = useState([])
const [newResourceName, setNewResourceName] = useState('')
const [newResourceType, setNewResourceType] = useState('')
const [newResourceDetails, setNewResourceDetails] = useState('')
const [showAddResource, setShowAddResource] = useState(false)
```

**Step 2: Pre-populate from AI response in Step 3→4 transition**

In the Step 3→4 transition handler (around lines 715-722), after setting the title, add:
```javascript
              // Pre-populate learning resources from AI
              if (descriptionResult?.learning_resources?.length > 0) {
                setLearningResources(descriptionResult.learning_resources.map(r => ({
                  name: r.name,
                  type: r.type || '',
                  details: r.details || ''
                })))
              }
```

**Step 3: Add Learning Resources UI to `renderStep4()`**

In the `renderStep4()` function (lines 749-776), add after the Description `<FormControl>` block (after line 768) and before the `<HStack>` with buttons:

```jsx
    {/* Learning Resources */}
    <FormControl>
      <FormLabel>
        Learning Resources
        <Tooltip label="Books, apps, websites, or other materials used in this activity" placement="top">
          <Box as="span" ml={1} color="gray.400" cursor="help">
            <Info size={14} style={{ display: 'inline' }} />
          </Box>
        </Tooltip>
      </FormLabel>

      {/* Resource chips */}
      {learningResources.length > 0 && (
        <Wrap spacing={2} mb={3}>
          {learningResources.map((resource, index) => (
            <WrapItem key={index}>
              <Tag size="md" colorScheme="blue" borderRadius="full">
                <TagLabel>{resource.name}{resource.type ? ` (${resource.type})` : ''}</TagLabel>
                <TagCloseButton onClick={() => {
                  setLearningResources(prev => prev.filter((_, i) => i !== index))
                }} />
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      )}

      {/* Add resource form */}
      {showAddResource ? (
        <VStack spacing={2} align="stretch" p={3} bg="gray.50" borderRadius="md">
          <Input
            size="sm"
            placeholder="Resource name (e.g. Reading Eggs)"
            value={newResourceName}
            onChange={(e) => setNewResourceName(e.target.value)}
          />
          <HStack spacing={2}>
            <Input
              size="sm"
              placeholder="Type (e.g. Book, App, Website)"
              value={newResourceType}
              onChange={(e) => setNewResourceType(e.target.value)}
              flex={1}
            />
            <Input
              size="sm"
              placeholder="URL or note (optional)"
              value={newResourceDetails}
              onChange={(e) => setNewResourceDetails(e.target.value)}
              flex={1}
            />
          </HStack>
          <HStack spacing={2}>
            <Button
              size="sm"
              colorScheme="blue"
              isDisabled={!newResourceName.trim()}
              onClick={() => {
                setLearningResources(prev => [...prev, {
                  name: newResourceName.trim(),
                  type: newResourceType.trim() || null,
                  details: newResourceDetails.trim() || null
                }])
                setNewResourceName('')
                setNewResourceType('')
                setNewResourceDetails('')
                setShowAddResource(false)
              }}
            >
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              setShowAddResource(false)
              setNewResourceName('')
              setNewResourceType('')
              setNewResourceDetails('')
            }}>
              Cancel
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setShowAddResource(true)}>
          Add Resource
        </Button>
      )}
    </FormControl>
```

Note: Ensure these Chakra components are imported at the top of the file: `Tag, TagLabel, TagCloseButton, Wrap, WrapItem, Tooltip`. Also ensure `Plus` and `Info` icons from lucide-react are imported. Check existing imports first — some may already be there.

**Step 4: Send resources in submission**

In `handleFinalSubmit()` (around line 380-389), add before the `uploadEvidenceMultiOutcome` call:
```javascript
      if (learningResources.length > 0) {
        formData.append('learning_resources', JSON.stringify(learningResources))
      }
```

**Step 5: Verify the frontend compiles**

Run: `cd frontend && npm run build`

**Step 6: Commit**

```bash
git add frontend/src/pages/evidence/AIEvidenceUploadPage.jsx
git commit -m "feat: add learning resources UI to evidence upload wizard"
```

---

### Task 5: Backend — Aggregate Resources in Report Generation

**Files:**
- Modify: `backend/app/services/report_service.py` (lines 476-698 — `_generate_learning_area_summary`)

**Step 1: Collect and deduplicate resources from evidence**

In `_generate_learning_area_summary()`, after the evidence query runs (after line 520 where `all_evidence` is populated), add resource aggregation:

```python
        # Aggregate learning resources from evidence
        resource_names_seen = set()
        aggregated_resources = []
        for ev in all_evidence:
            for resource in ev.get("learning_resources", []):
                name = resource.get("name", "").strip()
                if name and name.lower() not in resource_names_seen:
                    resource_names_seen.add(name.lower())
                    aggregated_resources.append(name)
```

**Step 2: Add resources to the LearningAreaSummary return**

In the `return LearningAreaSummary(...)` block (lines 689-698), add:
```python
        learning_resources=aggregated_resources,
```

**Step 3: Commit**

```bash
git add backend/app/services/report_service.py
git commit -m "feat: aggregate learning resources per subject in report generation"
```

---

### Task 6: Backend — Support Resource Editing in Reports

**Files:**
- Modify: `backend/app/services/report_service.py` (lines 400-430 — `update_learning_area_summary`)

**Step 1: Handle `user_edited_resources` in the update method**

In `update_learning_area_summary()`, at line 426 where `user_edited_summary` is set, add resource handling:

```python
                if update_request.user_edited_summary is not None:
                    summary["user_edited_summary"] = update_request.user_edited_summary
                    summary["is_edited"] = True
                if update_request.user_edited_resources is not None:
                    summary["user_edited_resources"] = update_request.user_edited_resources
                summary["last_updated"] = datetime.now(timezone.utc)
                updated = True
```

This replaces the existing lines 426-429. The `is_edited` flag is only set when the summary text is edited (not for resource edits alone), keeping existing behavior intact.

**Step 2: Commit**

```bash
git add backend/app/services/report_service.py
git commit -m "feat: support editing learning resources directly in reports"
```

---

### Task 7: Frontend — Display & Edit Resources in Report Card

**Files:**
- Modify: `frontend/src/components/reports/LearningAreaSummaryCard.jsx` (lines 179-198 — expandable details section)

**Step 1: Add resource state and editing logic**

Add state near the top of the component (with other useState calls):
```javascript
const [isEditingResources, setIsEditingResources] = useState(false)
const [editedResources, setEditedResources] = useState([])
const [newResource, setNewResource] = useState('')
```

Add a save handler:
```javascript
const handleSaveResources = async () => {
  try {
    await updateLearningAreaSummary(studentId, reportId, summary.learning_area_code, {
      user_edited_resources: editedResources
    })
    setIsEditingResources(false)
    // Trigger parent refresh if available
    if (onUpdate) onUpdate()
  } catch (err) {
    console.error('Failed to save resources:', err)
  }
}
```

Note: Check what props the component receives — `studentId`, `reportId`, and `onUpdate` may need to be passed from `ReportViewPage.jsx`. Also ensure `updateLearningAreaSummary` is imported from `../../services/api`.

**Step 2: Add Learning Resources display section**

In the component render, add a "Learning Resources" section. Place it after the summary text section and before the expandable `<Collapse>` details (around line 179):

```jsx
    {/* Learning Resources */}
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" fontWeight="medium" color="gray.600">Learning Resources</Text>
        {!isEditingResources && (
          <IconButton
            icon={<Edit size={14} />}
            size="xs"
            variant="ghost"
            onClick={() => {
              const current = summary.user_edited_resources || summary.learning_resources || []
              setEditedResources([...current])
              setIsEditingResources(true)
            }}
            aria-label="Edit resources"
          />
        )}
      </HStack>

      {isEditingResources ? (
        <VStack spacing={2} align="stretch" p={3} bg="gray.50" borderRadius="md">
          <Wrap spacing={2}>
            {editedResources.map((name, i) => (
              <WrapItem key={i}>
                <Tag size="sm" colorScheme="blue" borderRadius="full">
                  <TagLabel>{name}</TagLabel>
                  <TagCloseButton onClick={() => setEditedResources(prev => prev.filter((_, idx) => idx !== i))} />
                </Tag>
              </WrapItem>
            ))}
          </Wrap>
          <HStack>
            <Input
              size="sm"
              placeholder="Add a resource name"
              value={newResource}
              onChange={(e) => setNewResource(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newResource.trim()) {
                  setEditedResources(prev => [...prev, newResource.trim()])
                  setNewResource('')
                }
              }}
            />
            <Button size="sm" isDisabled={!newResource.trim()} onClick={() => {
              setEditedResources(prev => [...prev, newResource.trim()])
              setNewResource('')
            }}>Add</Button>
          </HStack>
          <HStack spacing={2}>
            <Button size="sm" colorScheme="blue" onClick={handleSaveResources}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditingResources(false)}>Cancel</Button>
          </HStack>
        </VStack>
      ) : (
        <Text fontSize="sm" color={
          (summary.user_edited_resources || summary.learning_resources || []).length > 0 ? "gray.700" : "gray.400"
        }>
          {(summary.user_edited_resources || summary.learning_resources || []).length > 0
            ? (summary.user_edited_resources || summary.learning_resources).join(', ')
            : 'No learning resources recorded'}
        </Text>
      )}
    </Box>
```

Ensure these Chakra imports exist: `Tag, TagLabel, TagCloseButton, Wrap, WrapItem, Input`. Ensure `Edit` icon from lucide-react is imported. Check existing imports — most are likely already there.

**Step 3: Verify the frontend compiles**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/components/reports/LearningAreaSummaryCard.jsx
git commit -m "feat: display and edit learning resources in report summary cards"
```

---

### Task 8: Frontend — Include Resources in Print/Export

**Files:**
- Modify: `frontend/src/components/reports/exportUtils.js` (lines 260-280 — learning area rendering)

**Step 1: Add resources to printable HTML**

In `generatePrintableHTML()`, inside the learning area summary map (around line 262), add after the summary text `</div>` (after line 262) and before the evidence gallery section:

```javascript
      ${(() => {
        const resources = summary.user_edited_resources || summary.learning_resources || []
        return `
          <div style="margin: 10px 0; font-size: 0.9em;">
            <strong>Learning Resources:</strong>
            <span style="color: ${resources.length > 0 ? '#333' : '#999'}">
              ${resources.length > 0 ? resources.join(', ') : 'No learning resources recorded'}
            </span>
          </div>
        `
      })()}
```

**Step 2: Verify the frontend compiles**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/exportUtils.js
git commit -m "feat: include learning resources in report print/export"
```

---

### Task 9: Integration Check & Final Commit

**Step 1: Verify backend starts cleanly**

Run: `cd backend && python -c "from app.main import app; print('OK')"`

**Step 2: Verify frontend builds cleanly**

Run: `cd frontend && npm run build`

**Step 3: Check for any lint issues**

Run: `cd frontend && npm run lint`

**Step 4: Final integration commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint and integration issues for learning resources feature"
```

---

## Task Dependency Order

```
Task 1 (schemas) → Task 2 (backend upload) → Task 3 (AI detection) → Task 4 (frontend upload UI)
Task 1 (schemas) → Task 5 (report aggregation) → Task 6 (report editing) → Task 7 (report display) → Task 8 (print/export)
Task 8 + Task 4 → Task 9 (integration check)
```

Tasks 2-4 (upload path) and Tasks 5-8 (report path) can be done in parallel after Task 1, but within each path they are sequential.
