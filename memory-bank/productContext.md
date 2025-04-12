# Product Context

This file provides a high-level overview of the project and the expected product that will be created. Initially it is based upon projectBrief.md (if provided) and all other available project-related information in the working directory. This file is intended to be updated as the project evolves, and should be used to inform all other modes of the project's goals and context.
2025-04-12 17:57:00 - Initial Memory Bank creation.

## Project Goal

* Homeschool LMS is a learning management system designed for homeschooling, allowing parents to track student progress against curriculum standards.
* The system aims to provide a comprehensive solution for curriculum management, evidence collection, progress tracking, and social feed display.

## Key Features

* **Student Management**: Create, read, update, and delete student profiles
* **Parent Access Management**: Multiple parents can have different access levels to student profiles
* **Curriculum Management**: Track learning areas and outcomes based on curriculum standards
* **Evidence Collection**: Attach evidence to learning outcomes
* **Progress Tracking**: Calculate and display progress at learning area level
* **Social Feed Display**: Show student achievements and progress

## Overall Architecture

* **Backend**: FastAPI with MongoDB database
* **Frontend**: React-based web application
* **Hierarchy Structure**:
  - Stage (e.g., Stage 2 - Years 3-4)
  - Learning Areas (e.g., Mathematics)
  - Learning Outcomes (e.g., MA2-RN-01)
* **Progress Calculation**: Learning Area Progress = (Number of Learning Outcomes with evidence / Total Learning Outcomes) * 100
* **Learning Outcomes**: Binary state - Evidence exists or doesn't exist