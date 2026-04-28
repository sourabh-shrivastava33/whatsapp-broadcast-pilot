const token = "EAAbKcC31aZCcBRees6F5ydzJnbZBEBmjSnkp14auJo0oUNfe3SMYY8lfxfZBGK3qccKcMa7vTqvQtfpFyMyW4leCUA3lQrsWVApHeZBTXPlWSZBokI0uaPJKZBgEjuy0wGDjYr15j9nayGJU3aJQ6VAsUy87XfcYoPZA3OC78aOoeNaUThaF8FaXtbZCbhPA6AqZA4IAPjZBqSpvfkHJ4IGuEMXb9AXZB1aHRceZCDzDixNRsGGZCunFoOuAcGTbHzjYx3YAODmb4qvTfFAx4njiaJ9Wm";

async function test() {
  console.log("Fetching debug info for token...");
  const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
  const debugData = await debugRes.json();
  console.log("Debug Token Result:", JSON.stringify(debugData, null, 2));
}

test();
