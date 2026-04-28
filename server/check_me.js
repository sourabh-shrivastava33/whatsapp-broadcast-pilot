const token =
  "EAAbKcC31aZCcBRees6F5ydzJnbZBEBmjSnkp14auJo0oUNfe3SMYY8lfxfZBGK3qccKcMa7vTqvQtfpFyMyW4leCUA3lQrsWVApHeZBTXPlWSZBokI0uaPJKZBgEjuy0wGDjYr15j9nayGJU3aJQ6VAsUy87XfcYoPZA3OC78aOoeNaUThaF8FaXtbZCbhPA6AqZA4IAPjZBqSpvfkHJ4IGuEMXb9AXZB1aHRceZCDzDixNRsGGZCunFoOuAcGTbHzjYx3YAODmb4qvTfFAx4njiaJ9Wm";

async function test() {
  console.log("Checking token permissions via /me...");
  const response = await fetch(
    `https://graph.facebook.com/v20.0/me?fields=id,name`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await response.json();
  console.log("Token Info Result:", JSON.stringify(data, null, 2));

  console.log("\nChecking associated accounts via /me/accounts...");
  const accountsRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const accountsData = await accountsRes.json();
  console.log("Accounts Result:", JSON.stringify(accountsData, null, 2));
}

test();
