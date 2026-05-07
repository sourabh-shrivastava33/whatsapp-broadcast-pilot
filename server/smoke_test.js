import { prisma } from './db.js';

const API_URL = 'http://localhost:10000/api';
let cookieHeader = '';
let workspaceId = '';
let userId = '';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(endpoint, method = 'GET', body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (cookieHeader) {
    options.headers['Cookie'] = cookieHeader;
  }
  
  if (workspaceId && !options.headers['X-Workspace-Id']) {
    options.headers['X-Workspace-Id'] = workspaceId;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  
  // Extract cookie if present
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    cookieHeader = setCookie.split(';')[0];
  }

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function runSmokeTest() {
  console.log('🚀 Starting Full Smoke Test...');

  // 1. Reset Database
  console.log('\\n[1] Resetting Database...');
  await prisma.membership.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Database cleared.');

  // 2. Registration
  console.log('\\n[2] Testing Registration (/api/auth/register)...');
  const regRes = await request('/auth/register', 'POST', {
    email: 'smoke@test.com',
    password: 'password123',
    name: 'Smoke Tester'
  });
  
  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  }
  userId = regRes.data.user.id;
  console.log('✅ Registration successful. User ID:', userId);

  // 3. Get Me
  console.log('\\n[3] Testing Get Me (/api/auth/me)...');
  const meRes = await request('/auth/me');
  if (meRes.status !== 200) {
    throw new Error(`Get Me failed: ${JSON.stringify(meRes.data)}`);
  }
  console.log('✅ Get Me successful. Email:', meRes.data.email);

  // 4. Fetch Workspaces
  console.log('\\n[4] Testing Workspaces (/api/auth/workspaces)...');
  const wsRes = await request('/auth/workspaces');
  if (wsRes.status !== 200 || wsRes.data.length === 0) {
    throw new Error(`Fetch Workspaces failed: ${JSON.stringify(wsRes.data)}`);
  }
  workspaceId = wsRes.data[0].id;
  console.log(`✅ Workspaces fetched. Active Workspace ID: ${workspaceId}, Role: ${wsRes.data[0].role}`);

  // 5. Create Secondary Workspace
  console.log('\\n[5] Testing Create Workspace...');
  const createWsRes = await request('/auth/workspaces', 'POST', { name: 'Secondary Workspace' });
  if (createWsRes.status !== 201) {
    throw new Error(`Create Workspace failed: ${JSON.stringify(createWsRes.data)}`);
  }
  console.log('✅ Secondary workspace created successfully.');

  // 6. Test Membership API (List)
  console.log('\\n[6] Testing List Members (/api/members)...');
  const membersRes = await request('/members');
  if (membersRes.status !== 200) {
    throw new Error(`List Members failed: ${JSON.stringify(membersRes.data)}`);
  }
  console.log(`✅ Members listed. Found ${membersRes.data.length} member(s).`);

  // 7. Test Membership API (Invite/Add)
  console.log('\\n[7] Testing Add Member (/api/members/invite)...');
  // First create a dummy user in the DB directly to add them
  const dummyUser = await prisma.user.create({
    data: { email: 'dummy@test.com', passwordHash: 'hash', name: 'Dummy' }
  });
  
  const addRes = await request('/members/invite', 'POST', {
    email: 'dummy@test.com',
    role: 'MEMBER'
  });
  if (addRes.status !== 201) {
    throw new Error(`Add Member failed: ${JSON.stringify(addRes.data)}`);
  }
  const dummyMembershipId = addRes.data.id;
  console.log('✅ Dummy member added successfully.');

  // 8. Test Membership API (Change Role)
  console.log('\\n[8] Testing Change Role (/api/members/:id/role)...');
  const roleRes = await request(`/members/${dummyMembershipId}/role`, 'PATCH', { role: 'ADMIN' });
  if (roleRes.status !== 200) {
    throw new Error(`Change Role failed: ${JSON.stringify(roleRes.data)}`);
  }
  console.log('✅ Role changed to ADMIN successfully.');

  // 9. Test RBAC (Unauthorized Action)
  console.log('\\n[9] Testing RBAC Guard (Deleting last OWNER)...');
  const ownerMembership = membersRes.data.find(m => m.user.email === 'smoke@test.com');
  const delOwnerRes = await request(`/members/${ownerMembership.id}`, 'DELETE');
  if (delOwnerRes.status !== 400 && delOwnerRes.status !== 403) {
    // Our business rule blocks removing last owner with 400
    throw new Error(`RBAC test failed, expected 400/403 but got ${delOwnerRes.status}`);
  }
  console.log(`✅ RBAC Guard worked as expected (Status ${delOwnerRes.status}): ${delOwnerRes.data.error}`);

  // 10. Logout
  console.log('\\n[10] Testing Logout (/api/auth/logout)...');
  const logoutRes = await request('/auth/logout', 'POST');
  if (logoutRes.status !== 200) {
    throw new Error(`Logout failed: ${JSON.stringify(logoutRes.data)}`);
  }
  console.log('✅ Logout successful.');

  console.log('\\n🎉 All Smoke Tests Passed Successfully! 🎉');
}

runSmokeTest()
  .catch(err => {
    console.error('\\n❌ Smoke Test Failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
