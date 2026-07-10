import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { DBProvider } from './context/DBContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/incinx-billings-accounts">
      <DBProvider>
        <App />
      </DBProvider>
    </BrowserRouter>
  </React.StrictMode>
);