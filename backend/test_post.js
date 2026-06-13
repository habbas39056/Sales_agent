const http = require('http');

const data = JSON.stringify({
  full_name: 'Test Client',
  email: 'test' + Date.now() + '@example.com',
  password: 'password123',
  business_name: '',
  whatsapp_number: '',
  physical_address: '',
  profile_image_url: ''
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/clients',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${body}`);
  });
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
