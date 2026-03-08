import React from "react";
import { useLocation } from "react-router-dom";
import SearchSession from "../components/SearchSession";

function Search() {
  const location = useLocation();

  // enable one-time auto search when redirected from home submit
  const autoRun = !!location.state?.autoSearch;

  return <SearchSession variant="search" autoRun={autoRun} />;
}

export default Search;
