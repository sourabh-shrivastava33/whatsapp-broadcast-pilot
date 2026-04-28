import dotenv from 'dotenv';
dotenv.config();

async function checkToken() {
  const ACCESS_TOKEN = 'EAAeiSgg0ruABRWFA2UZB1iADZByDrbus2rIkZAyTieQLzZBMrYY5soWosTLQn3lqe6ZAMEn7MqQSLYwXqtxjt9mK5kBtmdlyqspt2gmeV5nFN9nlqdQxzwi8ndKHvz1vZBYAiFZCm4a5a6eN3v5efRr1rH75XnoCJxY3y7nICJdHM8MvvBEZCteKZCwJCxipYrSgGisZCZCQb5YZA1QHNZBZBEtQeGKZBTgXvURcqqLtsxmhrt8EtJxktuzaZBizM0sqnaA2tPdrtAqexNZCdNrSFYU7Q69fA';
  
  const res = await fetch(`https://graph.facebook.com/debug_token?input_token=${ACCESS_TOKEN}&access_token=${ACCESS_TOKEN}`);
  const data = await res.json();
  console.log(JSON.stringify(data.data.granular_scopes, null, 2));
}

checkToken();
