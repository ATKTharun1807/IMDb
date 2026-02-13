import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Bookmark,
    CheckCircle,
    Clock,
    Star,
    Info,
    User,
    Settings,
    Film,
    Flame,
    Filter,
    Plus,
    X,
    ChevronRight,
    ShieldCheck,
    TrendingUp,
    Heart,
    LogIn,
    LogOut,
    Mail,
    Github,
    Ticket,
    Tv,
    ExternalLink,
    MapPin,
    Play,
    List,
    Clock3
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    query,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile as updateAuthProfile,
    signOut
} from 'firebase/auth';

// --- Environment Variable Validation ---
const requiredEnv = [
    'VITE_FIREBASE_API_KEY',
    'VITE_TMDB_API_KEY'
];
const missingEnv = requiredEnv.filter(key => !import.meta.env[key]);

if (missingEnv.length > 0 && import.meta.env.MODE === 'production') {
    console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
}

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = 'cinesphere-app';

// --- TMDB API Configuration ---
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

const GENRES = ["Action", "Sci-Fi", "Drama", "Crime", "Animation", "Thriller", "Adventure", "Family", "Comedy", "Horror", "Mystery", "Romance", "Fantasy"];
const GENRE_MAP = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western"
};

export default function App() {
    const [user, setUser] = useState(null);
    const [authStatus, setAuthStatus] = useState('loading'); // loading, unauthenticated, authenticated
    const [watchlist, setWatchlist] = useState([]);
    const [userProfile, setUserProfile] = useState({
        name: "Cinephile",
        favoriteGenres: [],
        ageSafe: false,
    });
    const [movies, setMovies] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [similarMovies, setSimilarMovies] = useState([]);
    const [watchProviders, setWatchProviders] = useState(null);
    const [providerRegion, setProviderRegion] = useState(null); // 'IN' or 'Global'
    const [theatricalStatus, setTheatricalStatus] = useState(null);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [activeTab, setActiveTab] = useState("discover");
    const [error, setError] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [trailerKey, setTrailerKey] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState(null); // 'ta', 'te', 'hi', etc.
    const [autoPlayNextMovie, setAutoPlayNextMovie] = useState(false);
    const [movieCredits, setMovieCredits] = useState(null);
    const [runtime, setRuntime] = useState(null);
    const [tagline, setTagline] = useState(null);

    // Email Auth States
    const [authMode, setAuthMode] = useState('landing'); // landing, login, register
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    if (missingEnv.length > 0) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
                <div className="mb-6 rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/50">
                    <Info className="mx-auto mb-2 h-8 w-8 text-red-500" />
                    <h2 className="text-xl font-bold">Configuration Missing</h2>
                    <p className="mt-2 text-slate-400">Please set the following environment variables in your deployment settings:</p>
                    <ul className="mt-4 flex flex-wrap justify-center gap-2">
                        {missingEnv.map(env => (
                            <li key={env} className="rounded-md bg-slate-900 px-3 py-1 text-xs font-mono text-indigo-400 ring-1 ring-slate-800">{env}</li>
                        ))}
                    </ul>
                </div>
                <p className="max-w-md text-sm text-slate-500">
                    If you are seeing this on Netlify, go to <b>Site Settings &gt; Environment Variables</b> and add the keys from your .env file.
                </p>
            </div>
        );
    }

    // --- Auth Listeners ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currUser) => {
            if (currUser) {
                setUser(currUser);
                setAuthStatus('authenticated');
                if (currUser.displayName && !userProfile.name) {
                    setUserProfile(prev => ({ ...prev, name: currUser.displayName }));
                }
            } else {
                setUser(null);
                setAuthStatus('unauthenticated');
            }
        });
        return () => unsubscribe();
    }, []);

    // --- TMDB Data Fetchers ---
    const mapTMDBMovie = (m) => ({
        id: m.id,
        title: m.title || m.name,
        year: (m.release_date || m.first_air_date || "").split('-')[0],
        rating: parseFloat(m.vote_average?.toFixed(1) || 0),
        genres: m.genre_ids?.map(id => GENRE_MAP[id]).filter(Boolean) || ["Drama"],
        ageRating: m.adult ? "R" : "PG-13",
        poster: m.poster_path ? `${TMDB_IMAGE_BASE_URL}${m.poster_path}` : "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=800",
        backdrop: m.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${m.backdrop_path}` : null,
        plot: m.overview || "No description available."
    });

    const fetchTrending = async () => {
        try {
            setIsDataLoading(true);
            const response = await fetch(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}`);
            const data = await response.json();
            setMovies(data.results.map(mapTMDBMovie));
        } catch (err) {
            console.error("Failed to fetch trending movies:", err);
            setError("Failed to load trending movies.");
        } finally {
            setIsDataLoading(false);
        }
    };

    const getDirectProviderLink = (providerName, movieTitle, movieYear) => {
        const query = encodeURIComponent(movieTitle);
        const name = providerName.toLowerCase();

        // India-specific & Global OTT Search URL mapping - Refined with Regional Fallbacks
        if (name.includes('netflix')) return `https://www.netflix.com/search?q=${query}`;

        // Prime Video: use the direct search endpoint, fallback to global if local fails
        if (name.includes('prime') || name.includes('amazon')) {
            return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${movieTitle}`;
        }

        // Hotstar: region-specific search tends to be more accurate, fallback to Global Disney+
        if (name.includes('hotstar') || name.includes('disney')) {
            return `https://www.hotstar.com/in/explore?search_query=${query}`;
        }

        // Apple TV: Indian store specific search, fallback to US store if needed via platform redirect
        if (name.includes('apple')) {
            return `https://tv.apple.com/in/search?term=${query}`;
        }

        // Zee5: Standard search
        if (name.includes('zee5')) {
            return `https://www.zee5.com/search?q=${query}`;
        }

        // Global fallback for international discovery - JustWatch is great for regional checks
        if (name.includes('justwatch')) {
            return `https://www.justwatch.com/in/search?q=${query}`;
        }

        if (name.includes('google')) return `https://play.google.com/store/search?q=${query}&c=movies`;
        if (name.includes('youtube')) return `https://www.youtube.com/results?search_query=${query}+movie`;
        if (name.includes('jiocinema')) return `https://www.jiocinema.com/search/${query}`;
        if (name.includes('sony')) return `https://www.sonyliv.com/search?q=${query}`;

        // ULTIMATE REGIONAL FALLBACK: If movie isn't in local region, use a global discovery query
        return `https://www.google.com/search?q=where+to+watch+${query}+${movieYear}+online+streaming`;
    };

    const searchMovies = async (query) => {
        if (!query) {
            fetchTrending();
            return;
        }
        try {
            setIsDataLoading(true);
            const response = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
            const data = await response.json();
            setMovies(data.results.map(mapTMDBMovie));
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setIsDataLoading(false);
        }
    };

    const fetchMovieDetails = async (movieId) => {
        if (!movieId) return;
        try {
            setIsDetailsLoading(true);
            const headers = { 'Accept': 'application/json' };

            // Parallel fetch for speed
            const [recommendationsRes, providersRes, releasesRes, videosRes, detailsRes, creditsRes] = await Promise.all([
                fetch(`${TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}`, { headers }),
                fetch(`${TMDB_BASE_URL}/movie/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`, { headers }),
                fetch(`${TMDB_BASE_URL}/movie/${movieId}/release_dates?api_key=${TMDB_API_KEY}`, { headers }),
                fetch(`${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`, { headers }),
                fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`, { headers }),
                fetch(`${TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`, { headers })
            ]);

            const [recData, provData, relData, videoData, detailsData, creditsData] = await Promise.all([
                recommendationsRes.json(),
                providersRes.json(),
                releasesRes.json(),
                videosRes.json(),
                detailsRes.json(),
                creditsRes.json()
            ]);

            setRuntime(detailsData.runtime);
            setTagline(detailsData.tagline);
            setMovieCredits(creditsData);

            // Set Similar
            setSimilarMovies(recData.results?.map(mapTMDBMovie).slice(0, 6) || []);

            // Set Trailer
            const trailer = videoData.results?.find(v => v.type === "Trailer" && v.site === "YouTube") ||
                videoData.results?.find(v => v.site === "YouTube") ||
                videoData.results?.[0];

            const finalKey = trailer?.site === "YouTube" ? trailer?.key : null;
            setTrailerKey(finalKey);

            if (finalKey && autoPlayNextMovie) {
                setShowTrailer(true);
                setAutoPlayNextMovie(false);
            }

            // Deduplicate providers by name (e.g. Amazon Prime & Amazon Video)
            const deduplicate = (list) => {
                const seen = new Set();
                return (list || []).filter(p => {
                    const name = p.provider_name.toLowerCase().replace('amazon', 'prime');
                    if (seen.has(name)) return false;
                    seen.add(name);
                    return true;
                });
            };

            // Set Providers with Region Tracking
            const inProviders = provData.results?.IN;
            const usProviders = provData.results?.US;
            const providers = inProviders || usProviders;
            const region = inProviders ? 'IN' : (usProviders ? 'Global' : null);

            const availableProviders = providers ? {
                streaming: deduplicate(providers.flatrate),
                rent: deduplicate(providers.rent),
                buy: deduplicate(providers.buy),
                link: providers.link
            } : null;

            setWatchProviders(availableProviders);
            setProviderRegion(region);

            // Set Theatrical Status
            const indianReleases = relData.results?.find(r => r.iso_3166_1 === 'IN') || relData.results?.find(r => r.iso_3166_1 === 'US');
            const latestRelease = indianReleases?.release_dates?.sort((a, b) => new Date(b.release_date) - new Date(a.release_date))[0];

            if (latestRelease) {
                const releaseDate = new Date(latestRelease.release_date);
                const now = new Date();
                let status = "Released";
                if (releaseDate > now) status = "Upcoming";
                else if (now.getTime() - releaseDate.getTime() < 30 * 24 * 60 * 60 * 1000) status = "In Theaters";

                setTheatricalStatus({
                    date: releaseDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                    status: status,
                    type: latestRelease.type // 3 is theatrical
                });
            } else {
                setTheatricalStatus(null);
            }

        } catch (err) {
            console.error("Failed to fetch movie details:", err);
        } finally {
            setIsDetailsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMovie) {
            // Reset modal states to prevent showing old movie data while loading
            setTrailerKey(null);
            setShowTrailer(false);
            setWatchProviders(null);
            setTheatricalStatus(null);
            setSimilarMovies([]);
            setMovieCredits(null);
            setRuntime(null);
            setTagline(null);
            fetchMovieDetails(selectedMovie.id);
        } else {
            setSimilarMovies([]);
            setWatchProviders(null);
            setTheatricalStatus(null);
            setTrailerKey(null);
            setShowTrailer(false);
            setAutoPlayNextMovie(false);
            setMovieCredits(null);
            setRuntime(null);
            setTagline(null);
        }
    }, [selectedMovie]);

    useEffect(() => {
        fetchTrending();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search) {
                searchMovies(search);
            } else {
                fetchTrending();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // --- Data Sync Logic ---
    useEffect(() => {
        if (!user) return;

        // Listen to Watchlist
        const watchlistRef = collection(db, 'artifacts', appId, 'users', user.uid, 'watchlist');
        const unsubWatchlist = onSnapshot(watchlistRef, (snap) => {
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWatchlist(list);
        }, (err) => console.error("Watchlist snap error:", err));

        // Listen to Profile
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
        const unsubProfile = onSnapshot(profileRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setUserProfile(prev => ({
                    ...prev,
                    ...data,
                    favoriteGenres: Array.isArray(data.favoriteGenres) ? data.favoriteGenres : []
                }));
            }
        }, (err) => console.error("Profile snap error:", err));

        return () => {
            unsubWatchlist();
            unsubProfile();
        };
    }, [user]);

    // --- Auth Handlers ---
    const handleGoogleLogin = async () => {
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            setError("Failed to sign in with Google. Please try again.");
        }
    };

    const handleGuestLogin = async () => {
        setError(null);
        try {
            await signInAnonymously(auth);
        } catch (err) {
            setError("Guest login unavailable.");
        }
    };

    const handleEmailRegister = async (e) => {
        e.preventDefault();
        setError(null);
        setIsAuthLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateAuthProfile(userCredential.user, { displayName });
            setUserProfile(prev => ({ ...prev, name: displayName }));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setIsAuthLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setActiveTab("discover");
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    // --- Recommendation Logic ---
    const recommendations = useMemo(() => {
        if (!movies.length) return [];
        return movies
            .filter(movie => {
                if (watchlist.some(w => w.movieId === movie.id)) return false;
                if (userProfile.ageSafe && movie.ageRating === "R") return false;
                return true;
            })
            .map(movie => {
                let score = movie.rating;
                const favs = userProfile.favoriteGenres || [];
                movie.genres.forEach(g => {
                    if (favs.includes(g)) score += 5; // Increased boost
                });
                return { ...movie, score };
            })
            .sort((a, b) => b.score - a.score);
    }, [movies, userProfile, watchlist]);

    const filteredMovies = useMemo(() => {
        return movies.filter(m => {
            const matchesAge = userProfile.ageSafe ? m.ageRating !== "R" : true;
            const matchesGenre = selectedGenre ? m.genres.includes(selectedGenre) : true;
            return matchesAge && matchesGenre;
        });
    }, [movies, userProfile.ageSafe, selectedGenre]);

    // --- Actions ---
    const toggleWatchlist = async (movie, status = "Watchlist") => {
        if (!user) return;
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'watchlist', movie.id.toString());
        const existing = watchlist.find(w => w.movieId === movie.id);

        if (existing && existing.status === status) {
            await deleteDoc(docRef);
        } else {
            await setDoc(docRef, {
                movieId: movie.id,
                title: movie.title,
                poster: movie.poster,
                status: status,
                timestamp: Date.now()
            });
        }
    };

    const updateProfile = async (updates) => {
        if (!user) return;
        // Optimistic update
        setUserProfile(prev => ({ ...prev, ...updates }));
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
        await setDoc(docRef, { ...userProfile, ...updates });
    };

    // --- Loading State ---
    if (authStatus === 'loading') {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
                <Film className="h-12 w-12 animate-pulse text-indigo-500" />
            </div>
        );
    }

    // --- Unauthenticated Screen ---
    if (authStatus === 'unauthenticated') {
        // Mix current movies with diverse fallbacks to ensure the background is never a "single image"
        const trendingPosters = movies.length > 5
            ? movies.slice(0, 20).map(m => m.poster)
            : []; // Let Background component handle the diverse fallback if movies are few

        return (
            <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white overflow-hidden">
                <Background showMarquee={true} marqueePosters={trendingPosters} />

                <div className="z-10 w-full max-w-md space-y-8 text-center">
                    <div className="flex flex-col items-center gap-6">
                        <div className="group relative">
                            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 opacity-75 blur transition duration-1000 group-hover:opacity-100 group-hover:duration-200"></div>
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 shadow-2xl">
                                <Film className="h-10 w-10 text-indigo-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">CINE<span className="text-indigo-500 text-glow">SPHERE</span></h1>
                            <p className="text-sm font-medium text-slate-400">Your cinematic journey starts here.</p>
                        </div>
                    </div>

                    <div className="glass-panel overflow-hidden rounded-3xl p-8 shadow-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl">
                        {authMode === 'landing' && (
                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleLogin}
                                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-6 py-4 font-bold text-slate-950 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100 to-transparent transition-transform duration-500 -translate-x-full group-hover:translate-x-full" />
                                    <svg className="relative h-5 w-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    <span className="relative">Sign in with Google</span>
                                </button>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setAuthMode('register')}
                                        className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600/10 px-6 py-4 font-bold text-indigo-400 ring-1 ring-indigo-500/30 transition-all hover:bg-indigo-600/20"
                                    >
                                        Register
                                    </button>
                                    <button
                                        onClick={() => setAuthMode('login')}
                                        className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-6 py-4 font-bold text-white ring-1 ring-white/10 transition-all hover:bg-white/10"
                                    >
                                        Sign In
                                    </button>
                                </div>

                                <button
                                    onClick={handleGuestLogin}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900/50 px-6 py-4 font-bold text-slate-400 transition-all hover:text-white"
                                >
                                    Continue as Guest
                                </button>
                            </div>
                        )}

                        {(authMode === 'login' || authMode === 'register') && (
                            <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister} className="space-y-4">
                                {authMode === 'register' && (
                                    <div className="space-y-1 text-left">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500/50"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500/50"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500/50"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAuthLoading}
                                    className="w-full rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                                >
                                    {isAuthLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setAuthMode('landing')}
                                    className="text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Back to Options
                                </button>
                            </form>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-2xl bg-red-500/10 p-4 text-xs font-bold text-red-400 ring-1 ring-red-500/20">
                            <Info className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <p className="text-xs text-slate-600">
                        By continuing, you agree to CineSphere's Terms & Privacy Policy.
                    </p>
                </div>
            </div>
        );
    }

    // --- Main App Screen (Authenticated) ---
    return (
        <div className="relative min-h-screen w-full bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30">
            <Background marqueePosters={movies.slice(0, 10).map(m => m.poster)} />

            {/* Navigation */}
            <nav className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <div className="flex cursor-pointer items-center gap-2" onClick={() => setActiveTab('discover')}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600">
                            <Film className="h-5 w-5 text-white" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-white">CineSphere</h1>
                    </div>

                    <div className="hidden items-center gap-8 md:flex">
                        <NavBtn icon={<TrendingUp className="h-4 w-4" />} label="Discover" active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} />
                        <NavBtn icon={<Bookmark className="h-4 w-4" />} label="Diary" active={activeTab === 'watchlist'} onClick={() => setActiveTab('watchlist')} />
                        <NavBtn icon={<User className="h-4 w-4" />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                    </div>

                    <div className="flex items-center gap-4">
                        {user.isAnonymous ? (
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 rounded-lg bg-indigo-600/10 px-3 py-1.5 text-xs font-bold text-indigo-400 ring-1 ring-indigo-500/30 hover:bg-indigo-600/20"
                            >
                                <LogIn className="h-3.5 w-3.5" /> Sign In
                            </button>
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 ring-2 ring-indigo-500/20">
                                {user.photoURL ? <img src={user.photoURL} className="h-full w-full rounded-full" /> : <User className="h-4 w-4 text-slate-400" />}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="relative z-10 mx-auto max-w-7xl px-6 py-8">
                {activeTab === 'discover' && (
                    <div className="space-y-16">
                        {/* Search Bar - Floating */}
                        <div className="flex flex-col items-center gap-8 py-8 md:py-16">
                            <div className="text-center space-y-4 max-w-2xl px-4">
                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase italic">Explore the <span className="text-indigo-500 text-glow">Multiverse</span> of Cinema</h1>
                                <p className="text-slate-400 font-medium">Personalized recommendations powered by real-time TMDB data.</p>
                            </div>
                            <div className="relative w-full max-w-3xl group">
                                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-20 blur transition duration-500 group-focus-within:opacity-50 group-hover:opacity-40" />
                                <div className="relative flex items-center bg-slate-900 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
                                    <Search className="absolute left-5 h-6 w-6 text-indigo-500" />
                                    <input
                                        type="text"
                                        placeholder="What are you in the mood for?"
                                        className="w-full bg-transparent py-6 pl-16 pr-4 text-xl text-white focus:outline-none placeholder:text-slate-600"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} className="absolute right-4 p-2 text-slate-500 hover:text-white transition-colors">
                                            <X className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2 mt-8 max-w-4xl mx-auto px-4">
                                <button
                                    onClick={() => setSelectedGenre(null)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${!selectedGenre ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-900 text-slate-500 hover:text-slate-300 ring-1 ring-white/5'}`}
                                >
                                    All
                                </button>
                                {GENRES.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${selectedGenre === g ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-900 text-slate-500 hover:text-slate-300 ring-1 ring-white/5'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {
                            isDataLoading && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="relative h-20 w-20 flex items-center justify-center">
                                        <Film className="h-10 w-10 animate-spin text-indigo-500 absolute" />
                                        <div className="h-20 w-20 rounded-full border-t-2 border-indigo-500/30 animate-spin" />
                                    </div>
                                    <p className="mt-8 text-indigo-400 font-bold uppercase tracking-[0.2em] text-xs">Accessing Archives...</p>
                                </div>
                            )
                        }

                        {
                            !isDataLoading && !search && recommendations.length > 0 && (
                                <section className="space-y-8">
                                    <HeroCard
                                        movie={recommendations[0]}
                                        onClick={() => setSelectedMovie(recommendations[0])}
                                        onWatchTrailer={() => { setAutoPlayNextMovie(true); setSelectedMovie(recommendations[0]); }}
                                    />

                                    <div className="space-y-6 pt-12">
                                        <div className="flex items-center justify-between">
                                            <h2 className="flex items-center gap-3 text-3xl font-black text-white italic tracking-tight underline decoration-indigo-500/50 underline-offset-8">
                                                <Flame className="h-8 w-8 text-indigo-500" /> TOP PICKS FOR YOU
                                            </h2>
                                        </div>
                                        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                            {recommendations.slice(1, 6).map(m => <MovieCard key={m.id} movie={m} onClick={() => setSelectedMovie(m)} />)}
                                        </div>
                                    </div>
                                </section>
                            )
                        }

                        <section className="space-y-6 pb-20">
                            <h2 className="text-3xl font-black text-white italic tracking-tight underline decoration-slate-800 underline-offset-8">
                                {search ? `RESULTS FOR "${search}"` : 'TRENDING GLOBALLY'}
                            </h2>
                            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {filteredMovies.map(m => <MovieCard key={m.id} movie={m} onClick={() => setSelectedMovie(m)} />)}
                            </div>
                        </section>
                    </div >
                )
                }

                {
                    activeTab === 'watchlist' && (
                        <div className="space-y-8">
                            <h2 className="text-3xl font-bold text-white">My Diary</h2>
                            {watchlist.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-800 py-24 text-center">
                                    <Bookmark className="mb-4 h-16 w-16 text-slate-700" />
                                    <p className="text-xl font-semibold text-slate-400">Your watchlist is empty</p>
                                    <button onClick={() => setActiveTab('discover')} className="mt-6 rounded-full bg-indigo-600 px-6 py-2 font-semibold">Explore Movies</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
                                    {watchlist.map(item => (
                                        <div key={item.id} className="group relative rounded-2xl bg-slate-900/50 p-4 ring-1 ring-slate-800">
                                            <img src={item.poster} className="aspect-[2/3] w-full rounded-xl object-cover" />
                                            <div className="mt-4 flex items-center justify-between">
                                                <h3 className="line-clamp-1 font-bold text-white">{item.title}</h3>
                                                <button onClick={() => toggleWatchlist({ id: item.movieId })} className="text-xs text-red-400">Remove</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    activeTab === 'profile' && (
                        <div className="max-w-2xl space-y-8">
                            <div className="flex items-center gap-6">
                                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600">
                                    {user.photoURL ? <img src={user.photoURL} className="h-full w-full rounded-2xl" /> : <User className="h-10 w-10 text-white" />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{userProfile.name} {user.isAnonymous && <span className="ml-2 text-xs text-slate-500">(Guest)</span>}</h2>
                                    <p className="text-slate-500">{user.email || 'Anonymous Account'}</p>
                                </div>
                            </div>

                            <div className="grid gap-6 rounded-3xl bg-slate-900/50 p-8 ring-1 ring-slate-800">
                                <section className="space-y-4">
                                    <h3 className="font-bold text-white">Favorite Genres</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {GENRES.map(genre => {
                                            const favs = userProfile.favoriteGenres || [];
                                            const isActive = favs.includes(genre);
                                            return (
                                                <button
                                                    key={genre}
                                                    onClick={() => {
                                                        const updated = isActive ? favs.filter(g => g !== genre) : [...favs, genre];
                                                        updateProfile({ favoriteGenres: updated });
                                                    }}
                                                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                >
                                                    {genre}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>

                                <hr className="border-slate-800" />

                                <section className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-white">Age-Safe Content</h3>
                                        <p className="text-xs text-slate-500">Filters out mature content.</p>
                                    </div>
                                    <button onClick={() => updateProfile({ ageSafe: !userProfile.ageSafe })} className={`h-6 w-11 rounded-full transition-colors ${userProfile.ageSafe ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                        <div className={`h-4 w-4 transform rounded-full bg-white transition-transform ${userProfile.ageSafe ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </section>

                                <hr className="border-slate-800" />

                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 font-bold text-red-400 hover:text-red-300"
                                >
                                    <LogOut className="h-5 w-5" /> Logout
                                </button>
                            </div>
                        </div>
                    )
                }
            </main >

            {
                selectedMovie && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md" onClick={() => setSelectedMovie(null)} />

                        <div className="relative w-full max-w-6xl overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-[0_0_100px_rgba(0,0,0,0.8)] ring-1 ring-white/10 flex flex-col md:flex-row min-h-[600px]">
                            {/* Backdrop Header (TMDB Style) */}
                            {selectedMovie.backdrop && (
                                <div
                                    className="absolute inset-0 opacity-20 transition-opacity duration-1000 pointer-events-none"
                                    style={{
                                        backgroundImage: `url(${selectedMovie.backdrop.replace('w500', 'original')})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        maskImage: 'linear-gradient(to right, black, transparent)'
                                    }}
                                />
                            )}

                            <button onClick={() => setSelectedMovie(null)} className="absolute right-6 top-6 z-50 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 backdrop-blur-md transition-all hover:rotate-90">
                                <X className="h-6 w-6" />
                            </button>

                            {/* Left Column: Poster / Trailer */}
                            <div className="w-full md:w-1/3 p-8 lg:p-12 z-10 flex flex-col gap-6">
                                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10 group/poster-modal">
                                    {showTrailer && trailerKey ? (
                                        <div className="h-full w-full bg-black">
                                            <iframe
                                                className="h-full w-full"
                                                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                                                title="YouTube video player"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                            <button
                                                onClick={() => setShowTrailer(false)}
                                                className="absolute top-4 left-4 z-20 rounded-full bg-black/80 p-2 text-white hover:bg-black transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <PosterImage src={selectedMovie.poster} alt={selectedMovie.title} className="h-full w-full object-cover" />
                                            {trailerKey && (
                                                <div
                                                    onClick={() => setShowTrailer(true)}
                                                    className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 md:opacity-0 md:group-hover/poster-modal:opacity-100 transition-all duration-500 cursor-pointer backdrop-blur-[2px]"
                                                >
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/90 text-white shadow-[0_0_30px_rgba(79,70,229,0.5)] scale-75 md:group-hover/poster-modal:scale-100 transition-all duration-500">
                                                        <Play className="h-8 w-8 fill-current ml-1" />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Quick Stats Section */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="glass-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Release Year</p>
                                        <p className="text-xl font-black text-white italic">{selectedMovie.year}</p>
                                    </div>
                                    <div className="glass-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Duration</p>
                                        <p className="text-xl font-black text-white italic">{runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Content */}
                            <div className="flex-1 p-8 lg:p-12 z-10 overflow-y-auto max-h-[90vh] no-scrollbar">
                                <div className="space-y-8">
                                    {/* Header Info */}
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                {selectedMovie.title} <span className="text-slate-500 font-normal ml-2">({selectedMovie.year})</span>
                                            </h2>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-400">
                                            <span className="bg-white/5 px-2 py-0.5 rounded ring-1 ring-white/10 uppercase tracking-widest text-xs">{selectedMovie.ageRating}</span>
                                            <div className="h-1 w-1 rounded-full bg-slate-700" />
                                            <span>{theatricalStatus?.date || 'N/A'} (IN)</span>
                                            <div className="h-1 w-1 rounded-full bg-slate-700" />
                                            <span>{selectedMovie.genres.join(', ')}</span>
                                            <div className="h-1 w-1 rounded-full bg-slate-700" />
                                            <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* User Score & Actions */}
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-16 w-16">
                                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                                    <path className="stroke-slate-800" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                    <path className="stroke-emerald-500" strokeDasharray={`${selectedMovie.rating * 10}, 100`} strokeLinecap="round" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-lg font-black text-white italic">{Math.round(selectedMovie.rating * 10)}<sup className="text-[10px] ml-0.5">%</sup></span>
                                                </div>
                                            </div>
                                            <div className="text-xs font-black uppercase tracking-widest text-white leading-tight">
                                                User<br />Score
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button className="h-12 w-12 flex items-center justify-center rounded-full bg-[#032541] text-white hover:scale-110 transition-transform shadow-lg"><List className="h-4 w-4" /></button>
                                            <button onClick={() => toggleWatchlist(selectedMovie, "Watched")} className={`h-12 w-12 flex items-center justify-center rounded-full transition-all shadow-lg ${watchlist.some(w => w.movieId === selectedMovie.id && w.status === 'Watched') ? 'bg-emerald-600 text-white' : 'bg-[#032541] text-white hover:scale-110'}`}><Heart className="h-4 w-4" /></button>
                                            <button onClick={() => toggleWatchlist(selectedMovie, "Watchlist")} className={`h-12 w-12 flex items-center justify-center rounded-full transition-all shadow-lg ${watchlist.some(w => w.movieId === selectedMovie.id && w.status === 'Watchlist') ? 'bg-indigo-600 text-white' : 'bg-[#032541] text-white hover:scale-110'}`}><Bookmark className="h-4 w-4" /></button>

                                            {trailerKey && (
                                                <button onClick={() => setShowTrailer(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-black text-white hover:text-indigo-400 transition-colors uppercase italic tracking-wider">
                                                    <Play className="h-4 w-4 fill-current" /> Play Trailer
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Overview */}
                                    <div className="space-y-4">
                                        {tagline && <p className="text-lg font-medium italic text-slate-400 opacity-80">"{tagline}"</p>}
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-black text-white tracking-tight uppercase italic underline decoration-indigo-500 decoration-4 underline-offset-8">Overview</h3>
                                            <p className="text-slate-300 leading-relaxed text-lg font-medium max-w-3xl">
                                                {selectedMovie.plot}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Credits */}
                                    {movieCredits && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-4">
                                            {movieCredits.crew?.filter(c => ['Director', 'Screenplay', 'Writer', 'Novel'].includes(c.job)).slice(0, 3).map(person => (
                                                <div key={`${person.id}-${person.job}`} className="space-y-1">
                                                    <p className="font-black text-white text-lg">{person.name}</p>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{person.job}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Providers Segment */}
                                    {watchProviders && (
                                        <div className="pt-8 space-y-4">
                                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] italic">Where to Watch</h3>
                                            <div className="flex flex-wrap gap-4">
                                                {watchProviders.streaming?.map(p => (
                                                    <a key={p.provider_id} href={getDirectProviderLink(p.provider_name, selectedMovie.title, selectedMovie.year)} target="_blank" rel="noopener noreferrer" className="group/ott flex flex-col items-center gap-2">
                                                        <img src={`${TMDB_IMAGE_BASE_URL}${p.logo_path}`} className="h-12 w-12 rounded-xl ring-1 ring-white/10 group-hover/ott:ring-indigo-500 transition-all shadow-xl" alt={p.provider_name} />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{p.provider_name}</span>
                                                    </a>
                                                ))}
                                                {!watchProviders.streaming?.length && watchProviders.rent?.map(p => (
                                                    <a key={p.provider_id} href={getDirectProviderLink(p.provider_name, selectedMovie.title, selectedMovie.year)} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
                                                        <img src={`${TMDB_IMAGE_BASE_URL}${p.logo_path}`} className="h-10 w-10 rounded-lg" alt={p.provider_name} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Similar Movies */}
                                    <div className="pt-8 space-y-4">
                                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] italic flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4" /> Recommended for You
                                        </h3>
                                        <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-2 px-2">
                                            {similarMovies.map(m => (
                                                <div key={m.id} onClick={() => setSelectedMovie(m)} className="min-w-[120px] lg:min-w-[150px] cursor-pointer group transition-all">
                                                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-white/10 group-hover:ring-indigo-500/50 transition-all shadow-xl">
                                                        <img src={m.poster} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" alt={m.title} />
                                                    </div>
                                                    <p className="mt-2 text-[10px] font-black text-white italic truncate uppercase">{m.title}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// --- Components ---
function NexusBackground() {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animationFrameId;
        let mouse = { x: -100, y: -100, radius: 250 };
        const colors = {
            primary: '79, 70, 229', // Indigo 600
            secondary: '168, 85, 247', // Purple 500
        };

        const createParticles = (width, height) => {
            particles = [];
            const count = Math.min(60, Math.floor((width * height) / 20000));
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    z: Math.random() * 2 + 1,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 3 + 1,
                    color: Math.random() > 0.5 ? colors.primary : colors.secondary,
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.02 + Math.random() * 0.03
                });
            }
        };

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            createParticles(canvas.width, canvas.height);
        };

        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p, i) => {
                p.x += p.vx * (1 / p.z);
                p.y += p.vy * (1 / p.z);

                if (p.x < -50) p.x = canvas.width + 50;
                if (p.x > canvas.width + 50) p.x = -50;
                if (p.y < -50) p.y = canvas.height + 50;
                if (p.y > canvas.height + 50) p.y = -50;

                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                let extraSize = 0;
                if (dist < mouse.radius) {
                    const force = (1 - dist / mouse.radius);
                    p.x -= dx * force * 0.05;
                    p.y -= dy * force * 0.05;
                    extraSize = force * 6;
                }

                p.pulse += p.pulseSpeed;
                const pulseFactor = Math.sin(p.pulse) * 0.3 + 0.7;
                const opac = (0.2 + (1 / p.z) * 0.3) * pulseFactor;

                ctx.beginPath();
                ctx.arc(p.x, p.y, (p.size + extraSize) * (1.5 / p.z), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color}, ${opac})`;
                ctx.fill();

                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const ldist = Math.sqrt(Math.pow(p.x - p2.x, 2) + Math.pow(p.y - p2.y, 2));

                    if (ldist < 150) {
                        const lineOpac = (1 - ldist / 150) * 0.15 * (1 / p.z);
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(${colors.primary}, ${lineOpac})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        handleResize();
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[5]" />;
}

function Background({ showMarquee = false, marqueePosters = [] }) {
    const fallbackImages = [
        "https://image.tmdb.org/t/p/w300/iuFNm9pYFZzw3YvYvSpgD9pHTAd.jpg", // Oppenheimer
        "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", // Barbie
        "https://image.tmdb.org/t/p/w300/7WsyChvgyno907JmwiicDY2P0vU.jpg", // Interstellar
        "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDp9QmSJJIVbiU9Y9fB.jpg", // Inception
        "https://image.tmdb.org/t/p/w300/5gIuSCDDCunR9XmYptom7fs718W.jpg", // The Matrix
        "https://image.tmdb.org/t/p/w300/vG9v14v93u77uMkd08S9tL6iRlv.jpg", // Pulp Fiction
        "https://image.tmdb.org/t/p/w300/r2J0Vv2mVbi6rNaYp3G71qIQ96R.jpg", // Godfather
        "https://image.tmdb.org/t/p/w300/kBf3gh9qbImvm9GLn2O7zXnI76P.jpg", // Fight Club
        "https://image.tmdb.org/t/p/w300/hfEK8icezrlrs5jS08psv2wqueX.jpg", // Dune
        "https://image.tmdb.org/t/p/w300/d5iIl9h9btztUJZvyv7J2n9u3fs.jpg", // Guardians of the Galaxy
        "https://image.tmdb.org/t/p/w300/6oom5QSilvvc6cc6L6p9GEf3Hdc.jpg", // Spider-Man
        "https://image.tmdb.org/t/p/w300/8t3YKEp3H5mC1SjARtZ4v9q1HMD.jpg"  // The Batman
    ];

    // Ensure we have at least 15 images by looping posters or mixing with fallbacks
    const displayPosters = marqueePosters.length >= 10
        ? marqueePosters
        : [...marqueePosters, ...fallbackImages.filter(img => !marqueePosters.includes(img))].slice(0, 15);

    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#090e1a]">
            <NexusBackground />

            {/* Show Marquee Only on Login */}
            {showMarquee && (
                <div className="absolute inset-0 z-0 opacity-[0.45] flex gap-8 rotate-[-15deg] scale-150 transform-gpu translate-y-[-10%] translate-x-[-5%]">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((col) => {
                        // Shuffle images for each column for maximum variety
                        const colImages = [...displayPosters].sort(() => Math.random() - 0.5);
                        return (
                            <div
                                key={col}
                                className={`flex flex-col gap-12 ${col % 2 === 0 ? 'animate-marquee' : 'animate-marquee-reverse'}`}
                                style={{ animationDuration: `${140 + col * 20}s` }}
                            >
                                {[...colImages, ...colImages, ...colImages].map((img, idx) => (
                                    <div key={idx} className="relative group/poster flex flex-col items-center">
                                        {/* Main Card */}
                                        <div className="w-32 aspect-[2/3] rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10 relative z-10 transition-transform duration-500 group-hover/poster:scale-110">
                                            <img src={img} className="h-full w-full object-cover" alt="" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent" />
                                        </div>

                                        {/* Premium Reflection Effect */}
                                        <div className="absolute top-[calc(100%+6px)] w-32 aspect-[2/3] transform -scale-y-100 opacity-30 blur-[2px] z-0">
                                            <img src={img} className="h-full w-full object-cover rounded-xl" alt="" />
                                            {/* Mask to fade reflection */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-[#090e1a] via-[#090e1a]/40 to-transparent" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Dark Surface Gradient Layer - To integrate reflections */}
            <div className="absolute inset-0 z-[5] bg-gradient-to-b from-transparent via-transparent to-[#090e1a]/10" />

            {/* Base Radial Glow - Clearer */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(30,41,59,0.2)_0%,rgba(10,15,30,0.4)_100%)] z-10" />

            {/* wandering light sources - Increased opacity */}
            <div className="absolute top-[10%] left-[10%] h-[800px] w-[800px] rounded-full bg-indigo-500/15 blur-[120px] animate-wander z-20" />
            <div className="absolute top-[40%] right-[10%] h-[700px] w-[700px] rounded-full bg-purple-500/15 blur-[120px] animate-wander [animation-delay:-5s] z-20" />
            <div className="absolute bottom-[10%] left-[30%] h-[600px] w-[600px] rounded-full bg-blue-500/15 blur-[120px] animate-wander [animation-delay:-12s] z-20" />

            {/* Drifting Particles/Stars - Increased opacity */}
            <div className="absolute inset-0 z-30">
                {[...Array(25)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute h-px w-px bg-white rounded-full animate-drift"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: 0.4 + Math.random() * 0.4,
                            animationDuration: `${30 + Math.random() * 60}s`,
                            animationDelay: `-${Math.random() * 60}s`
                        }}
                    />
                ))}
            </div>

            {/* Film Grain/Noise Overlay */}
            <div className="absolute inset-0 opacity-[0.07] animate-grain bg-grain mix-blend-overlay z-40" />

            {/* Cinematic Scanlines */}
            <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.02)_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] z-50" />

            {/* Mirror Floor Reflection - Deep Bottom Shadow */}
            <div className="absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-[#090e1a] via-[#090e1a]/80 to-transparent z-40" />

            {/* Top Fade Out Layer */}
            <div className="absolute inset-x-0 top-0 h-1/6 bg-gradient-to-b from-[#090e1a] via-[#090e1a]/20 to-transparent z-40" />

            {/* Vignette - Subtler for max visibility */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(2,6,23,0.2)_100%)] z-50" />
        </div>
    );
}
function HeroCard({ movie, onClick, onWatchTrailer }) {
    return (
        <div className="group relative aspect-[21/9] w-full overflow-hidden rounded-[2.5rem] cursor-pointer ring-1 ring-white/10 shadow-2xl transition-all hover:scale-[1.01] hover:shadow-indigo-500/10 active:scale-100">
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" onClick={onClick} />
            {movie.backdrop && <img src={movie.backdrop.replace('w500', 'original')} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" alt={movie.title} />}

            <div className="absolute bottom-0 left-0 z-20 p-12 space-y-4 max-w-3xl pointer-events-none">
                <div className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest italic">Featured</span>
                    <span className="flex items-center gap-1 text-yellow-500 font-bold"><Star className="h-4 w-4 fill-yellow-500" /> {movie.rating}</span>
                    <span className="text-slate-400 font-bold">{movie.year}</span>
                </div>
                <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">{movie.title}</h1>
                <p className="text-slate-300 text-lg line-clamp-2 md:w-3/4 font-medium opacity-80">{movie.plot}</p>
                <div className="flex gap-4 pt-4 pointer-events-auto">
                    <button onClick={onWatchTrailer} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black tracking-tight uppercase hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                        <Play className="h-5 w-5 fill-current" /> Watch Trailer
                    </button>
                    <button onClick={onClick} className="glass-panel text-white px-8 py-3 rounded-2xl font-black tracking-tight uppercase hover:bg-white/10 transition-colors">Details</button>
                </div>
            </div>
        </div>
    );
}

function NavBtn({ icon, label, active, onClick }) {
    return (
        <button onClick={onClick} className={`relative px-4 py-2 flex items-center gap-2 text-sm font-black tracking-tight uppercase transition-all ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {icon} {label}
            {active && <div className="absolute -bottom-1 left-4 right-4 h-1 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />}
        </button>
    );
}

function PosterImage({ src, alt, className }) {
    const [status, setStatus] = useState('loading'); // loading, loaded, error

    return (
        <div className="relative h-full w-full flex items-center justify-center bg-slate-900 shadow-inner">
            {status !== 'loaded' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <Film className={`h-8 w-8 text-slate-700 ${status === 'loading' ? 'animate-pulse' : ''}`} />
                </div>
            )}
            <img
                src={src}
                alt={alt}
                className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`}
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
            />
        </div>
    );
}

function MovieCard({ movie, onClick }) {
    return (
        <div onClick={onClick} className="group cursor-pointer space-y-4">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl bg-slate-900 transition-all duration-500 hover:scale-[1.03] active:scale-95 shadow-lg group-hover:shadow-indigo-500/20 ring-1 ring-white/5 group-hover:ring-indigo-500/50">
                <PosterImage
                    src={movie.poster}
                    alt={movie.title}
                    className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-2xl scale-75 group-hover:scale-100 transition-all duration-500">
                        <Play className="h-6 w-6 fill-current ml-0.5" />
                    </div>
                </div>
                <div className="absolute bottom-4 inset-x-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 tracking-wider bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded w-fit italic">
                        {movie.genres[0]}
                    </div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <div className="bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-white/10 text-yellow-500 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500" />
                        <span className="text-[10px] font-bold">{movie.rating}</span>
                    </div>
                </div>
            </div>
            <div className="px-1">
                <h3 className="line-clamp-1 text-base font-black text-white italic tracking-tight uppercase group-hover:text-indigo-400 transition-colors">{movie.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">{movie.year}</span>
                    <div className="h-1 w-1 rounded-full bg-slate-700" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">{movie.genres[0]}</span>
                </div>
            </div>
        </div>
    );
}
