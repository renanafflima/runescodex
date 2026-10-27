import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { AppRoutes } from "../routes/AppRoutes";

export function App() {
  return (
    <BrowserRouter basename="/runescodex">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
