async function sync() {
  const accountData = {
    phoneNumberId: "1018091321395233",
    displayPhoneNumber: "+1 555-633-2297",
    verifiedName: "Test Number",
    qualityRating: "GREEN",
    wabaId: "1446327893644967",
    wabaName: "WhatsApp Business Account",
    accessToken: "EAAeiSgg0ruABRWFA2UZB1iADZByDrbus2rIkZAyTieQLzZBMrYY5soWosTLQn3lqe6ZAMEn7MqQSLYwXqtxjt9mK5kBtmdlyqspt2gmeV5nFN9nlqdQxzwi8ndKHvz1vZBYAiFZCm4a5a6eN3v5efRr1rH75XnoCJxY3y7nICJdHM8MvvBEZCteKZCwJCxipYrSgGisZCZCQb5YZA1QHNZBZBEtQeGKZBTgXvURcqqLtsxmhrt8EtJxktuzaZBizM0sqnaA2tPdrtAqexNZCdNrSFYU7Q69fA"
  };

  try {
    const response = await fetch('http://localhost:3001/api/meta/sync-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountData)
    });
    const data = await response.json();
    console.log('Synced:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Sync error:', error);
  }
}

sync();
