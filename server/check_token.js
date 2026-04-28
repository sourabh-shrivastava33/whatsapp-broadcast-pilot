import dotenv from 'dotenv';
dotenv.config();

async function checkToken() {
  const ACCESS_TOKEN = 'EAAeiSgg0ruABRWFA2UZB1iADZByDrbus2rIkZAyTieQLzZBMrYY5soWosTLQn3lqe6ZAMEn7MqQSLYwXqtxjt9mK5kBtmdlyqspt2gmeV5nFN9nlqdQxzwi8ndKHvz1vZBYAiFZCm4a5a6eN3v5efRr1rH75XnoCJxY3y7nICJdHM8MvvBEZCteKZCwJCxipYrSgGisZCZCQb5YZA1QHNZBZBEtQeGKZBTgXvURcqqLtsxmhrt8EtJxktuzaZBizM0sqnaA2tPdrtAqexNZCdNrSFYU7Q69fA';
  
  console.log('Checking token permissions...');
  const res1 = await fetch('https://graph.facebook.com/v20.0/me?fields=id,name', {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  });
  console.log('Me:', await res1.json());

  console.log('Checking debug_token...');
  const res2 = await fetch(`https://graph.facebook.com/debug_token?input_token=${ACCESS_TOKEN}&access_token=${ACCESS_TOKEN}`);
  console.log('Debug Token:', await res2.json());
  
  const PHONE_NUMBER_ID = '1018091321395233';
  console.log(`Checking Phone Number ${PHONE_NUMBER_ID}...`);
  const res3 = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  });
  console.log('Phone Data:', await res3.json());
}

checkToken();
