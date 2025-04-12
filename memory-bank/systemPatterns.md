# System Patterns

This file documents recurring patterns and standards used in the project.
2025-04-12 17:58:00 - Initial Memory Bank creation.

## Coding Patterns

* **Service Layer Pattern**: Business logic encapsulated in service classes with static methods
  - Example: StudentService handles all student-related operations
  - Services interact with the database and handle data transformation

* **Dependency Injection**: FastAPI's dependency injection used for authentication and user context
  - Example: `current_user: UserInDB = Depends(get_current_user)` in route definitions

* **Error Handling**: Consistent HTTP exception raising with status codes and detailed messages
  - Example: `raise HTTPException(status_code=404, detail="Student not found")`

* **Data Validation**: Pydantic models used for request/response validation
  - Example: Student, ParentAccessAdd, ParentAccessUpdate models

## Architectural Patterns

* **API Layering**:
  - Routes layer: API endpoints and request handling
  - Services layer: Business logic and database operations
  - Models layer: Data structures and validation

* **MongoDB Integration**:
  - ObjectId handling for document references
  - Conversion between Pydantic models and MongoDB documents

* **Authentication Flow**:
  - JWT-based authentication
  - User context passed through dependencies

## Testing Patterns

* To be determined as testing implementation progresses