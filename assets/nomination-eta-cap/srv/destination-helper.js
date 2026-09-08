/**
 * Helper to call BTP Destination Service directly
 * Resolves destination URL + auth token, then makes HTTP call
 */
import https from 'https';
import http from 'http';

const LOG = cds.log ? cds.log('destination') : console;

// Get destination service credentials from VCAP_SERVICES
function getDestinationServiceCredentials() {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const destService = vcap['destination']?.[0]?.credentials;
  if (!destService) throw new Error('Destination service not bound');
  return destService;
}

// Get XSUAA token for destination service
async function getAccessToken(credentials) {
  const { clientid, clientsecret, url } = credentials;
  const tokenUrl = `${url}/oauth/token`;
  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(clientid)}&client_secret=${encodeURIComponent(clientsecret)}`;

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token fetch failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Fetch destination details from BTP Destination Service
async function getDestination(destinationName) {
  const creds = getDestinationServiceCredentials();
  const token = await getAccessToken(creds);

  const res = await fetch(`${creds.uri}/destination-configuration/v1/destinations/${destinationName}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Destination '${destinationName}' not found: ${res.status}`);
  return await res.json();
}

// Make an authenticated HTTP call via a BTP destination
export async function callViaDestination(destinationName, path, options = {}) {
  const dest = await getDestination(destinationName);
  const baseUrl = dest.destinationConfiguration?.URL || dest.destinationConfiguration?.Url;
  if (!baseUrl) throw new Error(`Destination '${destinationName}' has no URL`);

  const url = `${baseUrl}${path}`;
  const authType = dest.destinationConfiguration?.Authentication;

  const headers = { 'Accept': 'application/json', ...(options.headers || {}) };

  // Handle Basic Auth
  if (authType === 'BasicAuthentication') {
    const user = dest.destinationConfiguration?.User;
    const pass = dest.destinationConfiguration?.Password;
    headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  // Handle OAuth
  if (dest.authTokens?.[0]?.value) {
    headers['Authorization'] = `Bearer ${dest.authTokens[0].value}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return await res.json();
}
