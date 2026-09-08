/**
 * BTP Destination Service helper using Node.js https module directly.
 * Bypasses SSL verification for BTP internal service calls.
 */
import https from 'https';
import http from 'http';

// Core HTTP request using Node.js built-in — supports rejectUnauthorized
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: false
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Get destination service credentials from VCAP_SERVICES
function getDestCreds() {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const creds = vcap['destination']?.[0]?.credentials;
  if (!creds) throw new Error('Destination service not bound to app');
  return creds;
}

// Get OAuth token from XSUAA for destination service
async function getToken(creds) {
  const url = `${creds.url}/oauth/token?grant_type=client_credentials`;
  const auth = Buffer.from(`${creds.clientid}:${creds.clientsecret}`).toString('base64');
  const res = await request(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = JSON.parse(res.text);
  if (!data.access_token) throw new Error(`Token error: ${res.text}`);
  return data.access_token;
}

// Fetch destination config from BTP Destination Service
async function getDestination(name) {
  const creds = getDestCreds();
  const token = await getToken(creds);
  const res = await request(
    `${creds.uri}/destination-configuration/v1/destinations/${name}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (res.status !== 200) throw new Error(`Destination '${name}' not found: ${res.status} ${res.text}`);
  return JSON.parse(res.text);
}

// Make HTTP call via BTP destination
export async function callViaDestination(destinationName, path, options = {}) {
  const dest = await getDestination(destinationName);
  const baseUrl = dest.destinationConfiguration?.URL || dest.destinationConfiguration?.Url;
  if (!baseUrl) throw new Error(`Destination '${destinationName}' has no URL`);

  const url = `${baseUrl}${path}`;
  const authType = dest.destinationConfiguration?.Authentication;
  const headers = { 'Accept': 'application/json', ...(options.headers || {}) };

  if (authType === 'BasicAuthentication') {
    const user = dest.destinationConfiguration?.User;
    const pass = dest.destinationConfiguration?.Password;
    headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
  if (dest.authTokens?.[0]?.value) {
    headers['Authorization'] = `${dest.authTokens[0].type || 'Bearer'} ${dest.authTokens[0].value}`;
  }

  const res = await request(url, { method: options.method || 'GET', headers, body: options.body });
  if (res.status >= 400) throw new Error(`HTTP ${res.status} from ${url}: ${res.text.substring(0, 300)}`);
  return JSON.parse(res.text);
}
