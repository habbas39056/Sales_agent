const db = require('./db');
const http = require('http');

async function test() {
  try {
    await db.query('UPDATE projects SET revision_cycles_remaining = 0 WHERE id = 2');
    console.log('Set revision_cycles_remaining to 0');
    
    const req = http.request('http://localhost:5000/api/projects/2/request-revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', data);
        process.exit(0);
      });
    });
    
    req.write(JSON.stringify({
      title: 'Revision for Step: Your Wessite revision',
      description: 'Test desc',
      step_id: 2,
      image_url: ''
    }));
    req.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
