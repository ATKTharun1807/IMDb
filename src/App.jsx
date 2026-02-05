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
    Github
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
    signInWithCustomToken,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from 'firebase/auth';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBXJ6FWddxTmhFFUTmFHB2LSt9ZPen0CjY",
    authDomain: "cinesphere-61fd0.firebaseapp.com",
    projectId: "cinesphere-61fd0",
    storageBucket: "cinesphere-61fd0.firebasestorage.app",
    messagingSenderId: "1042464485794",
    appId: "1:1042464485794:web:80d9e05d0506c8a5d1c2fb",
    measurementId: "G-EWX3LWSTV9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = 'cinesphere-app';

// --- Large Movie Dataset ---
const GENRES = ["Action", "Sci-Fi", "Drama", "Crime", "Animation", "Thriller", "Adventure", "Family", "Comedy", "Horror", "Mystery", "Romance", "Fantasy"];

export default function App() {
    const [user, setUser] = useState(null);
    const [authStatus, setAuthStatus] = useState('loading'); // loading, unauthenticated, authenticated
    const [watchlist, setWatchlist] = useState([]);
    const [userProfile, setUserProfile] = useState({
        name: "Cinephile",
        favoriteGenres: ["Sci-Fi", "Drama"],
        ageSafe: false,
    });
    const [movies, setMovies] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [activeTab, setActiveTab] = useState("discover");
    const [error, setError] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);

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

    // --- Fetch Large Movie Dataset ---
    useEffect(() => {
        const fetchMovies = async () => {
            try {
                setIsDataLoading(true);
                const response = await fetch('/movies.json');
                const data = await response.json();

                // Map Wikipedia format to App format
                const mappedMovies = data.map((m, index) => ({
                    id: index + 1,
                    title: m.title,
                    year: m.year,
                    rating: parseFloat((7 + Math.random() * 2.5).toFixed(1)), // Mock rating
                    genres: m.genres && m.genres.length > 0 ? m.genres : ["Drama"],
                    ageRating: m.year > 2000 ? "PG-13" : "PG", // Mock age rating
                    poster: m.thumbnail || "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=800",
                    plot: m.extract || "No description available."
                }));

                setMovies(mappedMovies);
            } catch (err) {
                console.error("Failed to fetch movies:", err);
                setError("Failed to load movie library.");
            } finally {
                setIsDataLoading(false);
            }
        };

        fetchMovies();
    }, []);

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
                setUserProfile(doc.data());
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
                movie.genres.forEach(g => {
                    if (userProfile.favoriteGenres.includes(g)) score += 2;
                });
                return { ...movie, score };
            })
            .sort((a, b) => b.score - a.score);
    }, [movies, userProfile, watchlist]);

    const filteredMovies = useMemo(() => {
        const filtered = movies.filter(m => {
            const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase());
            const matchesAge = userProfile.ageSafe ? m.ageRating !== "R" : true;
            return matchesSearch && matchesAge;
        });
        return search ? filtered : filtered.slice(0, 50); // Limit trending to 50
    }, [movies, search, userProfile.ageSafe]);

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
        const newProfile = { ...userProfile, ...updates };
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
        await setDoc(docRef, newProfile);
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
        return (
            <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-white overflow-hidden">
                {/* Background Accents */}
                <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
                <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />

                <div className="z-10 w-full max-w-md space-y-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-2xl shadow-indigo-500/40">
                            <Film className="h-10 w-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight">CineSphere</h1>
                        <p className="text-slate-400">Discover your next favorite story. Track your cinematic journey in one place.</p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <button
                            onClick={handleGoogleLogin}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-slate-950 transition-transform hover:scale-[1.02] active:scale-95"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/pwa_apple_color.png" className="hidden h-5 w-5" alt="" />
                            {/* Manual SVG for Google */}
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign in with Google
                        </button>

                        <div className="flex items-center gap-4 py-2 text-slate-600">
                            <hr className="flex-1 border-slate-800" />
                            <span className="text-xs font-bold uppercase tracking-widest">or</span>
                            <hr className="flex-1 border-slate-800" />
                        </div>

                        <button
                            onClick={handleGuestLogin}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-slate-300 ring-1 ring-slate-800 transition-all hover:bg-slate-800"
                        >
                            Continue as Guest
                        </button>
                    </div>

                    {error && <p className="text-sm font-medium text-red-400">{error}</p>}

                    <p className="text-xs text-slate-500">
                        By continuing, you agree to CineSphere's Terms & Privacy Policy.
                    </p>
                </div>
            </div>
        );
    }

    // --- Main App Screen (Authenticated) ---
    return (
        <div className="min-h-screen w-full bg-slate-950 font-sans text-slate-100">
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

            <main className="mx-auto max-w-7xl px-6 py-8">
                {activeTab === 'discover' && (
                    <div className="space-y-12">
                        <div className="relative max-w-2xl">
                            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search movies..."
                                className="w-full rounded-2xl border-none bg-slate-900 py-4 pl-12 pr-4 text-slate-100 ring-1 ring-slate-800 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {isDataLoading && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Film className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
                                <p className="text-slate-500 font-medium">Curating your library...</p>
                            </div>
                        )}

                        {!isDataLoading && !search && recommendations.length > 0 && (
                            <section className="space-y-4">
                                <h2 className="flex items-center gap-2 text-2xl font-bold text-white"><Flame className="h-6 w-6 text-orange-500" /> Recommended</h2>
                                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    {recommendations.slice(0, 5).map(m => <MovieCard key={m.id} movie={m} onClick={() => setSelectedMovie(m)} />)}
                                </div>
                            </section>
                        )}

                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-white">{search ? 'Results' : 'Trending Now'}</h2>
                            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {filteredMovies.map(m => <MovieCard key={m.id} movie={m} onClick={() => setSelectedMovie(m)} />)}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'watchlist' && (
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
                )}

                {activeTab === 'profile' && (
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
                                    {GENRES.map(genre => (
                                        <button
                                            key={genre}
                                            onClick={() => {
                                                const updated = userProfile.favoriteGenres.includes(genre) ? userProfile.favoriteGenres.filter(g => g !== genre) : [...userProfile.favoriteGenres, genre];
                                                updateProfile({ favoriteGenres: updated });
                                            }}
                                            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${userProfile.favoriteGenres.includes(genre) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                        >
                                            {genre}
                                        </button>
                                    ))}
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
                )}
            </main>

            {/* Detail Modal */}
            {selectedMovie && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setSelectedMovie(null)} />
                    <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-900 ring-1 ring-slate-800 flex flex-col md:flex-row">
                        <button onClick={() => setSelectedMovie(null)} className="absolute right-6 top-6 z-10 rounded-full bg-black/40 p-2 text-white"><X className="h-5 w-5" /></button>
                        <div className="h-64 w-full md:h-auto md:w-1/3 overflow-hidden bg-slate-950 flex items-center justify-center">
                            <PosterImage src={selectedMovie.poster} alt={selectedMovie.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 p-8">
                            <h2 className="text-3xl font-black text-white">{selectedMovie.title}</h2>
                            <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
                                <span className="font-bold">{selectedMovie.year}</span>
                                <span className="flex items-center gap-1 text-yellow-500"><Star className="h-4 w-4 fill-yellow-500" /> {selectedMovie.rating}</span>
                                <span className="rounded border border-slate-700 px-2 py-0.5 uppercase">{selectedMovie.ageRating}</span>
                            </div>
                            <p className="mt-6 text-slate-300 leading-relaxed">{selectedMovie.plot}</p>
                            <div className="mt-12 flex gap-4">
                                <button
                                    onClick={() => toggleWatchlist(selectedMovie, "Watchlist")}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-bold ${watchlist.some(w => w.movieId === selectedMovie.id && w.status === 'Watchlist') ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-600 text-white'}`}
                                >
                                    <Bookmark className="h-5 w-5" /> Watchlist
                                </button>
                                <button
                                    onClick={() => toggleWatchlist(selectedMovie, "Watched")}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-bold ${watchlist.some(w => w.movieId === selectedMovie.id && w.status === 'Watched') ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    <CheckCircle className="h-5 w-5" /> Watched
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Components ---
function NavBtn({ icon, label, active, onClick }) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 text-sm font-semibold transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-200'}`}>
            {icon} {label}
        </button>
    );
}

function PosterImage({ src, alt, className }) {
    const [status, setStatus] = useState('loading'); // loading, loaded, error

    return (
        <div className="relative h-full w-full flex items-center justify-center bg-slate-900">
            {status !== 'loaded' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <Film className={`h-8 w-8 text-slate-700 ${status === 'loading' ? 'animate-pulse' : ''}`} />
                    {status === 'error' && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">{alt}</p>}
                </div>
            )}
            <img
                src={src}
                alt={alt}
                className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
            />
        </div>
    );
}

function MovieCard({ movie, onClick }) {
    return (
        <div onClick={onClick} className="group cursor-pointer space-y-3">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-slate-900 transition-all group-hover:-translate-y-2 group-hover:ring-4 group-hover:ring-indigo-500/30">
                <PosterImage
                    src={movie.poster}
                    alt={movie.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
            </div>
            <div>
                <h3 className="line-clamp-1 font-bold text-white group-hover:text-indigo-400">{movie.title}</h3>
                <p className="text-xs text-slate-500">{movie.year} • {movie.genres[0]}</p>
            </div>
        </div>
    );
}
