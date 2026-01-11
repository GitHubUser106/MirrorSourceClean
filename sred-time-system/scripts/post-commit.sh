#!/bin/bash
#
# SR&ED Post-Commit Hook
# Automatically logs time entries when SR&ED-tagged commits are made.
#
# Installation:
#   cp post-commit.sh .git/hooks/post-commit
#   chmod +x .git/hooks/post-commit
#
# Or configure globally via ~/.claude/hooks.json (Claude Code)
#
# What it does:
#   1. Detects SR&ED commits (exp:, fail:, pivot:, succeed:, obs:, test:, stop:)
#   2. Calculates time delta from previous SR&ED commit
#   3. Appends entry to docs/sred/TIME_LOG.md
#

SRED_TAGS="exp:|fail:|pivot:|succeed:|obs:|test:|stop:"
TIME_LOG="docs/sred/TIME_LOG.md"
MAX_GAP_HOURS=4
MAX_GAP_CREDIT=1.0

# Get the latest commit message
COMMIT_MSG=$(git log -1 --pretty=%s)
COMMIT_HASH=$(git log -1 --pretty=%h)
COMMIT_TIME=$(git log -1 --pretty=%aI)

# Check if this is an SR&ED commit
if ! echo "$COMMIT_MSG" | grep -qiE "^($SRED_TAGS)"; then
    exit 0
fi

# Extract the tag
TAG=$(echo "$COMMIT_MSG" | grep -oiE "^($SRED_TAGS)" | head -1 | tr '[:upper:]' '[:lower:]')

# Get previous SR&ED commit timestamp
PREV_TIME=$(git log --pretty=%aI --all | head -20 | while read ts; do
    prev_msg=$(git log -1 --pretty=%s "$ts" 2>/dev/null || echo "")
    if echo "$prev_msg" | grep -qiE "^($SRED_TAGS)"; then
        echo "$ts"
        break
    fi
done)

# Calculate gap hours
if [ -n "$PREV_TIME" ]; then
    PREV_EPOCH=$(date -d "$PREV_TIME" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$PREV_TIME" +%s 2>/dev/null)
    CURR_EPOCH=$(date -d "$COMMIT_TIME" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$COMMIT_TIME" +%s 2>/dev/null)
    
    if [ -n "$PREV_EPOCH" ] && [ -n "$CURR_EPOCH" ]; then
        GAP_SECONDS=$((CURR_EPOCH - PREV_EPOCH))
        GAP_HOURS=$(echo "scale=2; $GAP_SECONDS / 3600" | bc)
        
        # Apply gap protection
        if (( $(echo "$GAP_HOURS > $MAX_GAP_HOURS" | bc -l) )); then
            CREDITED_HOURS=$MAX_GAP_CREDIT
        else
            CREDITED_HOURS=$GAP_HOURS
        fi
    else
        CREDITED_HOURS="0.00"
    fi
else
    CREDITED_HOURS="0.00"
fi

# Extract hypothesis ID if present
HYPOTHESIS=$(echo "$COMMIT_MSG" | grep -oE "EXP-[0-9]+" | head -1)
[ -z "$HYPOTHESIS" ] && HYPOTHESIS="N/A"

# Create TIME_LOG.md if doesn't exist
mkdir -p "$(dirname "$TIME_LOG")"
if [ ! -f "$TIME_LOG" ]; then
    cat > "$TIME_LOG" << 'EOF'
# SR&ED Time Log

**Method:** Human wall-clock deltas based on developer actions (git commits)

| Timestamp | Tag | Hypothesis | Hours | Commit | Message |
|-----------|-----|------------|-------|--------|---------|
EOF
fi

# Append entry
FORMATTED_TIME=$(date -d "$COMMIT_TIME" "+%Y-%m-%d %H:%M" 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S%z" "$COMMIT_TIME" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$COMMIT_TIME")
SHORT_MSG=$(echo "$COMMIT_MSG" | cut -c1-50)

echo "| $FORMATTED_TIME | \`$TAG\` | $HYPOTHESIS | $CREDITED_HOURS | \`$COMMIT_HASH\` | $SHORT_MSG |" >> "$TIME_LOG"

echo "📊 SR&ED logged: ${TAG} +${CREDITED_HOURS}h [$HYPOTHESIS]"
