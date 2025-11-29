#!/bin/bash
# Injects npmAuthToken into .yarnrc.yml for CI environments (Vercel, GitHub Actions)
# This script modifies .yarnrc.yml in place to add auth tokens for GitHub Packages

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN is not set, skipping auth injection"
  exit 0
fi

echo "Injecting npmAuthToken into .yarnrc.yml..."

# Use awk to add npmAuthToken after each npmAlwaysAuth line (portable across macOS/Linux)
awk '{
  print
  if (/npmAlwaysAuth: true/) {
    print "    npmAuthToken: \"${GITHUB_TOKEN}\""
  }
}' .yarnrc.yml > .yarnrc.yml.tmp && mv .yarnrc.yml.tmp .yarnrc.yml

echo "Auth token injected successfully"
cat .yarnrc.yml
