import PopularSession from "../components/PopularSession.jsx";
import SearchSession from "../components/SearchSession.jsx";
import RecentSearched from "./RecentSearched.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function Home() {
  const { user } = useAuth();

  return (
    <div>
      <PopularSession />
      <SearchSession variant="home" />
      {user ? <RecentSearched /> : null}
    </div>
  );
}

export default Home;
