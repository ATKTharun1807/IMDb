import fs from 'fs';

const movies = [];
for (let i = 1; i <= 20000; i++) {
    movies.push({
        title: "Movie " + i,
        year: 2000 + (i % 24),
        genres: ["Drama"],
        extract: "Plot for movie " + i,
        thumbnail: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=800"
    });
}

fs.writeFileSync('public/movies.json', JSON.stringify(movies));
console.log("DONE");
