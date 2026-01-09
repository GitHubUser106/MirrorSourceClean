#!/usr/bin/env python3
"""
SR&ED Audit Trail Generator
============================
Creates a comprehensive audit package that would satisfy CRA review.

This script generates:
1. Executive summary of all R&D activity
2. Chronological timeline of all experiments
3. Evidence index linking claims to documentation
4. Git history analysis showing systematic investigation
5. T661 pre-filled narratives

Usage:
    python audit_trail.py generate          # Full audit package
    python audit_trail.py timeline          # Just the timeline
    python audit_trail.py t661              # T661 narrative fragments
    python audit_trail.py validate          # Check for documentation gaps
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

def find_sred_root() -> Path:
    current = Path.cwd()
    while current != current.parent:
        sred_path = current / ".sred"
        if sred_path.exists():
            return current
        current = current.parent
    raise FileNotFoundError("No .sred directory found.")

ROOT = find_sred_root()
SRED_DIR = ROOT / ".sred"
CONFIG_FILE = SRED_DIR / "config.json"
AUDIT_DIR = SRED_DIR / "audit_packages"

def load_config() -> dict:
    with open(CONFIG_FILE) as f:
        return json.load(f)

def load_all_experiments() -> List[Dict]:
    """Load all experiments (active and completed)"""
    experiments = []
    
    for folder in ["active_experiments", "completed_experiments"]:
        folder_path = SRED_DIR / folder
        if not folder_path.exists():
            continue
            
        for f in sorted(folder_path.glob("*.md")):
            if "SAMPLE" in f.stem:
                continue  # Skip sample files
                
            with open(f) as file:
                content = file.read()
                
            exp = {
                "id": f.stem,
                "status": "active" if folder == "active_experiments" else "completed",
                "file": str(f),
                "content": content
            }
            
            # Extract key fields
            exp["uncertainty"] = extract_section(content, "What technological uncertainty")
            exp["hypothesis"] = extract_section(content, "What is your hypothesis")
            exp["advancement"] = extract_section(content, "What advancement was achieved")
            exp["hours"] = extract_field(content, "Billable SR&ED Hours")
            exp["start_date"] = extract_field(content, "Start Date")
            exp["end_date"] = extract_field(content, "End Date")
            
            # Count investigation entries
            exp["investigation_count"] = content.count("| 20")  # Rough count of log entries
            
            experiments.append(exp)
    
    return experiments

def extract_section(content: str, header: str) -> str:
    """Extract content under a markdown header"""
    pattern = rf"### {re.escape(header)}.*?\n(.*?)(?=###|\n## |\Z)"
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1).strip()
        # Remove HTML comments
        text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL).strip()
        return text if text else "(Not documented)"
    return "(Not documented)"

def extract_field(content: str, field: str) -> str:
    """Extract a specific field value"""
    pattern = rf"\*\*{re.escape(field)}:\*\*\s*(.+?)(?:\n|$)"
    match = re.search(pattern, content)
    if match:
        return match.group(1).strip()
    return ""

def get_git_history(since_date: str = None) -> List[Dict]:
    """Get all SR&ED tagged commits"""
    cmd = ["git", "log", "--pretty=format:%H|%ad|%an|%s", "--date=iso"]
    if since_date:
        cmd.append(f"--since={since_date}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
        if result.returncode != 0:
            return []
        
        commits = []
        tags = ["exp:", "fail:", "pivot:", "succeed:", "hyp:", "conclude:"]
        
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 3)
            if len(parts) < 4:
                continue
            
            hash_, date, author, message = parts
            
            # Check for SR&ED tags
            for tag in tags:
                if tag in message.lower():
                    commits.append({
                        "hash": hash_[:8],
                        "date": date[:10],
                        "author": author,
                        "message": message,
                        "tag": tag.rstrip(":")
                    })
                    break
        
        return commits
    except:
        return []

def validate_documentation() -> Dict:
    """Check for gaps in documentation"""
    experiments = load_all_experiments()
    issues = []
    warnings = []
    
    for exp in experiments:
        exp_id = exp["id"]
        
        # Critical issues
        if exp["uncertainty"] == "(Not documented)":
            issues.append(f"{exp_id}: Missing technological uncertainty")
        
        if exp["status"] == "completed" and exp["advancement"] == "(Not documented)":
            issues.append(f"{exp_id}: Completed but missing advancement claim")
        
        if exp["investigation_count"] < 2:
            issues.append(f"{exp_id}: Insufficient investigation log entries ({exp['investigation_count']})")
        
        # Warnings
        if not exp["hours"]:
            warnings.append(f"{exp_id}: No billable hours documented")
        
        if exp["hypothesis"] == "(Not documented)":
            warnings.append(f"{exp_id}: Missing hypothesis")
    
    # Check for unlinked commits
    commits = get_git_history()
    exp_ids = {e["id"].upper() for e in experiments}
    
    for commit in commits:
        exp_match = re.search(r"(EXP-\d+)", commit["message"], re.IGNORECASE)
        if exp_match:
            if exp_match.group(1).upper() not in exp_ids:
                warnings.append(f"Commit {commit['hash']} references unknown experiment {exp_match.group(1)}")
        else:
            warnings.append(f"Commit {commit['hash']} has SR&ED tag but no experiment ID")
    
    return {
        "issues": issues,
        "warnings": warnings,
        "experiment_count": len(experiments),
        "completed_count": sum(1 for e in experiments if e["status"] == "completed"),
        "commit_count": len(commits)
    }

def generate_timeline() -> str:
    """Generate chronological timeline of all R&D activity"""
    experiments = load_all_experiments()
    commits = get_git_history()
    
    # Combine and sort events
    events = []
    
    for exp in experiments:
        if exp["start_date"]:
            events.append({
                "date": exp["start_date"],
                "type": "experiment_start",
                "id": exp["id"],
                "detail": exp["uncertainty"][:100] + "..."
            })
        if exp["end_date"] and exp["status"] == "completed":
            events.append({
                "date": exp["end_date"],
                "type": "experiment_end",
                "id": exp["id"],
                "detail": exp["advancement"][:100] + "..." if exp["advancement"] != "(Not documented)" else "Closed"
            })
    
    for commit in commits:
        events.append({
            "date": commit["date"],
            "type": f"commit_{commit['tag']}",
            "id": commit["hash"],
            "detail": commit["message"][:80]
        })
    
    events.sort(key=lambda x: x["date"])
    
    # Format timeline
    output = "# SR&ED Activity Timeline\n\n"
    output += "| Date | Event | ID | Detail |\n"
    output += "|------|-------|----|---------|\n"
    
    icons = {
        "experiment_start": "🚀 Start",
        "experiment_end": "✅ Close",
        "commit_exp": "📝 Begin",
        "commit_fail": "❌ Fail",
        "commit_pivot": "🔄 Pivot",
        "commit_succeed": "✅ Success",
        "commit_hyp": "💡 Hypothesis",
        "commit_conclude": "📋 Conclude"
    }
    
    for event in events:
        icon = icons.get(event["type"], "📌")
        output += f"| {event['date']} | {icon} | {event['id']} | {event['detail'][:60]} |\n"
    
    return output

def generate_t661_narratives() -> str:
    """Generate T661-formatted narrative fragments for each experiment"""
    config = load_config()
    experiments = load_all_experiments()
    
    output = f"""# T661 Narrative Fragments
