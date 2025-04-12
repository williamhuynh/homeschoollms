# Decision Log

This file records architectural and implementation decisions using a list format.
2025-04-12 17:58:00 - Initial Memory Bank creation.

## Decision: FastAPI Backend with MongoDB

* **Decision**: Use FastAPI for the backend API and MongoDB for data storage
* **Rationale**: FastAPI provides modern, fast API development with automatic documentation. MongoDB offers flexible schema design suitable for educational data that may evolve over time.
* **Implementation Details**: 
  - Backend structured with routes, services, and models layers
  - MongoDB connection handled through Database utility class
  - Pydantic models used for data validation and serialization

## Decision: Parent Access Control System

* **Decision**: Implement a flexible parent access control system with different access levels
* **Rationale**: Homeschooling often involves multiple caregivers with different responsibilities and access needs
* **Implementation Details**:
  - ParentAccess model with parent_id and access_level fields
  - Access levels defined as enum (ADMIN, EDIT, VIEW)
  - Admin parents can add/remove other parents
  - Safeguard to prevent removal of the last admin parent

## Decision: Slug-based Student Identification

* **Decision**: Use URL-friendly slugs for student identification in addition to MongoDB ObjectIDs
* **Rationale**: Provides more user-friendly URLs and easier sharing of student profiles
* **Implementation Details**:
  - Slugs generated from student names
  - Uniqueness ensured by adding numeric suffixes if needed
  - Dual lookup system (by ID or slug) in API endpoints