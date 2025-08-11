const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
let authToken = '';

// Test configuration
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  role: 'admin'
};

const testItem = {
  name: 'Test Rice',
  uom: 'kg',
  is_active: true
};

async function testAPI() {
  try {
    console.log('🧪 Starting API Tests...\n');

    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Register User
    console.log('\n2. Testing User Registration...');
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
      console.log('✅ User registration passed');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('ℹ️  User already exists, continuing...');
      } else {
        throw error;
      }
    }

    // Test 3: Login
    console.log('\n3. Testing User Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    authToken = loginResponse.data.token;
    console.log('✅ Login passed, token received');

    // Set auth header for subsequent requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    // Test 4: Get Profile
    console.log('\n4. Testing Get Profile...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`);
    console.log('✅ Profile retrieval passed:', profileResponse.data.user.email);

    // Test 5: Create Item
    console.log('\n5. Testing Create Item...');
    const createItemResponse = await axios.post(`${BASE_URL}/items`, testItem);
    const createdItem = createItemResponse.data.item;
    console.log('✅ Item creation passed:', createdItem.name);

    // Test 6: Get All Items
    console.log('\n6. Testing Get All Items...');
    const itemsResponse = await axios.get(`${BASE_URL}/items`);
    console.log('✅ Get items passed, count:', itemsResponse.data.total);

    // Test 7: Get Item by ID
    console.log('\n7. Testing Get Item by ID...');
    const itemResponse = await axios.get(`${BASE_URL}/items/${createdItem.id}`);
    console.log('✅ Get item by ID passed:', itemResponse.data.item.name);

    // Test 8: Update Item
    console.log('\n8. Testing Update Item...');
    const updateResponse = await axios.put(`${BASE_URL}/items/${createdItem.id}`, {
      name: 'Updated Test Rice',
      uom: 'kg'
    });
    console.log('✅ Item update passed:', updateResponse.data.item.name);

    // Test 9: Create Period
    console.log('\n9. Testing Create Period...');
    const currentDate = new Date();
    const periodCode = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    try {
      const periodResponse = await axios.post(`${BASE_URL}/periods`, {
        code: periodCode
      });
      console.log('✅ Period creation passed:', periodResponse.data.period.code);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('ℹ️  Period already exists, continuing...');
      } else {
        throw error;
      }
    }

    // Test 10: Get All Periods
    console.log('\n10. Testing Get All Periods...');
    const periodsResponse = await axios.get(`${BASE_URL}/periods`);
    console.log('✅ Get periods passed, count:', periodsResponse.data.periods.length);

    // Test 11: Test Invalid UUID
    console.log('\n11. Testing Invalid UUID Validation...');
    try {
      await axios.get(`${BASE_URL}/items/invalid-uuid`);
      console.log('❌ UUID validation failed - should have rejected invalid UUID');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ UUID validation passed - correctly rejected invalid UUID');
      } else {
        throw error;
      }
    }

    // Test 12: Test Validation Error
    console.log('\n12. Testing Validation Error Handling...');
    try {
      await axios.post(`${BASE_URL}/items`, {
        name: '', // Invalid empty name
        uom: 'kg'
      });
      console.log('❌ Validation failed - should have rejected empty name');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Validation passed - correctly rejected empty name');
      } else {
        throw error;
      }
    }

    // Test 13: Delete Item
    console.log('\n13. Testing Delete Item...');
    const deleteResponse = await axios.delete(`${BASE_URL}/items/${createdItem.id}`);
    console.log('✅ Item deletion passed');

    console.log('\n🎉 All API tests passed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- Authentication: ✅');
    console.log('- Items CRUD: ✅');
    console.log('- Periods: ✅');
    console.log('- Validation: ✅');
    console.log('- Error Handling: ✅');

  } catch (error) {
    console.error('\n❌ API Test Failed:');
    console.error('Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAPI();
}

module.exports = testAPI;
