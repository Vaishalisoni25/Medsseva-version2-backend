const axios = require('axios');

async function test() {
  try {
    console.log('Sending request...');
    const res = await axios.post('http://192.168.1.33:5000/api/auth/login', {
      mobile: '9131484529',
      password: ''
    });
    console.log('Response:', res.data);
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error data:', err.response?.data);
  }
}

test();
