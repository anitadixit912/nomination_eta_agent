/**
 * BTP Destination Service helper.
 * Handles both cloud and on-premise destinations.
 * On-premise destinations are routed via SAP Cloud Connector through CF Connectivity Service.
 */
import https from 'https';
import http from 'http';

// Raw HTTP/HTTPS request using Node.js built-in
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: options.proxyHost || parsed.hostname,
      port: options.proxyPort || parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: options.proxyHost ? url : (parsed.pathname + parsed.search),
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

// Get credentials for a VCAP service by label
function getVcapCreds(label) {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const svc = vcap[label]?.[0]?.credentials;
  if (!svc) throw new Error(`Service '${label}' not bound to app`);
  return svc;
}

// Get OAuth token using client credentials
async function getToken(tokenUrl, clientid, clientsecret) {
  const auth = Buffer.from(`${clientid}:${clientsecret}`).toString('base64');
  const res = await request(tokenUrl, {
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
  const creds = getVcapCreds('destination');
  const token = await getToken(`${creds.url}/oauth/token`, creds.clientid, creds.clientsecret);
  const res = await request(
    `${creds.uri}/destination-configuration/v1/destinations/${name}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (res.status !== 200) throw new Error(`Destination '${name}' not found: ${res.status} ${res.text}`);
  return JSON.parse(res.text);
}

// Make HTTP call via BTP destination — supports on-premise via Cloud Connector
export async function callViaDestination(destinationName, path, options = {}) {
  const dest = await getDestination(destinationName);
  const cfg = dest.destinationConfiguration;
  const baseUrl = cfg?.URL || cfg?.Url;
  if (!baseUrl) throw new Error(`Destination '${destinationName}' has no URL`);

  const url = `${baseUrl}${path}`;
  const headers = { ...(options.headers || {}), 'Accept': options.headers?.Accept || 'application/json' };

  // Basic Auth
  if (cfg?.Authentication === 'BasicAuthentication') {
    headers['Authorization'] = `Basic ${Buffer.from(`${cfg.User}:${cfg.Password}`).toString('base64')}`;
  }
  // Token-based auth
  if (dest.authTokens?.[0]?.value) {
    headers['Authorization'] = `${dest.authTokens[0].type || 'Bearer'} ${dest.authTokens[0].value}`;
  }

  // On-premise: route through SAP Cloud Connector via CF Connectivity Service proxy
  let proxyHost, proxyPort;
  if (cfg?.ProxyType === 'OnPremise') {
    const connCreds = getVcapCreds('connectivity');
    const connToken = await getToken(`${connCreds.token_service_url}/oauth/token`, connCreds.clientid, connCreds.clientsecret);
    headers['Proxy-Authorization'] = `Bearer ${connToken}`;
    headers['SAP-Connectivity-SCC-Location_ID'] = cfg?.CloudConnectorLocationId || '';
    proxyHost = connCreds.onpremise_proxy_host;
    proxyPort = connCreds.onpremise_proxy_port;
  }

  const res = await request(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    proxyHost,
    proxyPort
  });

  if (res.status >= 400) throw new Error(`HTTP ${res.status} from ${url}: ${res.text.substring(0, 300)}`);
  // Return raw text if not JSON
  try { return JSON.parse(res.text); } catch { return res.text; }
}
