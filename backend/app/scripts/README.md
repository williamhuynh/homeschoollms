# NSW Curriculum Import Script

This directory contains scripts for importing NSW curriculum data into the MongoDB database.

## Import NSW Curriculum

The `import_nsw_curriculum.py` script imports NSW curriculum data from a JSON file into the MongoDB database. The script creates subjects and learning outcomes based on the data in the JSON file.

### Prerequisites

- MongoDB database connection (set in the `.env` file)
- Python 3.7+
- Required Python packages (installed via `pip install -r requirements.txt` in the backend directory)

### JSON Data Format

The script expects a JSON file named `nsw_curriculum.json` in the backend directory with the following structure:

```json
[
  {
    "stage": "Early Stage 1",
    "subjects": [
      {
        "name": "English",
        "code": "ENG",
        "description": "Learning area for English",
        "outcomes": [
          {
            "code": "ENE-OLC-01",
            "name": "Oral language and communication",
            "description": "communicates effectively by using interpersonal conventions and language with familiar peers and adults",
            "grade_level": "Early Stage 1"
          },
          // More outcomes...
        ]
      },
      // More subjects...
    ]
  },
  // More stages...
]
```

### Running the Script

To run the script, navigate to the backend directory and run:

```bash
python -m app.scripts.import_nsw_curriculum
```

### What the Script Does

1. Loads the NSW curriculum data from the JSON file
2. For each stage and subject:
   - Creates a new subject if it doesn't exist, or updates an existing one
   - Adds the current stage to the subject's grade_levels if not already present
3. For each learning outcome:
   - Creates a new learning outcome if it doesn't exist, or updates an existing one
   - Links the learning outcome to the appropriate subject

### Adding More Stages

To add more stages (Stage 1, Stage 2, Stage 3, etc.), simply add them to the JSON file following the same structure. The script will handle multiple stages and ensure that subjects are properly linked to all relevant grade levels.

### Error Handling

The script includes error handling for:
- Missing JSON file
- Invalid JSON format
- Database connection issues

If any errors occur, they will be printed to the console.
