#!/bin/bash
# SR&ED Pipeline Installation Script
# Run from the .sred directory: ./install.sh

set -e

echo "🔬 Installing SR&ED Pipeline..."

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "❌ Not a git repository. Please run from within a git repo."
    exit 1
fi

# Get repo root
REPO_ROOT=$(git rev-parse --show-toplevel)
SRED_DIR="$REPO_ROOT/.sred"

# Create directories if they don't exist
mkdir -p "$SRED_DIR/active_experiments"
mkdir -p "$SRED_DIR/completed_experiments"
mkdir -p "$SRED_DIR/evidence/monthly"
mkdir -p "$SRED_DIR/templates"

# Install git hook
if [ -d "$REPO_ROOT/.git/hooks" ]; then
    echo "📎 Installing git post-commit hook..."
    cp "$SRED_DIR/hooks/post-commit" "$REPO_ROOT/.git/hooks/post-commit"
    chmod +x "$REPO_ROOT/.git/hooks/post-commit"
    echo "   ✅ Hook installed"
fi

# Make logger executable
chmod +x "$SRED_DIR/sred_logger.py"

# Add alias suggestion
echo ""
echo "✅ SR&ED Pipeline installed!"
echo ""
echo "📝 Suggested shell aliases (add to ~/.bashrc or ~/.zshrc):"
echo ""
echo '   alias sred="python .sred/sred_logger.py"'
echo '   alias sred-new="python .sred/sred_logger.py new"'
echo '   alias sred-scan="python .sred/sred_logger.py scan"'
echo '   alias sred-status="python .sred/sred_logger.py status"'
echo ""
echo "🚀 Quick start:"
echo "   1. Edit .sred/config.json with your project details"
echo "   2. Run: python .sred/sred_logger.py new \"Your uncertainty question\""
echo "   3. Start coding with tagged commits: git commit -m \"fail:EXP-001 ...\""
echo ""
