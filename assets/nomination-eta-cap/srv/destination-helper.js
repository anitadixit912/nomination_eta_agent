/**
 * Helper to call BTP Destination Service directly
 * Uses undici Agent to bypass TLS (Node.js built-in fetch uses undici)
 */
import { Agent, setGlobalDispatcher, fetch as undiciFetch } from 'undici';

// Configure undici to skip TLS verification for BTP internal calls
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

// Get destination service credentials from VCAP_SERVICES
function getDestinationServiceCredentials() {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const destService = vcap['destination']?.[0]?.credentials;
  if (!destService) throw new Error('Destination service not bound');
  return destService;
}

// Get OAuth token for destination service
async function getAccessToken(credentials) {
  const { clientid, clientsecret, url } = credentials;
  if (!url) throw new Error('No XSUAA url in destination credentials');
  const tokenUrl = `${url}/oauth/token`;
  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(clientid)}&client_secret=${encodeURIComponent(clientsecret)}`;

  const res = await undiciFetch(tokenUrl, {
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

  const res = await undiciFetch(
    `${creds.uri}/destination-configuration/v1/destinations/${destinationName}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Destination '${destinationName}' lookup failed (${res.status}): ${text}`);
  }
  return await res.json();
}

// Make an authenticated HTTP call via a BTP destination
export async function callViaDestination(destinationName, path, options = {}) {
  const dest = await getDestination(destinationName);
  const baseUrl = dest.destinationConfiguration?.URL || dest.destinationConfiguration?.Url;
  if (!baseUrl) throw new Error(`Destination '${destinationName}' has no URL configured`);

  const url = `${baseUrl}${path}`;
  const authType = dest.destinationConfiguration?.Authentication;
  const headers = { 'Accept': 'application/json', ...(options.headers || {}) };

  // Basic Auth
  if (authType === 'BasicAuthentication') {
    const user = dest.destinationConfiguration?.User;
    const pass = dest.destinationConfiguration?.Password;
    headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  // Token-based auth (OAuth, Principal Propagation)
  if (dest.authTokens?.[0]?.value) {
    headers['Authorization'] = `${dest.authTokens[0].type || 'Bearer'} ${dest.authTokens[0].value}`;
  }

  const res = await undiciFetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${text.substring(0, 300)}`);
  }
  return await res.json();
}
