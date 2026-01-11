#!/usr/bin/env python3
"""
SR&ED Time Logger - Calculates eligible developer hours from git commits.

Measures human wall-clock time between experiment commits, not AI processing time.
Uses git commit timestamps as source of truth with gap protection.

Gap Rule: Any gap > 4 hours is capped at 1.0 hour to prevent overclaims
(sleep, weekends, breaks).

Usage:
    python sred_logger.py [--repo PATH] [--output PATH] [--since DATE] [--until DATE]
    
Examples:
    python sred_logger.py                          # Current repo, all time
    python sred_logger.py --since 2025-01-01       # From Jan 1, 2025
    python sred_logger.py --output TIME_LOG.md     # Write to specific file
"""

import subprocess
import re
import json
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import argparse


# SR&ED commit tags that indicate billable work
SRED_TAGS = ['exp:', 'obs:', 'test:', 'fail:', 'succeed:', 'pivot:', 'stop:']

# Gap protection: cap any gap > this to MAX_GAP_CREDIT
MAX_GAP_HOURS = 4.0
MAX_GAP_CREDIT = 1.0


@dataclass
class Commit:
    """A single git commit with SR&ED metadata."""
    hash: str
    timestamp: datetime
    message: str
    tag: str  # The SR&ED tag (exp:, fail:, etc.)
    
    @property
    def is_session_start(self) -> bool:
        return self.tag in ['exp:']
    
    @property
    def is_session_end(self) -> bool:
        return self.tag in ['succeed:', 'pivot:', 'stop:', 'fail:']


@dataclass
class Session:
    """A single SR&ED work session."""
    session_id: str
    start_commit: Commit
    end_commit: Optional[Commit] = None
    intermediate_commits: list = field(default_factory=list)
    
    @property
    def is_complete(self) -> bool:
        return self.end_commit is not None
    
    @property
    def hypothesis_id(self) -> str:
        """Extract hypothesis ID from commit message (e.g., EXP-001)."""
        match = re.search(r'EXP-\d+', self.start_commit.message)
        return match.group(0) if match else "UNKNOWN"
    
    @property
    def objective(self) -> str:
        """Extract objective from start commit message."""
        msg = self.start_commit.message
        # Remove the tag prefix
        for tag in SRED_TAGS:
            if msg.lower().startswith(tag):
                msg = msg[len(tag):].strip()
                break
        return msg[:100] + "..." if len(msg) > 100 else msg
    
    def calculate_duration(self) -> float:
        """
        Calculate session duration with gap protection.
        Returns hours as float.
        """
        if not self.is_complete:
            return 0.0
        
        all_commits = [self.start_commit] + self.intermediate_commits + [self.end_commit]
        all_commits.sort(key=lambda c: c.timestamp)
        
        total_hours = 0.0
        for i in range(1, len(all_commits)):
            gap = (all_commits[i].timestamp - all_commits[i-1].timestamp).total_seconds() / 3600
            
            # Gap protection rule
            if gap > MAX_GAP_HOURS:
                credited = MAX_GAP_CREDIT
            else:
                credited = gap
            
            total_hours += credited
        
        return round(total_hours, 2)
    
    @property
    def outcome(self) -> str:
        """Return the outcome tag of the session."""
        if not self.end_commit:
            return "IN_PROGRESS"
        return self.end_commit.tag.rstrip(':').upper()
    
    @property
    def tags_involved(self) -> list:
        """All unique tags used in this session."""
        tags = {self.start_commit.tag}
        for c in self.intermediate_commits:
            tags.add(c.tag)
        if self.end_commit:
            tags.add(self.end_commit.tag)
        return sorted(list(tags))


def get_sred_commits(repo_path: str = ".", since: str = None, until: str = None) -> list[Commit]:
    """
    Extract SR&ED-tagged commits from git history.
    
    Returns commits sorted by timestamp (oldest first).
    """
    cmd = ['git', '-C', repo_path, 'log', '--pretty=format:%H|%aI|%s', '--all']
    
    if since:
        cmd.append(f'--since={since}')
    if until:
        cmd.append(f'--until={until}')
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error reading git log: {e}")
        return []
    
    commits = []
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        
        parts = line.split('|', 2)
        if len(parts) != 3:
            continue
        
        commit_hash, timestamp_str, message = parts
        
        # Check if this is an SR&ED commit
        tag = None
        msg_lower = message.lower()
        for t in SRED_TAGS:
            if msg_lower.startswith(t):
                tag = t
                break
        
        if tag:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            commits.append(Commit(
                hash=commit_hash[:8],
                timestamp=timestamp,
                message=message,
                tag=tag
            ))
    
    # Sort oldest first
    commits.sort(key=lambda c: c.timestamp)
    return commits


def build_sessions(commits: list[Commit]) -> list[Session]:
    """
    Group commits into sessions.
    
    A session starts with exp: and ends with succeed:, pivot:, stop:, or fail:.
    Commits between are intermediate observations/tests.
    """
    sessions = []
    current_session = None
    session_counter = 1
    
    for commit in commits:
        if commit.is_session_start:
            # Start new session
            if current_session and not current_session.is_complete:
                # Previous session never closed - mark as incomplete
                sessions.append(current_session)
            
            current_session = Session(
                session_id=f"SESSION-{session_counter:03d}",
                start_commit=commit
            )
            session_counter += 1
            
        elif commit.is_session_end:
            if current_session and not current_session.is_complete:
                current_session.end_commit = commit
                sessions.append(current_session)
                current_session = None
            else:
                # Orphan end commit - create minimal session
                sessions.append(Session(
                    session_id=f"SESSION-{session_counter:03d}",
                    start_commit=commit,
                    end_commit=commit
                ))
                session_counter += 1
                
        else:
            # Intermediate commit (obs:, test:)
            if current_session:
                current_session.intermediate_commits.append(commit)
    
    # Add any unclosed session
    if current_session:
        sessions.append(current_session)
    
    return sessions


