
const accessToken = 'EAAeiSgg0ruABRWFA2UZB1iADZByDrbus2rIkZAyTieQLzZBMrYY5soWosTLQn3lqe6ZAMEn7MqQSLYwXqtxjt9mK5kBtmdlyqspt2gmeV5nFN9nlqdQxzwi8ndKHvz1vZBYAiFZCm4a5a6eN3v5efRr1rH75XnoCJxY3y7nICJdHM8MvvBEZCteKZCwJCxipYrSgGisZCZCQb5YZA1QHNZBZBEtQeGKZBTgXvURcqqLtsxmhrt8EtJxktuzaZBizM0sqnaA2tPdrtAqexNZCdNrSFYU7Q69fA';
const businessId = '1446327893644967';

async function discover() {
  try {
    const response = await fetch('http://localhost:3001/api/meta/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        accessToken
      })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Discovery error:', error);
  }
}

discover();
