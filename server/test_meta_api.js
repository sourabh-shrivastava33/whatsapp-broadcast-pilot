
const token = "EAAbKcC31aZCcBRees6F5ydzJnbZBEBmjSnkp14auJo0oUNfe3SMYY8lfxfZBGK3qccKcMa7vTqvQtfpFyMyW4leCUA3lQrsWVApHeZBTXPlWSZBokI0uaPJKZBgEjuy0wGDjYr15j9nayGJU3aJQ6VAsUy87XfcYoPZA3OC78aOoeNaUThaF8FaXtbZCbhPA6AqZA4IAPjZBqSpvfkHJ4IGuEMXb9AXZB1aHRceZCDzDixNRsGGZCunFoOuAcGTbHzjYx3YAODmb4qvTfFAx4njiaJ9Wm";
const wabaId = "1446327893644967";

async function test() {
  console.log("Testing WABA ID direct fetch...");
  const response = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  console.log("Direct Fetch Result:", JSON.stringify(data, null, 2));

  console.log("\nTesting Owned WABA fetch...");
  const ownedRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/owned_whatsapp_business_accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const ownedData = await ownedRes.json();
  console.log("Owned WABA Result:", JSON.stringify(ownedData, null, 2));
}

test();
