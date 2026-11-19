import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/index.css';
import App from './App';
import { ToastHost } from './lib/app';

if (localStorage.getItem('nv-theme') === 'dark') document.documentElement.classList.add('dark');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ToastHost><App /></ToastHost></React.StrictMode>);
