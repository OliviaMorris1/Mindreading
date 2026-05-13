import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import {
  Leaf,
  BookOpen,
  CheckCircle,
  Sparkles,
  Moon,
  Sun,
  Send,
  Plus,
  Trash2,
  TrendingUp,
  BrainCircuit,
  Smile,
  Frown,
  Meh
} from 'lucide-react';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const appId = import.meta.env.VITE_APP_ID || 'zenflow-ai-assistant';
const initialAuthToken = import.meta.env.VITE_FIREBASE_CUSTOM_TOKEN || '';

const firebaseConfig = (() => {
  try {
    return import.meta.env.VITE_FIREBASE_CONFIG ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG) : null;
  } catch (error) {
    console.warn('Invalid VITE_FIREBASE_CONFIG value. It must be valid JSON.');
    return null;
  }
})();

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',
    ghost: 'bg-transparent hover:bg-slate-50 text-slate-500',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100'
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [journalEntries, setJournalEntries] = useState([]);
  const [habits, setHabits] = useState([]);
  const [aiResponse, setAiResponse] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [newJournal, setNewJournal] = useState('');
  const [newHabit, setNewHabit] = useState('');
  const [mood, setMood] = useState('neutral');
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !user) return;

    const journalCol = collection(db, 'artifacts', appId, 'users', user.uid, 'journal');
    const habitsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'habits');

    const unsubJournal = onSnapshot(
      journalCol,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setJournalEntries(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      },
      (err) => console.error('Journal fetch error:', err)
    );

    const unsubHabits = onSnapshot(
      habitsCol,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setHabits(data);
      },
      (err) => console.error('Habit fetch error:', err)
    );

    return () => {
      unsubJournal();
      unsubHabits();
    };
  }, [user]);

  const getAiGuidance = async (promptType, content = '') => {
    if (!apiKey) {
      setAiResponse('AI unavailable: set VITE_GEMINI_API_KEY in your environment variables.');
      return;
    }

    setLoadingAi(true);
    setAiResponse('');

    let systemPrompt = 'You are ZenFlow, a compassionate mindfulness and mental health assistant. Provide concise, actionable, and warm advice.';
    let userQuery = '';

    if (promptType === 'journal_reflection') {
      userQuery = `I just wrote this journal entry: "${content}". Can you provide a brief reflection, identify any mood patterns, and suggest one mindfulness exercise?`;
    } else if (promptType === 'habit_motivation') {
      userQuery = `I'm trying to maintain these habits: ${habits.map((h) => h.name).join(', ')}. Give me a short motivational quote and one tip for consistency today.`;
    } else if (promptType === 'custom') {
      userQuery = content || 'Give me a quick 1-minute mindfulness exercise.';
    } else {
      userQuery = 'Give me a quick 1-minute mindfulness exercise.';
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setAiResponse(text);
      } else {
        setAiResponse('I’m here for you, but I couldn’t generate a response right now.');
      }
    } catch (error) {
      console.error(error);
      setAiResponse('Connectivity issue. Take a deep breath and try again in a moment.');
    } finally {
      setLoadingAi(false);
    }
  };

  const addJournalEntry = async () => {
    if (!newJournal.trim() || !user || !db) return;
    const journalCol = collection(db, 'artifacts', appId, 'users', user.uid, 'journal');
    await addDoc(journalCol, {
      text: newJournal,
      mood,
      timestamp: serverTimestamp()
    });
    getAiGuidance('journal_reflection', newJournal);
    setNewJournal('');
  };

  const addHabit = async () => {
    if (!newHabit.trim() || !user || !db) return;
    const habitsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'habits');
    await addDoc(habitsCol, {
      name: newHabit,
      completedToday: false,
      streak: 0,
      createdAt: serverTimestamp()
    });
    setNewHabit('');
  };

  const toggleHabit = async (habit) => {
    if (!user || !db) return;
    const habitDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habit.id);
    await updateDoc(habitDoc, {
      completedToday: !habit.completedToday,
      streak: !habit.completedToday ? (habit.streak || 0) + 1 : Math.max(0, (habit.streak || 0) - 1)
    });
  };

  const deleteItem = async (colName, id) => {
    if (!user || !db) return;
    const itemDoc = doc(db, 'artifacts', appId, 'users', user.uid, colName, id);
    await deleteDoc(itemDoc);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-3 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-screen md:border-t-0 md:border-r">
        <div className="hidden md:flex mb-8 text-indigo-600">
          <Leaf size={32} />
        </div>
        {[
          { id: 'dashboard', icon: TrendingUp, label: 'Stats' },
          { id: 'journal', icon: BookOpen, label: 'Journal' },
          { id: 'habits', icon: CheckCircle, label: 'Habits' },
          { id: 'ai', icon: BrainCircuit, label: 'AI Coach' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="md:ml-20 p-4 md:p-10 pb-24 md:pb-10 max-w-5xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p className="text-slate-500 dark:text-slate-400">Welcome back. Take a deep breath.</p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-full text-indigo-600">
            <Sparkles size={24} />
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 mb-4">
                <Smile size={32} />
              </div>
              <h3 className="text-xl font-bold">Mental Clarity Score</h3>
              <p className="text-slate-500 mb-4">Based on your recent journaling and habits.</p>
              <div className="text-4xl font-black text-indigo-600">84%</div>
            </Card>

            <Card>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-500" />
                Active Streaks
              </h3>
              <div className="space-y-4">
                {habits.length > 0 ? habits.map((h) => (
                  <div key={h.id} className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300">{h.name}</span>
                    <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                      🔥 {h.streak || 0} days
                    </span>
                  </div>
                )) : (
                  <p className="text-slate-400 text-sm">Add habits to see your streaks.</p>
                )}
              </div>
            </Card>

            <Card className="md:col-span-2">
              <h3 className="text-lg font-bold mb-2">Daily Affirmation</h3>
              <p className="italic text-slate-600 dark:text-slate-300">"I am in control of my breath, my thoughts, and my reactions today."</p>
            </Card>
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-bold mb-4">How are you feeling?</h3>
              <div className="flex gap-4 mb-4">
                {[
                  { id: 'happy', icon: Smile, color: 'text-green-500' },
                  { id: 'neutral', icon: Meh, color: 'text-yellow-500' },
                  { id: 'sad', icon: Frown, color: 'text-red-500' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`p-3 rounded-xl border-2 transition-all ${mood === m.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-transparent bg-slate-50 dark:bg-slate-700'}`}
                  >
                    <m.icon className={m.color} size={28} />
                  </button>
                ))}
              </div>
              <textarea
                value={newJournal}
                onChange={(e) => setNewJournal(e.target.value)}
                placeholder="Release your thoughts here..."
                className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 mb-4 resize-none"
              />
              <Button onClick={addJournalEntry} className="w-full">
                Save & Reflect <Send size={18} />
              </Button>
            </Card>

            {loadingAi && (
              <div className="flex items-center gap-3 text-indigo-600 animate-pulse font-medium">
                <BrainCircuit className="animate-spin" /> ZenFlow AI is reflecting...
              </div>
            )}

            {aiResponse && (
              <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800">
                <div className="flex items-start gap-3">
                  <Sparkles className="text-indigo-600 mt-1 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">AI Insight</h4>
                    <p className="text-indigo-800 dark:text-indigo-300 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                </div>
              </Card>
            )}

            <div className="space-y-4">
              <h3 className="font-bold text-lg">Past Reflections</h3>
              {journalEntries.map((entry) => (
                <div key={entry.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative group">
                  <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                    {entry.mood === 'happy' && <Smile size={14} className="text-green-500" />}
                    {entry.mood === 'neutral' && <Meh size={14} className="text-yellow-500" />}
                    {entry.mood === 'sad' && <Frown size={14} className="text-red-500" />}
                    {entry.timestamp?.toDate().toLocaleDateString()}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{entry.text}</p>
                  <button
                    onClick={() => deleteItem('journal', entry.id)}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'habits' && (
          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-bold mb-4">Add a New Habit</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  placeholder="e.g. 10m Meditation"
                  className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button onClick={addHabit}>
                  <Plus size={20} />
                </Button>
              </div>
            </Card>

            <div className="grid gap-3">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${habit.completedToday ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleHabit(habit)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${habit.completedToday ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}
                    >
                      {habit.completedToday && <CheckCircle size={18} />}
                    </button>
                    <div>
                      <h4 className={`font-semibold ${habit.completedToday ? 'line-through text-slate-400' : ''}`}>{habit.name}</h4>
                      <div className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">Streak: {habit.streak || 0}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteItem('habits', habit.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <Button variant="secondary" onClick={() => getAiGuidance('habit_motivation')} className="w-full py-4">
              <Sparkles size={18} className="text-indigo-500" /> Get Habit Motivation
            </Button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <BrainCircuit size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">ZenFlow AI Coach</h2>
                  <p className="text-indigo-100 text-sm">Your personal mindfulness companion.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => getAiGuidance('meditation', 'Give me a 5-minute breathing exercise.')}
                  className="bg-white/10 hover:bg-white/20 p-4 rounded-xl text-left transition-colors backdrop-blur-sm border border-white/10"
                >
                  <Moon className="mb-2" size={20} />
                  <span className="block font-bold">Sleep Help</span>
                </button>
                <button
                  onClick={() => getAiGuidance('stress', 'I am feeling overwhelmed by work today. Help.')}
                  className="bg-white/10 hover:bg-white/20 p-4 rounded-xl text-left transition-colors backdrop-blur-sm border border-white/10"
                >
                  <Sun className="mb-2" size={20} />
                  <span className="block font-bold">Quick Focus</span>
                </button>
              </div>
            </Card>

            <div className="space-y-4">
              <textarea
                placeholder="Ask ZenFlow anything... (e.g., 'How do I handle social anxiety?')"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (customPrompt.trim()) {
                      getAiGuidance('custom', customPrompt.trim());
                      setCustomPrompt('');
                    }
                  }
                }}
                className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24"
              />
              {loadingAi ? (
                <div className="p-8 flex flex-col items-center justify-center gap-4 text-slate-400">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>Finding the right words for you...</p>
                </div>
              ) : aiResponse ? (
                <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed">
                    {aiResponse.split('\n').map((line, i) => (
                      <p key={i} className={line.startsWith('*') ? 'pl-4 border-l-2 border-indigo-200' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
