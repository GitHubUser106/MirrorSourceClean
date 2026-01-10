#!/usr/bin/env python3
"""
SR&ED Evidence Logger
=====================
Automates capture of R&D tax credit evidence during development.

Usage:
    python sred_logger.py scan                    # Scan git for tagged commits
    python sred_logger.py status                  # Show SR&ED status
    python sred_logger.py report                  # Generate monthly evidence report
    python sred_logger.py export --year 2026      # Export Boast.ai package

Legacy (formal experiments):
    python sred_logger.py new "Description of uncertainty"
    python sred_logger.py log EXP-001 "What we tried" "What happened"
    python sred_logger.py close EXP-001           # Close experiment

Commit Tag Convention (Lightweight):
    spike: R&D work (uncertainty, investigation, might fail)

Legacy Tags:
    exp: Start new experiment investigation
    fail: Document a failure (BILLABLE - this is investigation)
    pivot: Change approach based on learning
    succeed: Approach worked
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Find .sred directory (walk up from current dir)
def find_sred_root() -> Path:
    current = Path.cwd()
    while current != current.parent:
        sred_path = current / ".sred"
        if sred_path.exists():
            return current
        current = current.parent
    raise FileNotFoundError("No .sred directory found. Run from within a project with SR&ED pipeline.")

ROOT = find_sred_root()
SRED_DIR = ROOT / ".sred"
CONFIG_FILE = SRED_DIR / "config.json"

def load_config() -> dict:
    with open(CONFIG_FILE) as f:
        return json.load(f)

def get_next_experiment_id(config: dict) -> str:
    """Generate next experiment ID (EXP-001, EXP-002, etc.)"""
    prefix = config["sred_config"]["experiment_prefix"]
    active = SRED_DIR / "active_experiments"
    completed = SRED_DIR / "completed_experiments"
    
    existing = []
    for folder in [active, completed]:
        if folder.exists():
            for f in folder.glob(f"{prefix}-*.md"):
                match = re.search(rf"{prefix}-(\d+)", f.stem)
                if match:
                    existing.append(int(match.group(1)))
    
    next_num = max(existing, default=0) + 1
    return f"{prefix}-{next_num:03d}"

def create_experiment(uncertainty: str) -> str:
    """Create new experiment from template"""
    config = load_config()
    exp_id = get_next_experiment_id(config)
    
    template_path = SRED_DIR / "templates" / "experiment_manifest.md"
    with open(template_path) as f:
        template = f.read()
    
    # Replace placeholders
    now = datetime.now()
    content = template.replace("{{EXP_ID}}", exp_id)
    content = content.replace("{{PROJECT_NAME}}", config["project"]["name"])
    content = content.replace("{{START_DATE}}", now.strftime("%Y-%m-%d"))
    content = content.replace("{{END_DATE}}", "")
    
    # Insert the uncertainty question
    content = content.replace(
        "<!-- Be specific. \"Can we...\" or \"Is it possible to...\" -->",
        f"<!-- Be specific. \"Can we...\" or \"Is it possible to...\" -->\n{uncertainty}"
    )
    
    # Mark as active
    content = content.replace(
        "> **STATUS:** 🔬 ACTIVE | ⏸️ PAUSED | ✅ CLOSED | ❌ ABANDONED",
        "> **STATUS:** 🔬 ACTIVE"
    )
    
    # Save to active experiments
    output_path = SRED_DIR / "active_experiments" / f"{exp_id}.md"
    with open(output_path, "w") as f:
        f.write(content)
    
    print(f"✅ Created experiment: {exp_id}")
    print(f"   File: {output_path}")
    print(f"\n📝 Next steps:")
    print(f"   1. Open {output_path}")
    print(f"   2. Complete the UNCERTAINTY GATE section")
    print(f"   3. Start coding with tagged commits:")
    print(f"      git commit -m \"exp:{exp_id} Starting investigation into...\"")
    print(f"      git commit -m \"fail:{exp_id} Approach X failed because...\"")
    
    return exp_id

def log_entry(exp_id: str, what_tried: str, what_happened: str, entry_type: str = "manual"):
    """Add manual log entry to experiment"""
    exp_path = SRED_DIR / "active_experiments" / f"{exp_id}.md"
    if not exp_path.exists():
        print(f"❌ Experiment {exp_id} not found in active experiments")
        return
    
    with open(exp_path) as f:
        content = f.read()
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    new_row = f"| {now} | {entry_type} | manual | {what_tried} | {what_happened} |"
    
    # Find the table and add row
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("| Date | Type |"):
            # Find the empty row template and replace it, or add after header
            for j in range(i + 2, len(lines)):
                if lines[j].strip() == "| | | | | |":
                    lines[j] = new_row + "\n| | | | | |"
                    break
            else:
                # No empty row found, insert after separator
                lines.insert(i + 2, new_row)
            break
    
    with open(exp_path, "w") as f:
        f.write("\n".join(lines))
    
    print(f"✅ Logged to {exp_id}: {what_tried[:50]}...")

def scan_git_commits(since_days: int = 30):
    """Scan git log for SR&ED tagged commits and update experiments"""
    config = load_config()
    tags = config["sred_config"]["commit_tags"]
    
    since_date = (datetime.now() - timedelta(days=since_days)).strftime("%Y-%m-%d")
    
    try:
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--pretty=format:%H|%ad|%s", "--date=short"],
            capture_output=True, text=True, cwd=ROOT
        )
        
        if result.returncode != 0:
            print(f"❌ Git error: {result.stderr}")
            return
        
        commits = result.stdout.strip().split("\n")
        tagged_commits = []
        
        for commit in commits:
            if not commit:
                continue
            parts = commit.split("|", 2)
            if len(parts) < 3:
                continue
            
            commit_hash, date, message = parts
            
            # Check for SR&ED tags
            for tag_name, tag_prefix in tags.items():
                if message.lower().startswith(tag_prefix):
                    # Extract experiment ID if present
                    exp_match = re.search(r"(EXP-\d+)", message, re.IGNORECASE)
                    exp_id = exp_match.group(1).upper() if exp_match else "UNLINKED"
                    
                    tagged_commits.append({
                        "hash": commit_hash[:8],
                        "date": date,
                        "tag": tag_name,
                        "exp_id": exp_id,
                        "message": message
                    })
        
        if not tagged_commits:
            print(f"No SR&ED tagged commits found in last {since_days} days")
            return
        
        print(f"\n📊 Found {len(tagged_commits)} SR&ED commits:\n")
        
        # Group by experiment
        by_exp = {}
        for c in tagged_commits:
            exp_id = c["exp_id"]
            if exp_id not in by_exp:
                by_exp[exp_id] = []
            by_exp[exp_id].append(c)
        
        for exp_id, commits in by_exp.items():
            print(f"\n🔬 {exp_id}:")
            for c in commits:
                icon = {"failure": "❌", "pivot": "🔄", "success": "✅", "experiment_start": "🚀"}.get(c["tag"], "📝")
                print(f"   {icon} [{c['date']}] {c['message'][:60]}...")
                
                # Auto-update experiment manifest if it exists
                if exp_id != "UNLINKED":
                    update_experiment_from_commit(exp_id, c)
        
    except FileNotFoundError:
        print("❌ Git not found or not a git repository")

def update_experiment_from_commit(exp_id: str, commit: dict):
    """Update experiment manifest with commit data"""
    exp_path = SRED_DIR / "active_experiments" / f"{exp_id}.md"
    if not exp_path.exists():
        return
    
    with open(exp_path) as f:
        content = f.read()
    
    # Add to investigation log table
    tag_display = {"failure": "FAIL", "pivot": "PIVOT", "success": "SUCCESS", "experiment_start": "START"}.get(commit["tag"], commit["tag"].upper())
    
    # Clean message (remove tag prefix)
    clean_msg = re.sub(r"^(exp|fail|pivot|succeed|hyp|conclude):\s*", "", commit["message"], flags=re.IGNORECASE)
    clean_msg = re.sub(r"EXP-\d+\s*", "", clean_msg, flags=re.IGNORECASE).strip()
    
    new_row = f"| {commit['date']} | {tag_display} | {commit['hash']} | {clean_msg[:40]} | (from git) |"
    
    # Insert row into table
    if new_row not in content:  # Avoid duplicates
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if line.startswith("| Date | Type |"):
                lines.insert(i + 2, new_row)
                break
        
        with open(exp_path, "w") as f:
            f.write("\n".join(lines))

def close_experiment(exp_id: str):
    """Move experiment to completed and prompt for conclusion"""
    active_path = SRED_DIR / "active_experiments" / f"{exp_id}.md"
    completed_path = SRED_DIR / "completed_experiments" / f"{exp_id}.md"
    
    if not active_path.exists():
        print(f"❌ Experiment {exp_id} not found in active experiments")
        return
    
    with open(active_path) as f:
        content = f.read()
    
    # Update status
    content = content.replace(
        "> **STATUS:** 🔬 ACTIVE",
        "> **STATUS:** ✅ CLOSED"
    )
    
    # Add end date
    now = datetime.now().strftime("%Y-%m-%d")
    content = content.replace("{{END_DATE}}", now)
    
    # Move file
    with open(completed_path, "w") as f:
        f.write(content)
    active_path.unlink()
    
    print(f"✅ Closed experiment: {exp_id}")
    print(f"   Moved to: {completed_path}")
    print(f"\n📝 IMPORTANT: Open the file and complete:")
    print(f"   - Section 3: CONCLUSION DIFF")
    print(f"   - Estimated hours and billable SR&ED hours")

def generate_monthly_report(month: Optional[str] = None):
    """Generate monthly evidence report for SR&ED claim"""
    config = load_config()
    
    if month is None:
        month = datetime.now().strftime("%Y-%m")
    
    report_path = SRED_DIR / "evidence" / "monthly" / f"{month}_evidence.md"
    
    # Collect all experiments (active and completed)
    experiments = []
    for folder in ["active_experiments", "completed_experiments"]:
        folder_path = SRED_DIR / folder
        if folder_path.exists():
            for f in folder_path.glob("*.md"):
                with open(f) as file:
                    experiments.append({
                        "id": f.stem,
                        "status": "active" if folder == "active_experiments" else "completed",
                        "content": file.read()
                    })
    
    # Generate report
    report = f"""# SR&ED Monthly Evidence Report
