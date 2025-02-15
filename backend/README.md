# Homeschool LMS API

## Local Development

### Git Commands

Stage all changes
git add .

Commit changes
git commit -m "Your commit message"

Push to main branch
git push origin main

### Docker Commands

Build Docker image
docker build -t homeschool-lms-api ./backend

Run container
docker run -p 8000:8000 --env-file ./backend/.env homeschool-lms-api

Stop container
docker stop $(docker ps -q --filter ancestor=homeschool-lms-api)

View logs
docker logs $(docker ps -q --filter ancestor=homeschool-lms-api)