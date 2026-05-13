# Mindful Project

A React + Tailwind app for journaling, habits, and AI-powered mindfulness guidance.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Add your environment values in `.env`.

4. Run the development server:

```bash
npm run dev
```

5. Open the local URL shown in your terminal.

## Environment Variables

Create a `.env` file in the project root with these values:

```bash
VITE_GEMINI_API_KEY=""
VITE_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'
VITE_APP_ID="zenflow-ai-assistant"
VITE_FIREBASE_CUSTOM_TOKEN=""
```

- `VITE_GEMINI_API_KEY`: API key used for the AI assistant call.
- `VITE_FIREBASE_CONFIG`: JSON string for Firebase configuration.
- `VITE_APP_ID`: Optional application namespace used in Firestore paths.
- `VITE_FIREBASE_CUSTOM_TOKEN`: Optional Firebase custom auth token.

## Notes

- Sensitive keys should not be committed to source control.
- The app uses Firebase Authentication and Firestore for persistence.
- Update the AI endpoint in `src/App.jsx` if you want to use a different AI provider.
