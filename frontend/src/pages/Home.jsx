import PopularSession from "../components/PopularSession.jsx";
import SearchSession from "../components/SearchSession.jsx";
import AboutThisWebsite from "../components/AboutThisWebsite.jsx";
import RecentSearched from "./RecentSearched.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function Home() {
  const { user } = useAuth();

  return (
    <div>
      <PopularSession />
      <SearchSession variant="home" />
      {!user ? <AboutThisWebsite /> : null}
      {user ? <RecentSearched /> : null}
      {user ? <AboutThisWebsite /> : null}
    </div>
  );
}

export default Home;
