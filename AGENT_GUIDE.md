# 🤖 The .agent Directory: Your AI Superpowers Guide

The `.agent` directory is the core of your AI assistant's "brain" for this project. It contains specialized agents, workflows, skills, and rules that allow me to handle complex tasks autonomously and maintain high-quality code.

## 📂 Directory Structure

- **`workflows/`**: Contains slash commands (`/command`) that you can trigger directly.
- **`skills/`**: Specialized domain knowledge and procedures I use to execute tasks.
- **`rules/`**: Global and project-specific guidelines I always follow.
- **`AGENTS.md`**: A master list of the 48+ specialized sub-agents available.

---

## 🚀 Top Slash Commands (Workflows)

You can use these by typing `/` followed by the command name in our chat.

### 🛠️ Development & Testing
- **/plan**: Creates a comprehensive implementation plan before touching code.
- **/feature-dev**: Guided workflow for building new features with architectural focus.
- **/tdd**: Enforces Test-Driven Development (Red-Green-Refactor).
- **/verify**: Runs a rigorous verification loop to ensure everything works.
- **/build-fix**: Automatically analyzes and fixes build or compiler errors.

### 🔍 Code Quality & Review
- **/code-review**: Performs a deep dive into your local changes or a PR.
- **/security-review**: Scans for vulnerabilities, hardcoded secrets, and XSS/SQLi risks.
- **/refactor-clean**: Identifies and removes dead code, or simplifies complex logic.
- **/test-coverage**: Analyzes your tests and suggests where you need more coverage.

### 📝 Documentation & Knowledge
- **/docs**: Searches for library documentation via specialized neural search.
- **/update-docs**: Automatically synchronizes your README and documentation with code changes.
- **/skill-create**: Analyzes your coding patterns and creates a new "Skill" for me to remember.
- **/instinct-status**: Shows the "learned instincts" I've picked up from our working sessions.

### 💼 Management & Operations
- **/jira**: Integrates with Jira to pull tickets, update status, or add comments.
- **/prp-commit**: Drafts high-quality, conventional commit messages for you.
- **/prp-pr**: Automates the creation of a GitHub Pull Request with a full summary.
- **/save-session** / **/resume-session**: Saves our current state so we can pick up exactly where we left off later.

---

## 🧑‍💻 Specialized Agents (The "Who")

I can "delegate" tasks to these specialized personas depending on what you need:

| Agent | Expertise | Use Case |
|-------|-----------|----------|
| **planner** | Strategy | Breaking down complex requests into actionable steps. |
| **architect** | Design | Deciding on system structure, scalability, and patterns. |
| **tdd-guide** | Testing | Ensuring every feature is backed by robust tests. |
| **security-reviewer** | Safety | Finding leaks, vulnerabilities, and auth issues. |
| **performance-optimizer** | Speed | Identifying bottlenecks and optimizing code. |
| **seo-specialist** | Visibility | Ensuring your web apps follow modern SEO best practices. |
| **market-researcher** | Intelligence | Performing deep web research on competitors or markets. |

---

## 🧠 Skills & Domain Knowledge

The `skills/` folder contains "How-To" guides for me. If you ask me to do something related to these topics, I automatically load the relevant skill:

- **Frontend/Backend Patterns**: Best practices for React, Next.js, Node, etc.
- **API Design**: How to build clean, RESTful, and scalable APIs.
- **Cloud Run**: How to deploy and manage services on GCP.
- **Deep Research**: How to synthesize information from dozens of web sources.
- **Video/Media Editing**: Automating FFmpeg or generating AI media.

---

## 📏 Rules & Guidelines

The `rules/` folder contains non-negotiable instructions. For this project, I am configured to:
1. **Always Plan**: I won't dive into complex code without showing you a plan first.
2. **Prioritize Aesthetics**: For web apps, I must use premium, modern designs (Gradients, Glassmorphism, etc.).
3. **Use Semantic HTML**: Ensuring accessibility and SEO from the start.
4. **Never Hardcode Secrets**: I will always look for `.env` files or secret managers.

---

## 💡 How to Get the Most Out of It

1. **Ask for a Review**: "Can you run a /code-review on my latest changes?"
2. **Start Big Tasks with a Plan**: "I want to add a new auth system. Let's /plan it."
3. **Fix Frustrating Errors**: "I'm getting a weird build error. Can you /build-fix?"
4. **Research Anything**: "Give me a /deep-research on the best email scraping APIs for 2024."

**Want me to explain a specific agent or command in even more detail? Just ask!**
