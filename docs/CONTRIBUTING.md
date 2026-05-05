# Contributing to Apollo Email Finder

Thank you for your interest in contributing! This guide will help you get started with development and PR submissions.

## Development Environment Setup

### Prerequisites
- **Node.js**: Recommended v18+
- **Google Chrome**: For running and testing the extension.
- **Playwright**: For E2E testing.

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

### Loading the Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the root directory of this project.

## Available Scripts

<!-- AUTO-GENERATED -->
| Command | Description |
|---------|-------------|
| `npm test` | Run E2E tests using Playwright. |
<!-- AUTO-GENERATED -->

## Testing Procedures
- **Running Tests**: Use `npm test` to run the Playwright test suite.
- **Writing Tests**: New tests should be added to the `tests/` directory. Use existing tests as a template.
- **Manual Verification**: Test the sidebar UI by opening Apollo.io and ensuring the extension loads correctly.

## Code Style Enforcement
- Use consistent indentation (4 spaces for JS/CSS/HTML).
- Follow camelCase naming conventions for variables and functions in JavaScript.
- Maintain existing file structure and documentation patterns.

## PR Submission Checklist
- [ ] Code follows the project's style guidelines.
- [ ] Tests pass locally (`npm test`).
- [ ] New features include relevant documentation updates.
- [ ] Commits are descriptive and follow a logical structure.
