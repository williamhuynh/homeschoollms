API_DESCRIPTION = """
# Homeschool LMS API

## Overview
This API provides comprehensive learning management system functionality for homeschooling:

* 👤 **Users** - Authentication and user management
* 👨‍👩‍👧‍👦 **Students** - Student profiles and progress tracking
* 📚 **Subjects** - Subject management and curriculum organization
* 📝 **Content** - Educational content and resources
* 🎯 **Learning Outcomes** - Track and manage learning objectives
* 📊 **Progress** - Monitor student achievement

## Authentication
All API endpoints (except login) require Bearer token authentication.
"""

TAGS_METADATA = [
    {
        "name": "auth",
        "description": "Authentication operations - login, refresh tokens",
    },
    {
        "name": "users",
        "description": "User management operations",
    },
    {
        "name": "students",
        "description": "Student profile and enrollment management",
    },
    {
        "name": "subjects",
        "description": "Subject and curriculum management",
    },
    {
        "name": "content",
        "description": "Educational content and resources",
    },
    {
        "name": "learning-outcomes",
        "description": "Learning objectives and mastery tracking",
    },
    {
        "name": "progress",
        "description": "Student progress and achievement tracking",
    },
]