const axios = require('axios');

async function test() {
  try {
    const dataToSend = {
      invoice_number: `INV-TEST-${Date.now()}`,
      client_id: 1, // Assumes client 1 exists
      project_id: null,
      agent_id: 1, // Assumes agent 1 exists
      commission_amount: 15.50,
      issue_date: '2026-06-12',
      due_date: '2026-06-19',
      terms_and_conditions: 'Test',
      items: [
        { description: 'Test', quantity: 1, unit_price: 100 }
      ],
      discount: 0
    };
    const res = await axios.post('http://localhost:5000/api/invoices', dataToSend);
    console.log(res.data);
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
  }
}
test();