## {config['project']['name']} — {month}

**Company:** {config['project']['company']}
**Field of Science:** {config['project']['field_of_science']} ({config['project']['field_of_science_name']})
**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

## Summary

| Metric | Count |
|--------|-------|
| Active Experiments | {sum(1 for e in experiments if e['status'] == 'active')} |
| Completed Experiments | {sum(1 for e in experiments if e['status'] == 'completed')} |
| Total Experiments | {len(experiments)} |

---

## Experiments This Period

"""
    
    for exp in experiments:
        report += f"### {exp['id']} ({exp['status'].upper()})\n\n"
        
        # Extract uncertainty section
        uncertainty_match = re.search(
            r"### What technological uncertainty.*?\n(.*?)(?=###|\n## )",
            exp["content"],
            re.DOTALL
        )
        if uncertainty_match:
            uncertainty = uncertainty_match.group(1).strip()
            uncertainty = re.sub(r"<!--.*?-->", "", uncertainty).strip()
            if uncertainty:
                report += f"**Uncertainty:** {uncertainty[:200]}...\n\n"
        
        report += "---\n\n"
    
    # Git activity summary
    report += """## Git Activity (Tagged Commits)

"""
    try:
        result = subprocess.run(
            ["git", "log", f"--since={month}-01", f"--until={month}-31", 
             "--pretty=format:%ad|%s", "--date=short", "--grep=exp:", "--grep=fail:", 
             "--grep=pivot:", "--grep=succeed:", "--all-match"],
            capture_output=True, text=True, cwd=ROOT
        )
        if result.stdout:
            report += "| Date | Commit Message |\n|------|----------------|\n"
            for line in result.stdout.strip().split("\n")[:20]:  # Limit to 20
                if "|" in line:
                    date, msg = line.split("|", 1)
                    report += f"| {date} | {msg[:60]} |\n"
    except:
        report += "*Git log unavailable*\n"
    
    report += f"""

