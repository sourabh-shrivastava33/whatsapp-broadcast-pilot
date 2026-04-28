async function discover() {
  const response = await fetch('http://localhost:3001/api/meta/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: '1446327893644967', // WABA ID provided by user
      accessToken: 'EAAeiSgg0ruABReYnvcBoueRRP89QyUJMjOZAPtQfHFFSa5FbCl81g3kauf8CXPJytV0oAq5LxTf9H4Vp4YpTkMpoQZBQZAHXELSZBN93JlVWrZA4Koj2MIXS9NTmQt6MpCAhxjyuslIOYxH0YPChidYuGVPYNwCE23CvxrHu2oXwASKeDscJ4m9yTYrptZBm5ZCeY5ZCi6ujkLZBVd9RyHiA6vBruFMLSFFPxsRyTC7fzYU2PrHgQSsaxZBaZC9gLKZCYw6FUmZBWejmEZBVSMkr2ZBIDwW'
    })
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
discover();
