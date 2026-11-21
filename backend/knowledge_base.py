"""
Company knowledge base for RAG.
Uses simple keyword + TF-IDF cosine similarity so there are no extra vector DB deps.
In production, replace with Pinecone / Weaviate / pgvector.
"""
from __future__ import annotations
import math
import re
from dataclasses import dataclass


@dataclass
class KBArticle:
    id: str
    title: str
    category: str
    content: str
    tags: list[str]


# ── Knowledge articles ─────────────────────────────────────────────────────

ARTICLES: list[KBArticle] = [
    KBArticle(
        id="KB-001",
        title="Work From Home (WFH) Policy",
        category="HR",
        content="""
Employees may work from home up to 3 days per week subject to manager approval.
Core hours where employees must be available are 10:00 AM – 4:00 PM local time.
WFH requests must be submitted via the HR portal at least 24 hours in advance.
Employees must have a stable internet connection (minimum 25 Mbps).
Sensitive client data must not be accessed on public Wi-Fi without a VPN.
Exceptions for 5-day remote work require VP-level approval and are reviewed quarterly.
""",
        tags=["wfh", "remote", "policy", "hr"],
    ),
    KBArticle(
        id="KB-002",
        title="Annual Leave & PTO Policy",
        category="HR",
        content="""
Full-time employees accrue 20 days of Paid Time Off (PTO) per calendar year.
PTO accrues at 1.67 days per month and can be used after the first 90 days of employment.
A maximum of 5 unused PTO days may be carried over to the next calendar year.
Leave requests must be submitted in Workday at least 2 weeks in advance for more than 2 days.
Sick leave is separate: 10 days per year, does not carry over.
Maternity/paternity leave: 16 weeks paid for primary caregiver, 4 weeks for secondary caregiver.
""",
        tags=["leave", "pto", "vacation", "sick", "policy", "hr"],
    ),
    KBArticle(
        id="KB-003",
        title="IT Support & Helpdesk Procedures",
        category="IT",
        content="""
For urgent IT issues (system down, security breach): call the 24/7 hotline at ext. 5555.
For standard requests: raise a ticket at helpdesk.internal.company.com.
SLA: Critical issues resolved within 2 hours; High within 8 hours; Medium within 2 business days.
Laptop replacements require manager approval and take 3–5 business days.
Software license requests: submit via the IT portal with justification and manager sign-off.
VPN access: use Cisco AnyConnect. Config guide is at it-docs.internal.company.com/vpn.
Password resets: self-service via identity.company.com or call ext. 5555.
""",
        tags=["it", "support", "helpdesk", "vpn", "laptop", "software"],
    ),
    KBArticle(
        id="KB-004",
        title="Expense Reimbursement Policy",
        category="Finance",
        content="""
Business expenses up to $50 require a receipt and can be submitted directly in Concur.
Expenses between $50–$500 require manager approval before submission.
Expenses above $500 require VP-level pre-approval before the expense is incurred.
Travel bookings must go through the approved corporate travel portal (Egencia).
Meal allowance during business travel: $75/day domestic, $100/day international.
All receipts must be submitted within 30 days of the expense date.
Reimbursements are processed in the next payroll cycle (bi-weekly).
""",
        tags=["expense", "reimbursement", "travel", "policy", "finance"],
    ),
    KBArticle(
        id="KB-005",
        title="Employee Onboarding Checklist",
        category="HR",
        content="""
Day 1: Collect laptop from IT (Room 101), complete I-9 verification with HR, set up email and Slack.
Week 1: Complete Security Awareness training (mandatory, online), set up 2FA on all systems.
Week 2: Shadow team members, attend architecture overview session with Engineering leads.
Day 30: Complete compliance training modules in the LMS (3 hours total).
Day 90: First performance check-in with your manager via Workday.
Key systems to access: Jira, Confluence, GitHub Enterprise, Datadog, AWS Console, Slack, Workday.
Buddy program: You'll be assigned a buddy from your team for the first 3 months.
""",
        tags=["onboarding", "new hire", "checklist", "day 1"],
    ),
    KBArticle(
        id="KB-006",
        title="Code Review Standards & Process",
        category="Engineering",
        content="""
All code changes require at least 1 approving review before merging (2 for production-critical paths).
PRs must pass all CI checks (unit tests, integration tests, linting) before review.
Reviewers should respond within 1 business day. Use the GitHub 'Request Review' feature.
PR description must include: what changed, why, testing performed, and any rollback plan.
Feature flags are required for any change affecting more than 10% of users.
Hotfixes to production: notify #incidents Slack channel, get emergency approval from on-call lead.
Branch naming: feature/TASK-ID-short-description, bugfix/TASK-ID-short-description.
""",
        tags=["code review", "pr", "engineering", "github", "ci"],
    ),
    KBArticle(
        id="KB-007",
        title="Incident Response Playbook",
        category="Engineering",
        content="""
Severity 1 (Complete outage): Page on-call engineer immediately via PagerDuty.
Severity 2 (Partial outage / degraded performance): Create incident in PagerDuty, notify #incidents.
Severity 3 (Minor issue, workaround available): Create Jira ticket, fix in next sprint.
Incident Commander role: The first responder owns coordination until handoff.
Communication: Update status page every 15 minutes during Sev-1/2 incidents.
Post-mortem: Required for all Sev-1 and Sev-2, due within 5 business days of resolution.
Runbooks for common incidents: at runbooks.internal.company.com.
""",
        tags=["incident", "outage", "on-call", "pagerduty", "severity", "postmortem"],
    ),
    KBArticle(
        id="KB-008",
        title="Performance Review Process",
        category="HR",
        content="""
Performance reviews are conducted twice yearly: mid-year (July) and year-end (December).
Employees complete a self-assessment in Workday 2 weeks before the review date.
Managers share written feedback and ratings: Exceeds / Meets / Partially Meets / Does Not Meet expectations.
Ratings directly influence annual merit increases (typically 2–8% for Meets and above).
Promotion eligibility: Consistently Exceeds for 2 consecutive reviews + open headcount.
360-degree feedback is collected from 3–5 peers chosen by the employee and approved by manager.
""",
        tags=["performance", "review", "promotion", "rating", "hr"],
    ),
]


