import fs from 'fs';
import https from 'https';

const url = 'https://raw.githubusercontent.com/prust/wikipedia-movie-data/master/movies.json';
const path = 'public/movies.json';

https.get(url, (res) => {
    const file = fs.createWriteStream(path);
    res.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('Download completed');
    });
}).on('error', (err) => {
    console.error('Error downloading:', err.message);
});
