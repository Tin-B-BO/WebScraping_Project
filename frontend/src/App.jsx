import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import Popular from "./pages/Popular";
import RecipeDetails from "./pages/RecipeDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Layout from "./Layout";
import Information from "./pages/Information";
import PasswordGate from "./components/PasswordGate"; 

export default function App() {
  return (
    <PasswordGate>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/recipe/:id" element={<RecipeDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/popular/:slug" element={<Popular />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/info/:slug" element={<Information />} />
          </Route>
        </Routes>
      </HashRouter>
    </PasswordGate>
  );
}