## {config['project']['name']}

**Prepared:** {datetime.now().strftime("%Y-%m-%d")}
**Fiscal Year:** {config['project']['fiscal_year_end']}
**Field of Science:** {config['project']['field_of_science']} - {config['project']['field_of_science_name']}

---

"""
    
    for exp in experiments:
        output += f"""## {exp['id']} ({exp['status'].upper()})

### Line 242 - Technological Uncertainties

{exp['uncertainty']}

### Line 244 - Systematic Investigation

**Hypothesis:** {exp['hypothesis']}

**Investigation Log:** {exp['investigation_count']} documented iterations

*See experiment manifest for full investigation timeline.*

### Line 246 - Technological Advancement

{exp['advancement']}

### Supporting Metrics

- **Duration:** {exp['start_date']} to {exp['end_date'] or 'ongoing'}
- **Billable Hours:** {exp['hours'] or 'TBD'}
- **Documentation:** `{exp['file']}`

---

"""
    
    return output

def generate_audit_package():
    """Generate complete audit package"""
    config = load_config()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    package_dir = AUDIT_DIR / f"audit_{timestamp}"
    package_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"🔬 Generating Audit Package for {config['project']['name']}")
    print("=" * 50)
    
    # 1. Validation report
    print("\n📋 Running validation...")
    validation = validate_documentation()
    
    validation_report = f"""# Documentation Validation Report

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Project:** {config['project']['name']}

## Summary

| Metric | Count |
|--------|-------|
| Total Experiments | {validation['experiment_count']} |
| Completed | {validation['completed_count']} |
| SR&ED Commits | {validation['commit_count']} |
| Critical Issues | {len(validation['issues'])} |
| Warnings | {len(validation['warnings'])} |

## Critical Issues (Must Fix Before Claim)

