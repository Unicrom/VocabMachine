import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.jsx';
import '../styles.css'; // reuse original stylesheet

createRoot(document.getElementById('root')).render(<App />);
