# Get Started

## Installation

You can use `workspace-helper` directly with `bun`, `npx` or install it globally.

### Using Bun (Recommended)

```bash
bun x workspace-helper
```

### Using npm/npx

```bash
npx workspace-helper
```

### Global Installation

```bash
npm install -g workspace-helper
# or
bun add -g workspace-helper
```

Then run:

```bash
wh
```

## Usage

When you run the tool, you will be presented with an interactive menu:

```
What would you like to do?
❯ Add or update package
  Remove package
  Sync package versions
  Find and resolve version conflicts
  List all packages
  Install packages (run package manager)
```

### features

- **Add or update package**: Select a package and a version, and choose which workspaces should have this package updated or added.
- **Remove package**: Select a package to remove from selected workspaces.
- **Sync package versions**: Choose a package and a target version to align all workspaces to that version.
- **Find and resolve version conflicts**: Scans your monorepo for conflicting versions of the same dependency and helps you resolve them.
- **List all packages**: Shows a summary of all dependencies in your workspaces.
- **Install packages**: Runs your project's package manager (npm, pnpm, yarn, bun) in all workspaces.
