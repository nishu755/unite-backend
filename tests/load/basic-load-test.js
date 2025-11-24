import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const failureRate = new Rate('failed_requests');
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.05'], // Error rate should be less than 5%
    failed_requests: ['rate<0.05'],
  },
};

// Test data
const testUser = {
  email: `test${Date.now()}@example.com`,
  password: 'TestPass123!',
  role: 'agent',
  phone: '+1234567890'
};

let authToken = '';

export function setup() {
  // Register a test user
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify(testUser),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    return { token: body.data.accessToken };
  }

  // If registration fails, try logging in
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: testUser.email,
      password: testUser.password
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.data.accessToken };
  }

  console.error('Failed to setup test user');
  return { token: '' };
}

export default function (data) {
  const token = data.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Test 1: Health Check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || failureRate.add(1);

  sleep(1);

  // Test 2: Get Current User
  const meRes = http.get(`${BASE_URL}/api/auth/me`, { headers });
  check(meRes, {
    'get user status is 200': (r) => r.status === 200,
  }) || failureRate.add(1);

  sleep(1);

  // Test 3: Create Lead
  const leadData = {
    name: `Test Lead ${Date.now()}`,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    email: `lead${Date.now()}@example.com`,
    source: 'load_test',
    status: 'new'
  };

  const createLeadRes = http.post(
    `${BASE_URL}/api/leads`,
    JSON.stringify(leadData),
    { headers }
  );

  let leadId;
  const createLeadSuccess = check(createLeadRes, {
    'create lead status is 201': (r) => r.status === 201,
    'create lead response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (createLeadSuccess && createLeadRes.status === 201) {
    const body = JSON.parse(createLeadRes.body);
    leadId = body.data.id;
  } else {
    failureRate.add(1);
  }

  sleep(1);

  // Test 4: Get All Leads
  const getLeadsRes = http.get(`${BASE_URL}/api/leads?page=1&limit=20`, { headers });
  check(getLeadsRes, {
    'get leads status is 200': (r) => r.status === 200,
    'get leads response time < 300ms': (r) => r.timings.duration < 300,
  }) || failureRate.add(1);

  sleep(1);

  // Test 5: Get Lead by ID (if created)
  if (leadId) {
    const getLeadRes = http.get(`${BASE_URL}/api/leads/${leadId}`, { headers });
    check(getLeadRes, {
      'get lead by id status is 200': (r) => r.status === 200,
    }) || failureRate.add(1);

    sleep(1);

    // Test 6: Update Lead
    const updateData = {
      status: 'contacted',
      notes: 'Updated via load test'
    };

    const updateLeadRes = http.put(
      `${BASE_URL}/api/leads/${leadId}`,
      JSON.stringify(updateData),
      { headers }
    );

    check(updateLeadRes, {
      'update lead status is 200': (r) => r.status === 200,
    }) || failureRate.add(1);
  }

  sleep(2);

  // Test 7: Get Lead Stats (Admin/Manager only, might fail for agents)
  const statsRes = http.get(`${BASE_URL}/api/leads/stats`, { headers });
  // Don't count as failure since agents can't access this

  sleep(1);

  // Test 8: Get My Tasks
  const myTasksRes = http.get(`${BASE_URL}/api/call-tasks/my-tasks`, { headers });
  check(myTasksRes, {
    'get my tasks status is 200': (r) => r.status === 200,
  }) || failureRate.add(1);

  sleep(1);

  // Test 9: Get Daily Summary Report
  const today = new Date().toISOString().split('T')[0];
  const summaryRes = http.get(
    `${BASE_URL}/api/reports/daily-summary?date=${today}`,
    { headers }
  );
  // Might return 403 for agents, so don't count as failure

  sleep(2);
}

export function teardown(data) {
  // Cleanup logic if needed
  console.log('Load test completed');
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let output = `\n${indent}Load Test Summary:\n`;
  output += `${indent}================\n\n`;

  // HTTP metrics
  const httpReqDuration = data.metrics.http_req_duration;
  if (httpReqDuration) {
    output += `${indent}HTTP Request Duration:\n`;
    output += `${indent}  avg: ${httpReqDuration.values.avg.toFixed(2)}ms\n`;
    output += `${indent}  min: ${httpReqDuration.values.min.toFixed(2)}ms\n`;
    output += `${indent}  max: ${httpReqDuration.values.max.toFixed(2)}ms\n`;
    output += `${indent}  p(95): ${httpReqDuration.values['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  p(99): ${httpReqDuration.values['p(99)'].toFixed(2)}ms\n\n`;
  }

  // Request count
  const httpReqs = data.metrics.http_reqs;
  if (httpReqs) {
    output += `${indent}Total HTTP Requests: ${httpReqs.values.count}\n`;
    output += `${indent}Requests/sec: ${httpReqs.values.rate.toFixed(2)}\n\n`;
  }

  // Failure rate
  const failedReqs = data.metrics.http_req_failed;
  if (failedReqs) {
    const failurePercentage = (failedReqs.values.rate * 100).toFixed(2);
    output += `${indent}Failed Requests: ${failurePercentage}%\n\n`;
  }

  // VUs
  const vus = data.metrics.vus;
  if (vus) {
    output += `${indent}Virtual Users:\n`;
    output += `${indent}  min: ${vus.values.min}\n`;
    output += `${indent}  max: ${vus.values.max}\n\n`;
  }

  return output;
}