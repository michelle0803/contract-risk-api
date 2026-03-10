# Contract Risk Reviewer API

> AI-powered contract risk analysis backend — Node.js · Claude API · Microsoft Dataverse · Azure

---

## The Problem

Every organization signs contracts — NDAs, Statements of Work, vendor agreements, MSAs. But most small and mid-sized teams don't have dedicated legal counsel reviewing every document before it's signed. Contracts get forwarded to whoever is available, skimmed under time pressure, and approved without anyone flagging the clause that caps your IP rights or exposes you to unlimited liability.

The result is risk that was always visible in the document — just never surfaced to the right person at the right time.

Manual contract review is slow, inconsistent, and scales poorly. A junior analyst reviewing a 20-page vendor agreement may miss a buried indemnification clause that a senior attorney would flag immediately. The knowledge gap is real, and the consequences can be expensive.

---

## The Solution

This API sits between a Power Automate flow and Microsoft Dataverse to automate the first pass of contract risk review using AI.

When a contract is submitted for review in the Model-Driven App, Power Automate triggers a POST request to this API. The API sends the contract text to Anthropic's Claude model, which analyzes it for risky language, scores overall risk on a scale of 1 to 10, and returns a structured breakdown of every flagged clause — categorized by type, rated by severity, and accompanied by a plain-English recommendation.

Those results are written back to Dataverse automatically. By the time a human reviewer opens the contract record, the AI has already done the first pass. Risk flags are surfaced in a subgrid. The audit trail is logged. High-risk contracts rise to the top of the queue.

The goal is not to replace human judgment — it is to make sure human judgment is focused where it matters most.

---

## Technical Decisions & Why I Made Them

**Why Node.js + Express over Python or Azure Functions**

Express gives you a lightweight, predictable REST API with minimal boilerplate. For a project where the primary logic lives in two external API calls — Claude and Dataverse — a thin Express layer is the right tool. Python would have worked equally well, but Node.js keeps the entire stack in one language ecosystem and integrates naturally with the Power Platform CLI tooling used elsewhere in this project.

Azure Functions were considered and ruled out for the portfolio version because they add deployment complexity without meaningful benefit at this scale. The architecture is designed so that swapping Express for Azure Functions later is a straightforward migration if the client requires serverless.

**Why Anthropic Claude over OpenAI**

Claude's instruction-following on structured JSON output is exceptionally reliable. Contract analysis requires the model to return a consistent schema every time — a misformatted response that breaks `JSON.parse()` in a production workflow is a real problem, not a theoretical one. Claude's tendency to follow explicit formatting instructions precisely made it the right choice for this use case.

The prompt is engineered to return only a JSON object with no markdown, no preamble, and no explanation — just the data structure the application needs.

**Why Dataverse over SharePoint or SQL**

This project is built for the Power Platform ecosystem. Dataverse gives you native integration with Model-Driven Apps, row-level security, relationship management between tables, and Power Automate connectors that work without custom configuration. A SharePoint list would have been simpler to set up but would have required workarounds for the relational data model — contracts with many risk flags and a full audit history.

Dataverse was the right choice for enterprise-grade data architecture within the Microsoft stack.

**Why client credentials OAuth over delegated auth**

The API runs as a background service — there is no user present to authenticate when Power Automate triggers the call. Client credentials flow (service principal authentication via Azure AD) is the correct pattern for server-to-server communication. It also means the API's permissions are explicit and auditable, not tied to any individual user's account or subject to breaking when someone leaves the organization.

**Why sequential flag writes over parallel**

The `createRiskFlag` calls in the route handler run sequentially in a `for` loop rather than in parallel with `Promise.all()`. This is intentional. Dataverse has API throttling limits, and a contract with 8-10 flags sent in parallel can trigger rate limiting errors. Sequential writes are slightly slower but reliable. For a production system handling high volume this would be revisited with proper retry logic and batching.

---

## Architecture

