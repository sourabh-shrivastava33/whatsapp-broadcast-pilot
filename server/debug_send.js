import dotenv from 'dotenv';
dotenv.config();

async function debugSend() {
  const PHONE_NUMBER_ID = '1018091321395233';
  const ACCESS_TOKEN = 'EAAeiSgg0ruABRWFA2UZB1iADZByDrbus2rIkZAyTieQLzZBMrYY5soWosTLQn3lqe6ZAMEn7MqQSLYwXqtxjt9mK5kBtmdlyqspt2gmeV5nFN9nlqdQxzwi8ndKHvz1vZBYAiFZCm4a5a6eN3v5efRr1rH75XnoCJxY3y7nICJdHM8MvvBEZCteKZCwJCxipYrSgGisZCZCQb5YZA1QHNZBZBEtQeGKZBTgXvURcqqLtsxmhrt8EtJxktuzaZBizM0sqnaA2tPdrtAqexNZCdNrSFYU7Q69fA';
  const RECIPIENT = '+917000446325';
  
  console.log(`Attempting to send hello_world to ${RECIPIENT}...`);
  
  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: RECIPIENT,
      type: "template",
      template: {
        name: "hello_world",
        language: { code: "en_US" }
      }
    })
  });
  
  const data = await res.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

debugSend();
