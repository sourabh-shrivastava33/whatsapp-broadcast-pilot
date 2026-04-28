async function run() {
  const WABA_ID = '1446327893644967';
  const TOKEN = 'EAAeiSgg0ruABWF8NZCQ8BaBjWTC7Dd4SEUvCSfvcUKQD5Bok7VkVomyLXkYTrZANZCeY0zaDY0raGVARM5ZBhhZBo5E98aR4Plbsw3K9WSZBnxFck4e8ZBrOhdzZC9VqMJidm5EJ3R76AfZBRJVVtZBbFyJndxjxoVfd7aTzmbheWhraY72ZCsLnS1bLQtba25PZCPfe7P8nRR3ysW02a2cRi379BCVmVpKKy4S0RyW7YQrDIYzcGVOeLXoUU5nlTjurx8rsrZBpbDJjZCbETWGgki2X5'.trim();

  console.log('1. Discovering numbers...');
  const res1 = await fetch(`https://graph.facebook.com/v20.0/${WABA_ID}/phone_numbers`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data1 = await res1.json();
  if (data1.error) { console.error('Discovery failed:', JSON.stringify(data1.error, null, 2)); return; }
  
  const phone = data1.data[0];
  console.log('Found:', phone.display_phone_number);

  const syncPayload = {
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number,
    verifiedName: phone.verified_name || 'WhatsApp Business Account',
    qualityRating: phone.quality_rating,
    wabaId: WABA_ID,
    wabaName: 'WhatsApp Business Account',
    accessToken: TOKEN
  };

  console.log('2. Syncing account...');
  const res2 = await fetch('http://localhost:3001/api/meta/sync-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload)
  });
  const account = await res2.json();
  console.log('Account synced:', account.id);
  
  const fs = require('fs');
  fs.writeFileSync('test_state.json', JSON.stringify({ accountId: account.id }));
}
run();