```
User submits contract in Model-Driven App
              ↓
     Dataverse record created
              ↓
  Power Automate flow triggers
              ↓
    POST /api/analyze
    { contractId, contractText, contractType }
              ↓
    ┌──────────────────────────┐
    │   claudeService.js       │
    │   Anthropic Claude API   │
    │   → risk score 1-10      │
    │   → plain English summary│
    │   → flagged clauses[]    │
    └──────────────────────────┘
              ↓
    ┌─────────────────────────┐
    │  dataverseService.js    │
    │  Dataverse REST API     │
    │  → update Contracts row │
    │  → create Risk Flags    │
    │  → log Review History   │
    └─────────────────────────┘
              ↓
  Model-Driven App displays results
  Risk flags surfaced in subgrid
  Audit trail logged automatically
              ↓
    GitHub Actions CI/CD
    → deploys to Azure Web App
       on every push to main
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| AI Analysis | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Data Platform | Microsoft Dataverse REST API (OData v4) |
| Auth | Azure AD client credentials OAuth 2.0 |
| Hosting | Azure Web App |
| CI/CD | GitHub Actions |
| Dev tooling | nodemon, dotenv |

---

## Endpoints

### `POST /api/analyze`

Triggers AI analysis of a contract and writes structured results back to Dataverse.

**Request body:**
```json
{
  "contractId": "00000000-0000-0000-0000-000000000001",
  "contractType": "NDA",
  "contractText": "Full contract text goes here..."
}
```

**Success response (200):**
```json
{
  "success": true,
  "riskScore": 8,
  "riskSummary": "This NDA contains several high-risk provisions...",
  "flagCount": 3
}
```

**Error responses:**
- `400` — missing `contractId` or `contractText`, or text too short
- `500` — Claude API failure or Dataverse write failure (details in `detail` field)

---

### `GET /health`

Returns server status. Used by Azure to verify the app is running and by Power Automate to test connectivity.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

## Local Setup

### Prerequisites

- Node.js 18 or higher
- An Anthropic API account with credits — console.anthropic.com
- An Azure account with a registered App Registration
- A Dataverse environment with the Contracts, Risk Flags, and Review History tables created

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/michelle0803/contract-risk-api.git
cd contract-risk-api
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**
```bash
cp .env.example .env
```
Open `.env` and fill in all six values. See Environment Variables section below.

**4. Start the development server**
```bash
npm run dev
```

**5. Verify it's running**

Open a browser and go to `http://localhost:3000/health` — you should see the status response.

**6. Test the analyze endpoint**

Using the VS Code REST Client extension, open `test.http` and click Send Request on the analyze block. You should receive a `riskScore`, `riskSummary`, and `flagCount` in the response.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. Never commit `.env` to version control.

| Variable | Description | Where to find it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | console.anthropic.com → API Keys |
| `AZURE_CLIENT_ID` | Azure App Registration client ID | Azure Portal → App Registrations → your app → Overview |
| `AZURE_CLIENT_SECRET` | Azure App Registration secret | Azure Portal → App Registrations → your app → Certificates & secrets |
| `AZURE_TENANT_ID` | Azure AD tenant ID | Azure Portal → App Registrations → your app → Overview |
| `DATAVERSE_URL` | Your Dataverse environment URL | make.powerapps.com → Settings → Session details |
| `PORT` | Port for the local server | Default: 3000 |

---

## Project Structure

```
contract-risk-api/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD pipeline
├── src/
│   ├── index.js                # Express app entry point
│   ├── routes/
│   │   └── analyze.js          # POST /api/analyze route handler
│   └── services/
│       ├── claudeService.js    # Anthropic Claude API integration
│       └── dataverseService.js # Dataverse REST API integration
├── .env                        # Local secrets — never committed
├── .env.example                # Environment variable template
├── .gitignore
├── package.json
├── test.http                   # VS Code REST Client test requests
└── README.md
```

---

## Deployment

Pushing to the `main` branch automatically triggers the GitHub Actions pipeline which:

1. Runs a dependency install and basic health check
2. Packages the application
3. Deploys to Azure Web App using the publish profile stored as a GitHub Secret

See `.github/workflows/deploy.yml` for the full pipeline configuration.

**Required GitHub Secrets:**

| Secret | Description |
|---|---|
| `AZURE_WEBAPP_NAME` | Name of your Azure Web App resource |
| `AZURE_PUBLISH_PROFILE` | XML publish profile downloaded from Azure Portal |

---

## Part of a Larger System

This API is one component of the **Contract Risk Reviewer** — a full portfolio project demonstrating enterprise Power Platform development with AI integration.

The complete system includes:

- **This API** — Node.js backend with Claude AI analysis and Dataverse writes
- **Model-Driven App** — Contracts management UI with risk flag subgrids and review history timeline built on Dataverse
- **Power Automate Flow** — Event-driven trigger that calls this API automatically when a contract status changes to Under Review
- **GitHub Actions Pipeline** — CI/CD deployment to Azure on every push to main

---

## About CypherCodeAI

This project was built by **Michelle P.** as part of the [CypherCodeAI](https://cyphercodeai.com) portfolio — demonstrating AI-augmented business process automation for enterprise Microsoft environments.

CypherCodeAI specializes in Power Platform development, AI integration, and cybersecurity solutions for organizations looking to modernize their workflows with intelligent automation.

---

*Built with Node.js · Anthropic Claude · Microsoft Dataverse · Azure · GitHub Actions*