def generate_time_log(sessions: list[Session], repo_path: str = ".") -> str:
    """
    Generate auditor-friendly TIME_LOG.md content.
    """
    total_hours = sum(s.calculate_duration() for s in sessions if s.is_complete)
    complete_sessions = [s for s in sessions if s.is_complete]
    incomplete_sessions = [s for s in sessions if not s.is_complete]
    
    # Get project name from .sred-config.json if exists
    config_path = Path(repo_path) / ".sred-config.json"
    project_name = "Unknown Project"
    if config_path.exists():
        try:
            with open(config_path) as f:
                config = json.load(f)
                project_name = config.get("projectName", project_name)
        except:
            pass
    
    lines = [
        "# SR&ED Time Log",
        "",
        f"**Project:** {project_name}",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Method:** Human wall-clock deltas based on developer actions (git commits)",
        "",
        "## Summary",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Eligible Hours | **{total_hours:.2f}** |",
        f"| Complete Sessions | {len(complete_sessions)} |",
        f"| In-Progress Sessions | {len(incomplete_sessions)} |",
        "",
        "### Methodology",
        "",
        "Time is calculated from gaps between consecutive SR&ED-tagged git commits.",
        "Gap protection rule: Any gap exceeding 4 hours is capped at 1.0 hour to",
        "prevent overclaiming during breaks, sleep, or weekends.",
        "",
        "This measures the developer's investigation time—reading, thinking, planning,",
        "reviewing AI outputs, debugging, testing, and decision-making—not machine",
        "processing time.",
        "",
        "---",
        "",
        "## Session Details",
        "",
    ]
    
    for session in sessions:
        duration = session.calculate_duration()
        status = "✅ Complete" if session.is_complete else "🔄 In Progress"
        
        lines.extend([
            f"### {session.session_id}: {session.hypothesis_id}",
            "",
            f"**Status:** {status}",
            f"**Duration:** {duration:.2f} hours",
            f"**Outcome:** {session.outcome}",
            "",
            f"**Objective:** {session.objective}",
            "",
            "**Timeline:**",
            "",
            f"| Time | Action | Commit |",
            f"|------|--------|--------|",
        ])
        
        all_commits = [session.start_commit] + session.intermediate_commits
        if session.end_commit:
            all_commits.append(session.end_commit)
        all_commits.sort(key=lambda c: c.timestamp)
        
        for commit in all_commits:
            time_str = commit.timestamp.strftime('%Y-%m-%d %H:%M')
            lines.append(f"| {time_str} | `{commit.tag}` {commit.message[:50]}... | `{commit.hash}` |")
        
        lines.extend([
            "",
            "**Tags Used:** " + ", ".join(f"`{t}`" for t in session.tags_involved),
            "",
            "---",
            "",
        ])
    
    # Audit defense section
    lines.extend([
        "## Audit Notes",
        "",
        "This log demonstrates systematic investigation through the scientific method:",
        "",
        "1. **Hypotheses** were formed before coding (exp: commits)",
        "2. **Observations** were recorded during testing (obs:, test: commits)",
        "3. **Conclusions** were documented (succeed:, fail:, pivot: commits)",
        "4. **Time tracking** is contemporaneous (git timestamps)",
        "",
        "The developer designed experiments, evaluated results, and made decisions.",
        "AI tools (Claude, etc.) served as lab equipment for executing tests and",
        "generating code—the intellectual work of hypothesis formation, result",
        "evaluation, and pivot decisions remained with the developer.",
        "",
    ])
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="SR&ED Time Logger")
    parser.add_argument("--repo", default=".", help="Path to git repository")
    parser.add_argument("--output", help="Output file path (default: stdout)")
    parser.add_argument("--since", help="Include commits since date (YYYY-MM-DD)")
    parser.add_argument("--until", help="Include commits until date (YYYY-MM-DD)")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of Markdown")
    
    args = parser.parse_args()
    
    commits = get_sred_commits(args.repo, args.since, args.until)
    
    if not commits:
        print("No SR&ED commits found.")
        return
    
    sessions = build_sessions(commits)
    
    if args.json:
        output = json.dumps({
            "total_hours": sum(s.calculate_duration() for s in sessions if s.is_complete),
            "sessions": [
                {
                    "id": s.session_id,
                    "hypothesis": s.hypothesis_id,
                    "objective": s.objective,
                    "duration_hours": s.calculate_duration(),
                    "outcome": s.outcome,
                    "complete": s.is_complete,
                    "start": s.start_commit.timestamp.isoformat(),
                    "end": s.end_commit.timestamp.isoformat() if s.end_commit else None,
                }
                for s in sessions
            ]
        }, indent=2)
    else:
        output = generate_time_log(sessions, args.repo)
    
    if args.output:
        Path(args.output).write_text(output)
        print(f"Written to {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
