async function test() {
  const body = "Welcome to our premium WhatsApp broadcast service. We are excited to have you with us. Hello {{1}}, your personalized access code for today is {{2}}. Please keep this code safe and do not share it with anyone. Thank you for choosing Antigravity.";
  
  // 1. Create
  const res1 = await fetch('http://localhost:3001/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'tpl_long_' + Math.floor(Math.random()*10000),
      body: body,
      category: 'MARKETING',
      language: 'en_US',
      variables: [
        { num: '1', sample: 'John' },
        { num: '2', sample: 'ABC-123' }
      ]
    })
  });
  const tpl = await res1.json();
  console.log('Created:', tpl.id);

  // 2. Submit
  const res2 = await fetch(`http://localhost:3001/api/templates/${tpl.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const result = await res2.json();
  console.log('Submit Result:', JSON.stringify(result, null, 2));
}
test();
