# Creating Releases

Propel your project forward by creating new releases with ease. The `workspace-helper` CLI provides a robust, interactive release workflow that handles versioning, changelogs, and Git operations.

## Features

-   **Interactive Workflow**: Step-by-step guidance for creating a release.
-   **Resumable Releases**: Pause simply by cancelling an operation and resume later without losing your release notes.
-   **Automated Changelog**: Generates release notes and appends them to `CHANGELOG.md`.
-   **Git Integration**: Automatically tags, commits, and pushes changes.
-   **GitHub Releases**: Uses the GitHub CLI (`gh`) to create a release on GitHub.

## Prerequisites

-   **GitHub CLI**: Ensure `gh` is installed and authenticated for GitHub Release creation.
-   **Git**: Git must be initialized in your repository.

## Usage

To start the release process, run the tool and select **"Create new release"** (or use the alias if configured).

```bash
wh
# Select "Create new release" from the menu
```

### The Release Workflow

1.  **Version Selection**: The tool suggests the next patch version based on your current `package.json` version. You can accept it or enter a custom version (semver compliant).
2.  **Drafting Notes**: Temporary files are created in `.release-temp/`:
    -   `<version>.md`: For the GitHub Release body.
    -   `<version>-changelog.md`: For the `CHANGELOG.md` entry.
    -   *Edit these files in your editor to add feature details and fixes.*
3.  **Confirmation**: The tool pauses to let you edit the notes. Confirm when ready.
4.  **Changelog Update**: You'll be asked if you want to update `CHANGELOG.md`. If yes, the content from `<version>-changelog.md` is prepended to your changelog.
5.  **Finalize**: The tool asks to proceed with git operations.
    -   Updates `package.json` version in all workspaces.
    -   Commits changes (`chore(release): v<version>`).
    -   Tags the commit (`v<version>`).
    -   Pushes commit and tag to remote.
    -   Creates a GitHub Release using the notes from `<version>.md`.

## Resuming a Release

If you interrupt the process (e.g., to check something in the code), the temporary files in `.release-temp/` are preserved.

When you run the tool again:
1.  Select **"Resume pending release"**.
2.  The tool detects the pending version and picks up where you left off.

## Listing Releases

You can also view a list of all existing tags/releases:
1.  Run the tool.
2.  Select **"List all releases"**.
