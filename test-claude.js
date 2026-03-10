// test-claude.js (in project root — delete after testing)
require('dotenv').config();
const { analyzeContract } = require('./src/services/claudeService');

const sampleContract = `
  This Non-Disclosure Agreement is entered into between the parties.
  The receiving party shall keep all information confidential indefinitely.
  Any breach shall result in unlimited liability for the receiving party.
  The disclosing party may terminate this agreement at any time without notice.
`;

analyzeContract(sampleContract, 'NDA')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error('Error:', err.message));




