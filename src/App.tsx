import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';

// Import all 7 screens
import { HomeScreen } from './screens/HomeScreen';
import { JoinQueueScreen } from './screens/JoinQueueScreen';
import { MyStatusScreen } from './screens/MyStatusScreen';
import { ReceptionScreen } from './screens/ReceptionScreen';
import { BarberScreen } from './screens/BarberScreen';
import { DisplayScreen } from './screens/DisplayScreen';
import { AdminScreen } from './screens/AdminScreen';

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Screen 1: Home & Status */}
          <Route path="/" element={<HomeScreen />} />

          {/* Screen 2: Join Queue */}
          <Route path="/join" element={<JoinQueueScreen />} />

          {/* Screen 3: My Status */}
          <Route path="/status/:id" element={<MyStatusScreen />} />
          <Route path="/status" element={<Navigate to="/" replace />} />

          {/* Screen 4: Reception Dashboard */}
          <Route path="/reception" element={<ReceptionScreen />} />

          {/* Screen 5: Barber View */}
          <Route path="/barber/:name" element={<BarberScreen />} />
          <Route path="/barber" element={<Navigate to="/barber/Ravi" replace />} />

          {/* Screen 6: Waiting Area TV Display */}
          <Route path="/display" element={<DisplayScreen />} />

          {/* Screen 7: Owner Settings & Analytics */}
          <Route path="/admin" element={<AdminScreen />} />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
};

export default App;
