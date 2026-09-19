const axios = require('axios');

async function test() {
  try {
    // 1. Login to get token
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      mobile: '9999999999', // super admin
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('Got token');

    // 2. Fetch bookings
    const bookingsRes = await axios.get('http://localhost:5000/api/bookings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const bookings = bookingsRes.data;
    if (bookings.length === 0) {
      console.log('No bookings found to test');
      return;
    }
    const booking = bookings[0];
    
    // 3. Try to create report
    const payload = {
      bookingId: booking.id,
      testName: 'Test Name',
      clinicalNotes: '',
      parameters: [],
      reportBranchId: 'some-invalid-id' // Should fail or be ignored based on our fix
    };
    
    const reportRes = await axios.post('http://localhost:5000/api/reports', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Report created:', reportRes.data.id);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
test();