"""
    if validation['issues']:
        for issue in validation['issues']:
            validation_report += f"- ❌ {issue}\n"
    else:
        validation_report += "✅ No critical issues found.\n"
    
    validation_report += "\n## Warnings (Should Review)\n\n"
    if validation['warnings']:
        for warning in validation['warnings']:
            validation_report += f"- ⚠️ {warning}\n"
    else:
        validation_report += "✅ No warnings.\n"
    
    with open(package_dir / "01_validation_report.md", "w") as f:
        f.write(validation_report)
    print(f"   ✅ Validation report: {len(validation['issues'])} issues, {len(validation['warnings'])} warnings")
    
    # 2. Timeline
    print("\n📅 Generating timeline...")
    timeline = generate_timeline()
    with open(package_dir / "02_activity_timeline.md", "w") as f:
        f.write(timeline)
    print("   ✅ Timeline generated")
    
    # 3. T661 narratives
    print("\n📝 Generating T661 narratives...")
    t661 = generate_t661_narratives()
    with open(package_dir / "03_t661_narratives.md", "w") as f:
        f.write(t661)
    print("   ✅ T661 narratives generated")
    
    # 4. Git evidence export
    print("\n📊 Exporting git evidence...")
    commits = get_git_history()
    git_report = "# Git Commit Evidence\n\n"
    git_report += f"**Total SR&ED Commits:** {len(commits)}\n\n"
    git_report += "| Date | Hash | Tag | Message |\n"
    git_report += "|------|------|-----|----------|\n"
    for c in commits:
        git_report += f"| {c['date']} | {c['hash']} | {c['tag']} | {c['message'][:50]} |\n"
    
    with open(package_dir / "04_git_evidence.md", "w") as f:
        f.write(git_report)
    print(f"   ✅ Exported {len(commits)} commits")
    
    # 5. Copy all experiment manifests
    print("\n📁 Copying experiment manifests...")
    manifest_dir = package_dir / "experiments"
    manifest_dir.mkdir(exist_ok=True)
    
    count = 0
    for folder in ["active_experiments", "completed_experiments"]:
        folder_path = SRED_DIR / folder
        if folder_path.exists():
            for f in folder_path.glob("*.md"):
                if "SAMPLE" not in f.stem:
                    with open(f) as src:
                        with open(manifest_dir / f.name, "w") as dst:
                            dst.write(src.read())
                    count += 1
    print(f"   ✅ Copied {count} experiment manifests")
    
    # 6. Executive summary
    print("\n📊 Generating executive summary...")
    experiments = load_all_experiments()
    
    total_hours = 0
    for exp in experiments:
        if exp["hours"]:
            try:
                total_hours += float(exp["hours"].split()[0])
            except:
                pass
    
    exec_summary = f"""# SR&ED Audit Package - Executive Summary

**Project:** {config['project']['name']}
**Company:** {config['project']['company']}
**Fiscal Year End:** {config['project']['fiscal_year_end']}
**Package Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

## R&D Activity Summary

| Metric | Value |
|--------|-------|
| Total Experiments | {len(experiments)} |
| Completed Experiments | {sum(1 for e in experiments if e['status'] == 'completed')} |
| Active Experiments | {sum(1 for e in experiments if e['status'] == 'active')} |
| Documented Iterations | {sum(e['investigation_count'] for e in experiments)} |
| SR&ED Git Commits | {len(commits)} |
| Estimated Billable Hours | {total_hours or 'TBD'} |

## Technological Domains Investigated

"""
    for domain in config.get("technological_domains", []):
        exec_summary += f"- **{domain['id']}:** {domain['name']}\n"
    
    exec_summary += f"""

## Package Contents

1. `01_validation_report.md` - Documentation completeness check
2. `02_activity_timeline.md` - Chronological R&D activity
3. `03_t661_narratives.md` - Pre-formatted T661 claim text
4. `04_git_evidence.md` - Commit history evidence
5. `experiments/` - All experiment manifests

## Documentation Integrity

- Critical Issues: {len(validation['issues'])}
- Warnings: {len(validation['warnings'])}

{'⚠️ **Review required before claim submission.**' if validation['issues'] else '✅ **Documentation appears complete.**'}

---

*This package was generated by the SR&ED Evidence Pipeline.*
*For questions, contact the project maintainer.*
"""
    
    with open(package_dir / "00_executive_summary.md", "w") as f:
        f.write(exec_summary)
    
    print("\n" + "=" * 50)
    print(f"✅ Audit package generated: {package_dir}")
    print("\nContents:")
    for f in sorted(package_dir.glob("*")):
        if f.is_file():
            print(f"   📄 {f.name}")
        else:
            print(f"   📁 {f.name}/")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1].lower()
    
    if command == "generate":
        generate_audit_package()
    
    elif command == "timeline":
        print(generate_timeline())
    
    elif command == "t661":
        print(generate_t661_narratives())
    
    elif command == "validate":
        validation = validate_documentation()
        print("\n📋 Documentation Validation")
        print("=" * 40)
        print(f"Experiments: {validation['experiment_count']}")
        print(f"Completed: {validation['completed_count']}")
        print(f"SR&ED Commits: {validation['commit_count']}")
        print()
        
        if validation['issues']:
            print("❌ CRITICAL ISSUES:")
            for issue in validation['issues']:
                print(f"   • {issue}")
        else:
            print("✅ No critical issues")
        
        print()
        
        if validation['warnings']:
            print("⚠️  WARNINGS:")
            for warning in validation['warnings']:
                print(f"   • {warning}")
        else:
            print("✅ No warnings")
    
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
