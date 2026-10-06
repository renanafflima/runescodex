import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { AppRoutes } from "../routes/AppRoutes";

export function App() {
  return (
    <BrowserRouter basename="/runes">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
