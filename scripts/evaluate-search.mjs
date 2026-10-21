// TOP_API_URL=https://... node scripts/evaluate-search.mjs
// Reviews public test prompts only; no provider response is stored.
const api = new URL(process.env.TOP_API_URL || "https://topsiagent.onrender.com/");
const queries = [
  "ot uchun qizil egar top, 500 ming so‘m atrofida",
  "maktab uchun suv o‘tkazmaydigan ryukzak qidir",
  "O‘zbekistonda Redmi Note 14 telefonini top",
  "menga iPhone 15 telefon kerak, g‘ilof emas",
  "Samsung 55 dyuym televizor kerak",
  "Nike erkaklar yugurish krossovkasi 43 razmer",
  "qizlar uchun qishki kurtka, 300 ming so‘mgacha",
  "ofis uchun simsiz sichqoncha",
  "o‘yin uchun 144Hz monitor",
  "bolalar uchun velosiped, 6 yosh",
  "oq rangli kir yuvish mashinasi",
  "Toshkentda arzonroq muzlatkich qidir",
  "menga iPad kerak emas",
  "biror narsa sotib olmoqchiman",
  "ayollar uchun kundalik sumka",
  "100 ming so‘mgacha telefon quloqchinlari",
  "Lenovo 16GB RAM noutbuk kerak",
  "qahva tayyorlaydigan mashina top",
  "sifatli bolalar aravachasi",
  "erkaklar uchun qora kostyum",
  "Find a Sony noise cancelling headset under $100",
  "Найди недорогой пылесос в Узбекистане",
  "mi-store.uz dan Xiaomi smart soat top",
  "asaxiy.uz saytidan 1TB SSD qidir",
  "oshxona uchun blender, qizil rangda"
];

let successes = 0;
for (const [index, query] of queries.entries()) {
  const start = Date.now();
  try {
    const response = await fetch(new URL("api/search", api), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, history: [] }), signal: AbortSignal.timeout(45000)
    });
    const result = await response.json();
    if (response.ok) successes++;
    console.log(JSON.stringify({ number:index + 1, query, status:response.status,
      ms:Date.now() - start, type:result.type, reply:result.reply,
      products:(result.products || []).map(p => ({title:p.title,price:p.price,currency:p.currency,url:p.url})),
      error:result.error }));
  } catch (error) {
    console.log(JSON.stringify({ number:index + 1, query, ms:Date.now() - start, error:error.message }));
  }
}
console.log(JSON.stringify({ successes, total:queries.length,
  note:"Review relevance, language, retailer links and constraint handling manually." }));
