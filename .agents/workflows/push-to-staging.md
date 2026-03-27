---
description: How to safely commit and push all code changes to the staging branch in Bitbucket
---

This workflow automates the process of adding, committing, and pushing code to the staging branch.

1. Ensure we are on the staging branch and check the status
// turbo-all
```bash
git branch --show-current
git status
```

2. Stage all modified current files
```bash
git add .
```

3. Commit the changes (the user will provide a commit message when invoking this, otherwise use a generic message)
```bash
git commit -m "Update codebase on staging"
```

4. Push the changes to the remote Bitbucket staging branch
```bash
git push origin staging
```
