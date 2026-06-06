# Contributing to EXT

We welcome contributions from developers who want to improve the EXT workspace. Before submitting a pull request, please read this document to understand our contribution guidelines and expectations.

## How to Contribute

1. Read the `DESIGN.md` file to understand the architecture of the application.
2. Fork the repository and create your feature branch.
3. Ensure your code passes all existing tests (`npm run test` and `cargo test`).
4. Keep pull requests focused. A pull request should do one thing and do it well.
5. Provide a clear, detailed description of your changes and why they are necessary.

## Policy on AI-Generated Contributions

Artificial Intelligence tools like Copilot, ChatGPT, and other coding assistants are valuable tools. You are welcome to use them to help write code, format documentation, or brainstorm solutions.

**However, we strictly prohibit the submission of "lazy" or fully automated agentic pull requests and issues.** 

If you use an AI tool to generate code, you take full responsibility for that code. You must understand every single line you submit. You must test it manually, ensure it fits seamlessly into the existing architecture, and verify that it does not introduce regressions.

**The following actions will result in a permanent ban from this repository:**
- Submitting pull requests generated entirely by an autonomous agent without manual verification and testing.
- Submitting code that you cannot explain or defend during the code review process.
- Spamming the issue tracker with AI-generated feature requests, bug reports, or "slop" text.
- Using LLMs to mass-generate generic comments on existing pull requests or issues to inflate contribution graphs.

We value quality, intention, and human understanding over volume. Please respect the time of the maintainers by ensuring your submissions are thoughtful and thoroughly tested.

## Bug Reports

When filing a bug report, please include:
- The operating system you are using.
- Steps to consistently reproduce the issue.
- The expected behavior versus the actual behavior.
- Any relevant application logs or terminal output.
