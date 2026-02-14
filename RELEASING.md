# Releasing

This repository uses a monorepo structure. Releasing involves updating package versions, generating changelogs, and publishing to npm.

## Release Workflow

1.  **Check for Changes**: Ensure all changes are committed and your working directory is clean.

2.  **Update Versions**:
    You can use the `version-aligner` tool to ensure dependency versions are aligned across the workspace before releasing.

    ```bash
    bun run align-versions
    ```

3.  **Build**:
    Ensure all packages build correctly.

    ```bash
    bun run build
    ```

4.  **Publish**:
    Navigate to the specific package you want to release (e.g., `packages/version-aligner`) and run the publish command.

    ```bash
    cd packages/version-aligner
    npm publish --access public
    ```

    *Note: You may need to login to npm first using `npm login`.*

## Automation (Coming Soon)

We are working on an automated release process using the `packages/create-release` tool. Once complete, you will be able to run:

```bash
bun run create-release
```

This will handle version bumping, git tagging, and publishing automatically.
