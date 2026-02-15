# Contributing to Workspace Helper

Thank you for your interest in contributing! This project is a monorepo managed with [Bun](https://bun.sh) workspaces.

## Project Structure

This repository is organized as a monorepo:

- **`src/workspace-helper`**: The core CLI tool for aligning package versions.
- **`src/create-release`**: A helper package for release automation.

## Prerequisites

- [Bun](https://bun.sh) (latest version recommended)
- Node.js (for compatibility)

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/nyambogahezron/workspace-helper.git
    cd workspace-helper
    ```

2.  **Install dependencies:**

    This will install dependencies for all packages in the workspace.

    ```bash
    bun install
    ```

3.  **Build packages:**

    Compile TypeScript code for all packages.

    ```bash
    bun run build
    ```

## Development Workflow

### Working on the CLI (`workspace-helper`)

The source code for the main CLI tool is located in `src/workspace-helper`.

-   **Modify Code**: Edit files in `src/workspace-helper`.
-   **Build**: Run `bun run build`.
-   **Test Code**: You can run the CLI from the root using the convenience scripts:

    # Run the `wh` command
    bun run start

### Code Style

We use [Biome](https://biomejs.dev) for linting and formatting.

-   **Lint & Format**:

    ```bash
    bun run lint  # If script exists, otherwise check biome.json
    # or run manually per package
    bun x @biomejs/biome check .
    ```

### Release Process

When you are ready to submit changes:

1.  Ensure your code builds: `bun run build`.
2.  Test your changes locally.
3.  Submit a Pull Request.

## Adding a New Package

1.  Create a folder in `packages/`.
2.  Initialize a `package.json`.
3.  Add it to the workspace configuration if necessary (though `packages/*` covers it).
4.  Run `bun install`.

---

If you encounter any issues, please open an issue on GitHub. Happy coding!
