import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import AlbumDetailPage from "./pages/AlbumDetailPage";
import AlbumsPage from "./pages/AlbumsPage";
import ArtistDetailPage from "./pages/ArtistDetailPage";
import ArtistsPage from "./pages/ArtistsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import GenresPage from "./pages/GenresPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";
import SearchPage from "./pages/SearchPage";
import StatsPage from "./pages/StatsPage";
import HistoryPage from "./pages/HistoryPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthenticatedShell />}>
        <Route index element={<HomePage />} />
        <Route path="albums" element={<AlbumsPage />} />
        <Route path="albums/:albumId" element={<AlbumDetailPage />} />
        <Route path="artists" element={<ArtistsPage />} />
        <Route path="artists/:artistId" element={<ArtistDetailPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/:playlistId" element={<PlaylistDetailPage />} />
        <Route path="genres" element={<GenresPage />} />
        <Route path="genres/:genre" element={<GenresPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
