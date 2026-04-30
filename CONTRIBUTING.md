# Contributing

Thank you for contributing to this project.
Please read the guidelines below before opening a pull request.

## Getting Started

1. **Prerequisites**: Docker and Docker Compose installed; Node.js 20 or later for local development.
2. **Clone the repository**, then copy `.env.example` to `.env` and fill in the required values.
3. **Start all services** from the project root:

   ```bash
   docker compose up --build -d
   ```

4. **Initialize the database** (first time only):

   ```bash
   cd backend
   npx prisma db push
   docker exec backend_api npm run seed
   ```

5. **Verify**: visit `http://localhost` for the main app and `http://localhost/api/health` for the backend status.

## Code Style

* **TypeScript only**: all backend and frontend code must be in TypeScript. No plain JavaScript files.
* **Immutability**: use `const` over `let`. Never use `var`.
* **Async safety**: wrap every async operation in a `try catch` block.
* **Functional patterns**: prefer functional approaches over class based designs.
* **No hyphens in prose**: documentation and comments must not contain the hyphen character; use spaces or underscores instead.
* **Lint before committing**: run `npm run lint` inside each package directory (`backend`, `main_frontend`, `admin_frontend`).

## How to Submit a Pull Request

1. Branch off `main` using a descriptive name with underscores:

   ```bash
   git checkout -b feat/your_feature_name
   ```

2. Apply your changes following the Code Style rules above.
3. Write a clear commit message:

   ```bash
   git commit -m "feat: short description of the change"
   ```

4. Push your branch and open a pull request targeting `main`.
5. Fill in the pull request description: explain what changed and why.
6. Confirm that lint checks pass and no regressions are introduced before requesting review.
