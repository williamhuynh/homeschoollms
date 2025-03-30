# Homeschool LMS

## Project Overview
This project is a learning management system designed for homeschooling, allowing parents to track student progress against curriculum standards.

## Design and Architecture

### Hierarchy Structure
- **Stage** (e.g., Stage 2 - Years 3-4)
  - **Learning Areas** (e.g., Mathematics)
    - **Learning Outcomes** (e.g., MA2-RN-01)

### Progress Tracking
- Learning Area Progress = (Number of Learning Outcomes with evidence / Total Learning Outcomes) * 100
- Learning Outcomes have binary state: Evidence exists or doesn't exist

### Key Components
1. Curriculum Management
2. Evidence Collection
3. Progress Tracking
4. Social Feed Display

### Workflows
```mermaid
graph TD
    A[Curriculum Data] --> B[Learning Areas]
    B --> C[Learning Outcomes]
    C --> D[Evidence Collection]
    D --> E[Progress Calculation]
    E --> F[Social Feed Display]
```

### UI Layout
```mermaid
graph TD
    A[Learning Area Card] --> B[Progress: 75%]
    A --> C[Learning Outcomes]
    C --> D[MA2-RN-01]
    C --> E[MA2-AR-02]
    D --> F[Thumbnail/Placeholder]
    D --> G[Last Updated: 2025-03-30]
    E --> H[Thumbnail/Placeholder]
    E --> I[Last Updated: -]
```

## Future Updates
This document will be updated as the project evolves to reflect the latest design decisions and architectural changes.
