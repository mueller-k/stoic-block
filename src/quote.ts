const quotes = [
  { text: 'Attend to the matter which is before thee, whether it is an opinion or an act or a word.', author: 'Marcus Aurelius', work: 'Meditations', locator: '8.22', translator: 'George Long' },
  { text: 'Let no act be done without a purpose, nor otherwise than according to the perfect principles of art.', author: 'Marcus Aurelius', work: 'Meditations', locator: '4.2', translator: 'George Long' },
  { text: 'Look within. Let neither the peculiar quality of anything nor its value escape thee.', author: 'Marcus Aurelius', work: 'Meditations', locator: '6.3', translator: 'George Long' },
  { text: 'Require not Things to happen as you wish; but wish them to happen as they do happen; and you will go on well.', author: 'Epictetus', work: 'Enchiridion', locator: '8', translator: 'Elizabeth Carter' },
  { text: 'Begin therefore from little Things.', author: 'Epictetus', work: 'Enchiridion', locator: '12', translator: 'Elizabeth Carter' },
  { text: 'Lay hold of to-day’s task, and you will not need to depend so much upon to-morrow’s.', author: 'Seneca', work: 'Moral Letters to Lucilius', locator: '1.2', translator: 'Richard M. Gummere' },
  { text: 'There is nothing so efficacious that it can be helpful while it is being shifted about.', author: 'Seneca', work: 'Moral Letters to Lucilius', locator: '2.3', translator: 'Richard M. Gummere' },
  { text: 'No good thing is pleasant to possess, without friends to share it.', author: 'Seneca', work: 'Moral Letters to Lucilius', locator: '6.4', translator: 'Richard M. Gummere' },
];

// Reject the incomplete tail so every quote has exactly the same probability.
const range = 2 ** 32;
const limit = range - range % quotes.length;
const random = new Uint32Array(1);
do crypto.getRandomValues(random); while (random[0] >= limit);
const quote = quotes[random[0] % quotes.length];
document.querySelector('#quote-text')!.textContent = quote.text;
document.querySelector('#quote-author')!.textContent = quote.author;
document.querySelector('#quote-work')!.textContent = quote.work;
document.querySelector('#quote-locator')!.textContent = quote.locator;
document.querySelector('#quote-translator')!.textContent = `Translated by ${quote.translator}`;
