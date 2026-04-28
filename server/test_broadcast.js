async function test() {
  const accountId = "359365cd-d9fa-4c59-bf1f-678013bfba25"; // New Account ID
  const templateId = "f97c19a1-442f-4c51-99d6-33342445b468"; // Same Template ID
  const contactId = "1780d557-b063-4b0e-beb0-6fa1c6edef5d"; // Same Contact ID

  const response = await fetch('http://localhost:3001/api/broadcasts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      templateId,
      contactIds: [contactId]
    })
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
