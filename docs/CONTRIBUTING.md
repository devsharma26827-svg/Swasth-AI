# Contributing to SwasthAI

Thank you for your interest in contributing to **SwasthAI**! We welcome contributions from developers, researchers, designers, and students.

---

## Development Workflow

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/your-username/swasthai.git
   cd swasthai
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Create Branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
4. **Make Changes & Test**:
   ```bash
   npm run lint
   npm test
   ```
5. **Commit & Push**:
   ```bash
   git commit -m "feat(screening): add new audio validation rule"
   git push origin feature/my-new-feature
   ```
6. **Open Pull Request**: Submit a PR to the `main` branch with a clear description of changes.

---

## Code Style & Guidelines

- **TypeScript**: Strict type definitions required for all API request/response objects in `src/types.ts`.
- **Linting**: Ensure `npm run lint` (`tsc --noEmit`) passes with zero errors.
- **Testing**: Maintain 100% pass rate on test suites (`npm test`).
- **Disclaimers**: Preserve medical non-diagnostic disclaimers on screening outputs.