---

## T661 Readiness Checklist

- [ ] All uncertainties documented with "why not standard practice"
- [ ] Investigation logs show systematic approach (try → fail → pivot)
- [ ] Conclusions state what was learned (even from failures)
- [ ] Hours estimated for each experiment
- [ ] External references (docs, SO, issues) linked

---

*Generated by SR&ED Pipeline v1.0*
"""
    
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        f.write(report)
    
    print(f"✅ Generated report: {report_path}")

def show_status():
    """Show current SR&ED status"""
    config = load_config()
    
    print(f"\n🔬 SR&ED Pipeline Status — {config['project']['name']}")
    print("=" * 50)
    
    # Active experiments
    active_path = SRED_DIR / "active_experiments"
    if active_path.exists():
        active = list(active_path.glob("*.md"))
        print(f"\n📂 Active Experiments: {len(active)}")
        for f in active:
            print(f"   • {f.stem}")
    
    # Completed experiments
    completed_path = SRED_DIR / "completed_experiments"
    if completed_path.exists():
        completed = list(completed_path.glob("*.md"))
        print(f"\n✅ Completed Experiments: {len(completed)}")
        for f in completed:
            print(f"   • {f.stem}")
    
    # Recent tagged commits
    print(f"\n📊 Recent SR&ED Commits (last 7 days):")
    try:
        since_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        result = subprocess.run(
            ["git", "log", f"--since={since_date}", "--pretty=format:%s", "--oneline"],
            capture_output=True, text=True, cwd=ROOT
        )
        tags = ["exp:", "fail:", "pivot:", "succeed:"]
        tagged = [l for l in result.stdout.split("\n") if any(t in l.lower() for t in tags)]
        if tagged:
            for msg in tagged[:5]:
                print(f"   • {msg[:60]}")
        else:
            print("   (none)")
    except:
        print("   (git unavailable)")
    
    print("\n" + "=" * 50)

def generate_refine_prompt(content_type: str, draft: str) -> str:
    """Generate ChatGPT prompt for audit-ready refinement"""
    
    prompts = {
        "uncertainty": f'''You are an SR&ED technical writer. Refine this technological uncertainty statement to be:
- Specific and measurable
- Clear about WHY standard practice doesn't solve it
- Phrased as a genuine question (not a statement of intent)
- Free of business/market language (focus on TECHNICAL unknowns)

My draft:
{draft}

Return:
1. Refined uncertainty statement (2-3 sentences)
2. One sentence explaining why this isn't standard practice
3. Suggested hypothesis to test''',

        "failure": f'''You are an SR&ED technical writer. Convert this failure into audit-ready documentation.

What happened:
{draft}

Make it:
- Technically precise (specific error codes, metrics, behaviors)
- Clear about the causal chain (why it failed, not just that it failed)
- Educational (what was learned from this failure)

Return:
1. Technical failure summary (2-3 sentences)
2. Root cause analysis (1-2 sentences)  
3. Knowledge gained (1 sentence starting with "This demonstrated that...")
4. Git commit message (<72 chars, prefixed with fail:EXP-XXX)''',

        "conclusion": f'''You are an SR&ED technical writer. Convert this into T661-compliant advancement language.

My draft:
{draft}

Requirements:
- Emphasize NEW TECHNICAL KNOWLEDGE (even from failures)
- Use phrases like "It was determined that...", "The investigation revealed..."
- Avoid business outcomes (cost savings, time saved)
- Be specific about what is now KNOWN that wasn't known before

Return:
1. Technological advancement statement (3-4 sentences)
2. One sentence summary suitable for T661 Line 246
3. List of specific technical learnings (bullet points)''',

        "commit": f'''Refine this git commit message for SR&ED audit compliance:

Draft: {draft}

Requirements:
- Under 72 characters
- Starts with appropriate tag (fail:, pivot:, succeed:, exp:)
- Technically specific
- Past tense

Return just the commit message, nothing else.'''
    }
    
    return prompts.get(content_type, prompts["uncertainty"])

def refine_for_audit(content_type: str, draft: str):
    """Output a ChatGPT prompt for audit-ready refinement"""
    prompt = generate_refine_prompt(content_type, draft)
    
    print("\n" + "="*60)
    print("📋 COPY THIS TO ChatGPT:")
    print("="*60 + "\n")
    print(prompt)
    print("\n" + "="*60)
    print("\n💡 After ChatGPT refines it, use the output in your experiment.\n")

def archive_chat_log(exp_id: str, ai_source: str, content: str):
    """Archive AI chat logs for audit trail"""
    archive_dir = SRED_DIR / "evidence" / "chat_logs"
    archive_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{exp_id}_{ai_source}_{timestamp}.md"
    
    with open(archive_dir / filename, "w") as f:
        f.write(f"# {ai_source.upper()} Chat Log\n")
        f.write(f"**Experiment:** {exp_id}\n")
        f.write(f"**Timestamp:** {datetime.now().isoformat()}\n")
        f.write(f"**Source:** {ai_source}\n\n")
        f.write("---\n\n")
        f.write(content)
    
    print(f"✅ Archived {ai_source} chat to: {archive_dir / filename}")

def export_boast_package(year: str):
    """Generate Boast.ai-ready export package for SR&ED filing"""
    config = load_config()

    export_dir = SRED_DIR / "exports" / f"SRED-{year}-package"
    export_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n📦 Generating Boast.ai package for {year}...")

    # 1. Extract spike commits
    spike_commits = []
    sred_tags = ["spike:", "exp:", "fail:", "pivot:", "succeed:"]

    try:
        result = subprocess.run(
            ["git", "log", f"--since={year}-01-01", f"--until={year}-12-31",
             "--pretty=format:%H|%ad|%an|%s", "--date=short"],
            capture_output=True, text=True, cwd=ROOT
        )

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 3)
            if len(parts) < 4:
                continue

            commit_hash, date, author, message = parts
            msg_lower = message.lower()

            for tag in sred_tags:
                if msg_lower.startswith(tag):
                    spike_commits.append({
                        "hash": commit_hash[:8],
                        "date": date,
                        "author": author,
                        "message": message,
                        "tag": tag.rstrip(":")
                    })
                    break
    except Exception as e:
        print(f"   ⚠️ Git scan error: {e}")

    # Write spike commits
    with open(export_dir / "spike_commits.md", "w") as f:
        f.write(f"# SR&ED Tagged Commits - {year}\n\n")
        f.write(f"**Project:** {config['project']['name']}\n")
        f.write(f"**Company:** {config['project']['company']}\n")
        f.write(f"**Generated:** {datetime.now().isoformat()}\n\n")
        f.write("---\n\n")
        f.write("| Date | Tag | Commit | Message |\n")
        f.write("|------|-----|--------|--------|\n")
        for c in spike_commits:
            f.write(f"| {c['date']} | {c['tag']} | {c['hash']} | {c['message'][:60]} |\n")
        f.write(f"\n**Total SR&ED Commits:** {len(spike_commits)}\n")

    print(f"   ✅ spike_commits.md ({len(spike_commits)} commits)")

    # 2. Copy lab notebook
    lab_notebook = SRED_DIR / "LAB_NOTEBOOK.md"
    if lab_notebook.exists():
        import shutil
        shutil.copy(lab_notebook, export_dir / "lab_notebook.md")
        print(f"   ✅ lab_notebook.md")
    else:
        print(f"   ⚠️ LAB_NOTEBOOK.md not found")

    # 3. Generate time summary (estimate based on commits)
    time_summary = {
        "year": year,
        "project": config["project"]["name"],
        "company": config["project"]["company"],
        "total_sred_commits": len(spike_commits),
        "commits_by_tag": {},
        "commits_by_month": {},
        "technological_domains": config.get("technological_domains", [])
    }

    for c in spike_commits:
        # By tag
        tag = c["tag"]
        time_summary["commits_by_tag"][tag] = time_summary["commits_by_tag"].get(tag, 0) + 1
        # By month
        month = c["date"][:7]
        time_summary["commits_by_month"][month] = time_summary["commits_by_month"].get(month, 0) + 1

    with open(export_dir / "time_summary.json", "w") as f:
        json.dump(time_summary, f, indent=2)
    print(f"   ✅ time_summary.json")

    # 4. Technological domains
    with open(export_dir / "technological_domains.md", "w") as f:
        f.write(f"# Technological Domains - {config['project']['name']}\n\n")
        f.write(f"**Field of Science:** {config['project'].get('field_of_science', 'N/A')} ")
        f.write(f"({config['project'].get('field_of_science_name', 'N/A')})\n\n")
        f.write("---\n\n")
        for td in config.get("technological_domains", []):
            f.write(f"## {td['id']}: {td['name']}\n\n")
            f.write(f"{td['description']}\n\n")
    print(f"   ✅ technological_domains.md")

    # 5. Full commit log (CSV)
    try:
        result = subprocess.run(
            ["git", "log", f"--since={year}-01-01", f"--until={year}-12-31",
             "--pretty=format:%H,%ad,%an,%s", "--date=short"],
            capture_output=True, text=True, cwd=ROOT
        )
        with open(export_dir / "commit_log.csv", "w") as f:
            f.write("hash,date,author,message\n")
            f.write(result.stdout)
        print(f"   ✅ commit_log.csv")
    except:
        pass

    print(f"\n📁 Package location: {export_dir}")
    print(f"\n💡 Send this folder to Boast.ai for SR&ED filing.")

def print_usage():
    print(__doc__)

def main():
    if len(sys.argv) < 2:
        print_usage()
        return
    
    command = sys.argv[1].lower()
    
    if command == "refine":
        if len(sys.argv) < 4:
            print("Usage: sred_logger.py refine [uncertainty|failure|conclusion|commit] \"draft text\"")
            return
        refine_for_audit(sys.argv[2], " ".join(sys.argv[3:]))
    
    elif command == "archive":
        if len(sys.argv) < 5:
            print("Usage: sred_logger.py archive EXP-001 [claude|gemini|chatgpt] \"chat content\"")
            return
        archive_chat_log(sys.argv[2], sys.argv[3], " ".join(sys.argv[4:]))
    
    elif command == "new":
        if len(sys.argv) < 3:
            print("Usage: sred_logger.py new \"Description of technological uncertainty\"")
            return
        create_experiment(" ".join(sys.argv[2:]))
    
    elif command == "log":
        if len(sys.argv) < 5:
            print("Usage: sred_logger.py log EXP-001 \"What we tried\" \"What happened\"")
            return
        log_entry(sys.argv[2], sys.argv[3], sys.argv[4])
    
    elif command == "scan":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        scan_git_commits(days)
    
    elif command == "close":
        if len(sys.argv) < 3:
            print("Usage: sred_logger.py close EXP-001")
            return
        close_experiment(sys.argv[2])
    
    elif command == "report":
        month = sys.argv[2] if len(sys.argv) > 2 else None
        generate_monthly_report(month)
    
    elif command == "status":
        show_status()

    elif command == "export":
        # Parse --year argument
        year = None
        for i, arg in enumerate(sys.argv):
            if arg == "--year" and i + 1 < len(sys.argv):
                year = sys.argv[i + 1]
                break
        if not year:
            year = datetime.now().strftime("%Y")
            print(f"No --year specified, using current year: {year}")
        export_boast_package(year)

    else:
        print_usage()

if __name__ == "__main__":
    main()
