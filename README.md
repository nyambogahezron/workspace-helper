# Workspace Helper

A tool for managing package versions across monorepo workspaces.

[![npm version](https://img.shields.io/npm/v/workspace-helper.svg?label=version&message=1.0.3)](https://npmjs.org/package/workspace-helper)
[![License](https://img.shields.io/npm/l/workspace-helper.svg)](https://github.com/nyambogahezron/workspace-helper/blob/main/LICENSE)

[![Documentation](https://img.shields.io/badge/documentation-online-blue)](https://workspace-helper-sepia.vercel.app/)
- [Documentation](https://workspace-helper-sepia.vercel.app/)
- [Installation](#installation)
- [Usage](#usage)
- [Interactive Commands](#interactive-commands)

# Installation

You can run `workspace-helper` directly using `bun` or `npx`, or install it globally.

```sh
# Using bun (recommended)
bun x workspace-helper

# Using npx
npx workspace-helper
```

To install globally:

```sh
bun add -g workspace-helper
# or
npm install -g workspace-helper
```

Then run:

```sh
wh
```

# Usage

`workspace-helper` is primarily an interactive CLI tool. When you run it, you will be presented with a menu to select the operation you want to perform.

```sh
wh
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
