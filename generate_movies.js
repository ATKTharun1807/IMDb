import fs from 'fs';

const movies = [];
const genres = ["Action", "Sci-Fi", "Drama", "Crime", "Animation", "Thriller", "Adventure", "Family", "Comedy", "Horror", "Mystery", "Romance", "Fantasy"];
const adjectives = ["The Last", "Great", "Silent", "Shadow", "Lost", "Golden", "Dark", "Bright", "Secret", "Forbidden"];
const nouns = ["Warrior", "Kingdom", "Quest", "Legacy", "Star", "World", "Heart", "Journey", "Dream", "Night"];

for (let i = 1; i <= 20000; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const g = genres[Math.floor(Math.random() * genres.length)];

    movies.push({
        title: `${adj} ${noun} ${i}`,
        year: 1950 + Math.floor(Math.random() * 75),
        genres: [g],
        extract: `In this ${g} adventure, a hero must find the ${noun} to save the ${adj} world.`,
        thumbnail: `https://images.unsplash.com/photo-${1485846234645 + i % 1000}-a62644f84728?auto=format&fit=crop&q=80&w=800`
    });
}

fs.writeFileSync('public/movies.json', JSON.stringify(movies, null, 2));
console.log('Generated 20,000 movies');
