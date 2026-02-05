# CineSphere

A personalized movie discovery and recommendation platform.

## Features

- **Smart Recommendations**: Tailored suggestions based on your favorite genres.
- **Movie Diary**: Track what you want to watch and what you've seen.
- **Search & Filter**: Find movies and filter by age appropriateness.
- **Firebase Integration**: Real-time sync of your watchlist and profile.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the address shown in the terminal (usually `http://localhost:5173`).

## Firebase Setup

This app expects `__firebase_config` and `__app_id` to be defined globally. If you are running locally, you can replace the Firebase configuration section in `src/App.jsx` with your own config object.
