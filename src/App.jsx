// src/App.jsx
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./components/Login";
import ChatRoom from "./components/ChatRoom";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <>
      {!user ? <Login onLogin={setUser} /> : <ChatRoom user={user} />}
    </>
  );
}

export default App;
