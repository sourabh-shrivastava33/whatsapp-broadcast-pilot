const token = "EAAbKcC31aZCcBRees6F5ydzJnbZBEBmjSnkp14auJo0oUNfe3SMYY8lfxfZBGK3qccKcMa7vTqvQtfpFyMyW4leCUA3lQrsWVApHeZBTXPlWSZBokI0uaPJKZBgEjuy0wGDjYr15j9nayGJU3aJQ6VAsUy87XfcYoPZA3OC78aOoeNaUThaF8FaXtbZCbhPA6AqZA4IAPjZBqSpvfkHJ4IGuEMXb9AXZB1aHRceZCDzDixNRsGGZCunFoOuAcGTbHzjYx3YAODmb4qvTfFAx4njiaJ9Wm";
const wabaId = "1446327893644967";

async function test() {
  console.log("Fetching WABA status...");
  const response = await fetch(`https://graph.facebook.com/v20.0/${wabaId}?fields=id,name,status,account_review_status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  console.log("WABA Status Result:", JSON.stringify(data, null, 2));
}

test();
