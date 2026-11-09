#!/usr/bin/env python3
"""Create/refresh the GitHub project board from docs/06-sprints.md.

One issue per task row (title "S1-4 ..."), labelled with its sprint, and
closed when its id is listed in DONE. Idempotent: existing issues are matched
by their task id prefix and updated, never duplicated.

Run: python3 ops/sync-github-project.py   (needs `gh` with project scope)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = "piyush97/IndianFoodRecommends"
OWNER = "piyush97"
PROJECT_TITLE = "Indian Food Recommends"

# Task ids finished and verified on sprint-0-scaffold. S1-3 and S1-11 were
# replaced by automatic Jev review (see docs/superpowers ledger).
DONE = {
    "S0-1", "S0-2", "S0-3", "S0-4", "S0-5", "S0-6", "S0-7",
    "S1-1", "S1-2", "S1-3", "S1-4", "S1-5", "S1-6", "S1-7", "S1-8", "S1-9", "S1-10", "S1-11",
    "S2-1", "S2-2", "S2-3", "S2-4", "S2-5", "S2-6", "S2-7", "S2-8", "S2-9", "S2-10",
    "S3-1", "S3-2", "S3-3", "S3-4", "S3-5", "S3-6", "S3-7", "S3-8", "S3-9",
    "S4-1", "S4-3", "S4-4",
    "S5-1", "S5-2", "S5-3", "S5-4", "S5-5", "S5-6", "S5-7", "S5-8", "S5-9",
    "S6-1", "S6-2", "S6-3", "S6-4", "S6-5", "S6-6", "S6-7",
}
NOTES = {
    "S0-7": "Done with Neon via Vercel Marketplace. No Google Cloud key: YouTube RSS replaced the Data API.",
    "S1-1": "Done with the public channel RSS feed (no API key, no quota).",
    "S1-3": "Replaced: eval harness exists (`pnpm worker eval`); the human 50-video gate was replaced by automatic Jev review at owner's request.",
    "S1-9": "Done without the E2E test; admin E2E needs a test-auth strategy (Plan 2).",
    "S1-11": "Replaced by automatic Jev review (lib/auto-review.ts); no human queue.",
    "S3-4": "Lighthouse mobile on prod: home 99, dish 95, place 98, CLS 0 (ops/lighthouse.md).",
    "S3-5": "axe in Playwright on 8 pages: 0 serious/critical.",
    "S3-6": "Umami wired behind NEXT_PUBLIC_UMAMI_WEBSITE_ID; owner creates the free Umami account to turn it on.",
    "S3-7": "CSP + headers live; fresh security review: admin page data leak and pg_dump argv password fixed.",
    "S3-8": "About/content policy/opt-out page live; opt-out email pending owner (NEXT_PUBLIC_OPTOUT_EMAIL).",
    "S3-9": "Prod deploy + nightly Neon backups (14 kept). Domain stays the Vercel subdomain until owner buys one.",
    "S4-1": "Done: /submit, Vercel BotID (prod blocks curl/headless), 3/h per IP; suggestions verified against the creator's own feed, city and dish before publishing.",
    "S4-2": "Code done (city registry, Mumbai + Kolkata, 5 new creators). Open until 100 approved picks per city accrue from daily runs.",
    "S4-3": "Done: opt-in distance sort on city and dish pages; location never leaves the browser.",
    "S4-4": "Done: /admin/stale lists public places unverified > 12 months.",
    "S4-5": "Kit + badge built (/creator/[slug]/kit). Open until the owner contacts 3 creators.",
    "S2-4": "Done with MapLibre + OpenFreeMap tiles (no API key); list is the default view.",
    "S2-9": "Done via tag `public` + POST /api/revalidate called by the worker after approvals.",
    "S2-10": "Done: Playwright search→dish→place→watch and 360px overflow, in the CI db job.",
}


def gh(*args: str, check: bool = True) -> str:
    out = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and out.returncode != 0:
        sys.exit(f"gh {' '.join(args[:3])} failed: {out.stderr.strip()}")
    return out.stdout


def rows():
    sprint = None
    for line in Path("docs/06-sprints.md").read_text().splitlines():
        m = re.match(r"## Sprint (\d) · (.+)", line)
        if m:
            sprint = f"Sprint {m.group(1)}"
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if sprint and len(cells) >= 5 and re.fullmatch(r"S\d-\d+", cells[0]):
            yield {
                "id": cells[0], "task": cells[1], "hours": cells[2],
                "model": cells[3], "done_when": cells[4], "sprint": sprint,
            }


def main() -> None:
    tasks = list(rows())
    for s in sorted({t["sprint"] for t in tasks}):
        gh("label", "create", s, "-R", REPO, "--color", "9a3412", "--force")

    existing = json.loads(gh("issue", "list", "-R", REPO, "--state", "all", "--limit", "500",
                             "--json", "number,title,state"))
    by_id = {i["title"].split(" ", 1)[0]: i for i in existing}

    # Board needs the `project` token scope; issues work without it.
    listed = subprocess.run(["gh", "project", "list", "--owner", OWNER, "--format", "json"],
                            capture_output=True, text=True)
    number = None
    if listed.returncode == 0:
        projects = json.loads(listed.stdout)["projects"]
        project = next((p for p in projects if p["title"] == PROJECT_TITLE), None)
        if not project:
            project = json.loads(gh("project", "create", "--owner", OWNER, "--title",
                                    PROJECT_TITLE, "--format", "json"))
            gh("project", "link", str(project["number"]), "--owner", OWNER, "--repo", REPO,
               check=False)
        number = str(project["number"])
    else:
        print("no project scope: run `gh auth refresh -s project`, then re-run for the board")

    for t in tasks:
        title = f"{t['id']} {t['task']}"
        body = (f"**Sprint:** {t['sprint']}\n**Estimate:** {t['hours']} h\n**Model:** {t['model']}\n"
                f"**Done when:** {t['done_when']}\n")
        if t["id"] in NOTES:
            body += f"\n**Status note:** {NOTES[t['id']]}\n"
        issue = by_id.get(t["id"])
        if issue:
            gh("issue", "edit", str(issue["number"]), "-R", REPO, "--title", title, "--body", body,
               "--add-label", t["sprint"])
            url = f"https://github.com/{REPO}/issues/{issue['number']}"
            state = issue["state"]
        else:
            url = gh("issue", "create", "-R", REPO, "--title", title, "--body", body,
                     "--label", t["sprint"]).strip()
            state = "OPEN"
        if number:
            gh("project", "item-add", number, "--owner", OWNER, "--url", url, check=False)
        want_closed = t["id"] in DONE
        if want_closed and state == "OPEN":
            gh("issue", "close", url, "-R", REPO, "--reason", "completed")
        elif not want_closed and state == "CLOSED":
            gh("issue", "reopen", url, "-R", REPO)
        print(f"{'done' if want_closed else 'open'}  {title}")

    if number:
        print(f"project: https://github.com/users/{OWNER}/projects/{number}")


if __name__ == "__main__":
    main()
