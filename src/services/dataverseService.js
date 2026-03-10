const axios = require('axios');

/**
 * Gets a fresh OAuth token from Azure AD for Dataverse access.
 * Tokens expire after ~1 hour — for production, add token caching.
 * @returns {string} Bearer token
 */
async function getDataverseToken() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope:         `${process.env.DATAVERSE_URL}/.default`,
  });

  const response = await axios.post(tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data.access_token;
}

// Reusable Dataverse request headers
function getHeaders(token) {
  return {
    'Authorization':  `Bearer ${token}`,
    'Content-Type':   'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version':    '4.0',
    'Prefer':           'return=representation',
  };
}

/**
 * Writes the AI risk score and summary back to a Contracts row.
 * @param {string} contractId - The Dataverse row GUID
 * @param {number} riskScore  - Integer 1-10
 * @param {string} riskSummary - Plain text summary
 */
async function updateContract(contractId, riskScore, riskSummary) {
  const token = await getDataverseToken();

  // PATCH updates only the fields you specify — other fields unchanged
  await axios.patch(
    `${process.env.DATAVERSE_URL}/api/data/v9.2/cts_contractses(${contractId})`,
    {
      cts_riskScore:    riskScore,
      cts_riskSummary:  riskSummary,
      cts_reviewStatus: 770000001, // OptionSet value for 'Complete'
    },
    { headers: getHeaders(token) }
  );
}

/**
 * Creates a new Risk Flag row linked to a contract.
 * @param {string} contractId - Parent contract GUID
 * @param {Object} flag       - Flag object from Claude analysis
 */
async function createRiskFlag(contractId, flag) {
  const token = await getDataverseToken();

  // Map Claude's category/severity strings to your Dataverse OptionSet values.
  const categoryMap = {
    'Liability':   770000000,
    'IP':          770000001,
    'Payment':     770000002,
    'Termination': 770000003,
    'Compliance':  770000004,
  };
  const severityMap = {
    'Low':      770000000,
    'Medium':   770000001,
    'High':     770000002,
    'Critical': 770000003,
  };

  await axios.post(
    `${process.env.DATAVERSE_URL}/api/data/v9.2/cts_RiskFlagses`,
    {
      cts_name:              flag.title,
      cts_clauseText:        flag.clauseText,
      cts_RiskCategory:          categoryMap[flag.category]   || 770000000,
      cts_Severity:          severityMap[flag.severity]   || 770000001,
      cts_AIRecommendation:  flag.recommendation,
      cts_Acknowledged:      false,
      // OData bind syntax creates the lookup relationship to the parent contract
      'cts_Contract@odata.bind': `/cts_contracts(${contractId})`,
    },
    { headers: getHeaders(token) }
  );
}

/**
 * Creates a new Review History row as an audit log entry.
 * @param {string} contractId - Parent contract GUID
 * @param {string} eventType  - Human-readable event name
 * @param {string} notes      - Detail of what happened
 */
async function logReviewEvent(contractId, eventType, notes) {
  const token = await getDataverseToken();

  await axios.post(
    `${process.env.DATAVERSE_URL}/api/data/v9.2/cts_ReviewHistoryes`,
    {
      cts_Name:      `${eventType} — ${new Date().toLocaleDateString('en-US')}`,
      cts_EventType: eventType,
      cts_Notes:     notes,
      cts_Timestamp: new Date().toISOString(),
      'cts_Contract@odata.bind': `/cts_contracts(${contractId})`,
    },
    { headers: getHeaders(token) }
  );
}

// Export all three functions
module.exports = {
  updateContract,
  createRiskFlag,
  logReviewEvent,
};