# ── Simple TF-IDF search ───────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z]+", text.lower())


def _tf(tokens: list[str]) -> dict[str, float]:
    freq: dict[str, int] = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    total = len(tokens) or 1
    return {k: v / total for k, v in freq.items()}


def _idf(term: str, docs: list[list[str]]) -> float:
    n = sum(1 for d in docs if term in d)
    return math.log((len(docs) + 1) / (n + 1)) + 1


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    keys = set(a) & set(b)
    if not keys:
        return 0.0
    dot = sum(a[k] * b[k] for k in keys)
    mag_a = math.sqrt(sum(v * v for v in a.values()))
    mag_b = math.sqrt(sum(v * v for v in b.values()))
    return dot / (mag_a * mag_b + 1e-9)


def search_knowledge_base(query: str, top_k: int = 2) -> list[dict]:
    """Return the top-k most relevant KB articles for a query."""
    all_tokens = [
        _tokenize(a.title + " " + a.content + " " + " ".join(a.tags))
        for a in ARTICLES
    ]
    q_tokens = _tokenize(query)
    vocab = set(q_tokens)
    for doc in all_tokens:
        vocab.update(doc)

    q_tfidf = {t: _tf(q_tokens).get(t, 0) * _idf(t, all_tokens) for t in vocab}

    scores: list[tuple[float, KBArticle]] = []
    for article, tokens in zip(ARTICLES, all_tokens):
        tfidf = {t: _tf(tokens).get(t, 0) * _idf(t, all_tokens) for t in vocab}
        score = _cosine(q_tfidf, tfidf)
        scores.append((score, article))

    scores.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "id": a.id,
            "title": a.title,
            "category": a.category,
            "content": a.content.strip(),
            "relevance_score": round(score, 3),
        }
        for score, a in scores[:top_k]
        if score > 0.01
    ]
