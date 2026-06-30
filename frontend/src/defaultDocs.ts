export interface PreloadedDoc {
  id: string;
  name: string;
  content: string;
}

export const defaultDocuments: PreloadedDoc[] = [
  {
    id: "employee-handbook",
    name: "employee_onboarding_handbook.md",
    content: `# Acme Corp Employee Onboarding Handbook

Welcome to Acme Corp! We are committed to building high-performance, secure, and collaborative enterprise solutions. This handbook outlines core operational guidelines and workflows for all new employees.

## 1. Core Operating Hours & Remote Work
- **Core Hours:** Acme Corp operates across multiple timezones. All teams must be available during core hours: 10:00 AM to 3:00 PM EST.
- **Remote Work Policy:** We are a remote-first organization. Employees are expected to maintain an active internet connection capable of high-definition video conferencing.
- **Sync Meetings:** Weekly standups are held on Mondays at 11:00 AM EST. All hands meetings are held on the last Thursday of each month.

## 2. Professional Communication Etiquette
- **Slack Channels:** Use public channels (e.g., \`#engineering\`, \`#product\`, \`#marketing\`) for task discussions to keep knowledge searchable. Keep direct messages (DMs) for confidential or personal communication.
- **Email Guidelines:** Respond to client emails within 24 business hours. Internal colleague emails should be resolved within 48 business hours.
- **Documentation First:** If a workflow or decision affects more than two team members, it must be documented in the Shared Wiki rather than buried in chat history.

## 3. Expense Reimbursement and Benefits
- **Home Office Allowance:** Every employee receives a $500 home-office equipment stipend upon hire, refreshable every 24 months.
- **Submitting Claims:** Submit all receipts via the Expensify portal before the 25th of each month for reimbursement in the next payroll cycle.
- **Health & Wellness:** Comprehensive healthcare, dental, and vision coverages begin on Day 1 of employment. We also offer a $50/month wellness stipend for gym or meditation apps.
`
  },
  {
    id: "it-security-protocols",
    name: "it_security_protocols.md",
    content: `# Acme Corp IT Security & Compliance Policy

Security is our top priority. As an enterprise employee, safeguarding proprietary data, customer privacy, and system integrity is your direct responsibility.

## 1. Password Management & MFA
- **Complexity Requirements:** All account passwords must be at least 14 characters long and include uppercase, lowercase, numbers, and special symbols. Passwords must be updated every 90 days.
- **Multi-Factor Authentication (MFA):** MFA is mandatory for all internal services, including Google Workspace, AWS, GitHub, and Expensify. Use an authenticator app (e.g., Okta Verify, Google Authenticator) rather than SMS.
- **Password Managers:** Sharing passwords over Slack or email is strictly forbidden. Use the team-wide 1Password vault to share API credentials or service access securely.

## 2. Device Security & Phishing
- **VPN Mandatory:** You must connect to the corporate Tailscale VPN whenever accessing internal production consoles, database nodes, or staging servers.
- **Auto-Lock:** Set your machine to auto-lock after 5 minutes of inactivity. Never leave unlocked machines unattended in public spaces.
- **Phishing Drills:** Our security team conducts random monthly phishing simulations. If you suspect an email is malicious, do not click links; click "Report Phishing" in the Gmail sidebar immediately.

## 3. Incident Response Escalation
In the event of a security breach, laptop theft, or unauthorized database access:
1. Immediately change critical account passwords.
2. Disconnect your device from all internet networks.
3. Slack \`#sec-ops\` or call the IT hotline at +1 (800) 555-0199 to report the incident.
`
  },
  {
    id: "customer-support-sla",
    name: "customer_support_sla.md",
    content: `# Enterprise Customer Support SLA Guidelines

This document establishes the Service Level Agreements (SLAs) and standard escalation matrices for Acme Corp's enterprise customers.

## 1. Severity Levels & Response Times
We categorize incoming customer issues into four severity tiers:

- **Severity 1 (Critical):** Core service is fully down, or critical data loss is imminent.
  - *Initial Response SLA:* Within 30 minutes (24/7/365).
  - *Target Resolution:* Within 4 hours.
- **Severity 2 (High):** Major functionality is degraded, but business operations can proceed with manual workarounds.
  - *Initial Response SLA:* Within 2 hours (Business hours).
  - *Target Resolution:* Within 24 hours.
- **Severity 3 (Normal):** Minor bug or service inconvenience. Core features are working normally.
  - *Initial Response SLA:* Within 12 business hours.
  - *Target Resolution:* Within 5 business days.
- **Severity 4 (Low):** Feature requests, product feedback, or cosmetic queries.
  - *Initial Response SLA:* Within 24 business hours.
  - *Target Resolution:* Unscheduled / Next release cycle.

## 2. Escalation Paths
If an SLA is breached or an engineer is unable to resolve a Severity 1 issue:
1. **Level 1 Support Engineer** handles initial triage.
2. If unresolved after 1 hour, escalate to **Engineering Lead**.
3. If unresolved after 2 hours, escalate to **VP of Customer Success**.
4. If unresolved after 3 hours, notify the **Chief Technology Officer (CTO)**.

## 3. Service Credits and Reimbursements
If Acme Corp fails to meet the 99.9% uptime SLA in any calendar month, Enterprise customers are eligible to claim service credits:
- **Uptime 99.0% - 99.9%:** 10% credit on monthly subscription fee.
- **Uptime 95.0% - 99.0%:** 25% credit on monthly subscription fee.
- **Uptime Below 95.0%:** 50% credit on monthly subscription fee.
`
  }
];
