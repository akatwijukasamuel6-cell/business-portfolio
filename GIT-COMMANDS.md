# Useful Git Commands

Quick reference for everyday Git commands.

## The 3-command workflow (sending changes to GitHub)

```bash
git add .                 # 1. Stage your changes
git commit -m "message"   # 2. Save them locally with a note
git push origin main      # 3. Upload them to GitHub
```

## Checking the state of your project

| Command | What it does |
|---|---|
| `git status` | Shows which files changed, staged, or are new |
| `git log --oneline` | Shows commit history (one line per commit) |
| `git diff` | Shows what changed in files you haven't staged yet |
| `git diff --staged` | Shows what changed in files you've staged |
| `git remote -v` | Shows which GitHub repository your project connects to |

## Staging & committing

| Command | What it does |
|---|---|
| `git add .` | Stage all changes (new + modified files) |
| `git add filename` | Stage only one file |
| `git add public/` | Stage everything in a folder |
| `git commit -m "message"` | Save the staged changes with a description |
| `git commit -am "message"` | Stage AND commit tracked files in one step |
| `git commit --amend -m "new message"` | Rewrite the last commit message (don't use after pushing) |

## Uploading & downloading

| Command | What it does |
|---|---|
| `git push origin main` | Upload commits to GitHub (main branch) |
| `git pull origin main` | Download the latest changes from GitHub |
| `git fetch` | Check what's on GitHub without merging |

## Branches (working on separate versions)

| Command | What it does |
|---|---|
| `git branch` | List local branches |
| `git branch new-name` | Create a branch |
| `git checkout branch-name` | Switch to a branch |
| `git checkout -b new-name` | Create AND switch to a branch |
| `git merge branch-name` | Merge another branch into the current one |
| `git branch -d branch-name` | Delete a merged branch |

## Undoing mistakes

| Command | What it does |
|---|---|
| `git restore file.txt` | Discard changes in one file (back to last commit) |
| `git restore .` | Discard ALL uncommitted changes (careful!) |
| `git reset --soft HEAD~1` | Undo the last commit but keep the changes staged |
| `git reset --hard HEAD~1` | Undo the last commit AND delete its changes (dangerous) |
| `git revert <commit-id>` | Create a new commit that undoes a previous commit (safe for pushed commits) |
| `git stash` | Temporarily put changes aside so you can switch branches |
| `git stash pop` | Bring stashed changes back |

## Stashing (quickly saving work in progress)

```bash
git stash          # save current changes away
git stash list     # see your saved changes
git stash pop      # bring them back
```

## Fixing your own mistakes before they're committed

```bash
git status                 # see what's changed
git diff                   # review the changes
git add . && git commit    # stage and commit
```

## Ignoring files

Files listed in `.gitignore` are never uploaded. In this project it already protects:

```text
node_modules/          # dependencies (never commit)
.env                   # your email password (never commit!)
data/users.json        # password hashes
data/messages.json     # visitor messages
public/uploads/        # uploaded images
```

Add a line to `.gitignore`, save it, and Git will ignore that file forever.

## Tips

- Always run `git status` before committing so you know what you're sending.
- Commit often with short, clear messages (e.g., "Fix contact form bug").
- If a file was committed before you added it to `.gitignore`, remove it from tracking with:
  ```bash
  git rm --cached filename
  ```
- If you get "branch is up to date" but expect changes — run `git status` first; a clean tree means nothing changed yet.
