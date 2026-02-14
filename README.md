# Workspace Version Aligner

A tool for managing package versions across monorepo workspaces.

[![npm version](https://img.shields.io/npm/v/workspace-version-aligner.svg)](https://npmjs.org/package/workspace-version-aligner)
[![License](https://img.shields.io/npm/l/workspace-version-aligner.svg)](https://github.com/nyambogahezron/workspace-version-aligner/blob/main/LICENSE)

- [Installation](#installation)
- [Usage](#usage)
- [Interactive Commands](#interactive-commands)

# Installation

You can run `workspace-version-aligner` directly using `bun` or `npx`, or install it globally.

```sh
# Using bun (recommended)
bun x workspace-version-aligner

# Using npx
npx workspace-version-aligner
```

To install globally:

```sh
bun add -g workspace-version-aligner
# or
npm install -g workspace-version-aligner
```

Then run:

```sh
wva
```

# Usage

`workspace-version-aligner` is primarily an interactive CLI tool. When you run it, you will be presented with a menu to select the operation you want to perform.

```sh
wva
```

# Interactive Commands

The CLI provides the following interactive commands:

## Add or update package

Select a package and a version, and choose which workspaces should have this package updated or added.

## Remove package

Select a package to remove from selected workspaces.

## Sync package versions

Choose a package and a target version to align all workspaces to that version.

## Find and resolve version conflicts

Scans your monorepo for conflicting versions of the same dependency and helps you resolve them interactively.

## List all packages

Shows a summary of all dependencies in your workspaces.

## Install packages

Runs your project's package manager (npm, pnpm, yarn, bun) in all workspaces to ensure dependencies are installed.
