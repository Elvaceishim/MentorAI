import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Check if user has logged in before
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('mentorAI_lastEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setIsReturningUser(true);
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setError(error.message);
    } else {
      // Remember this email for next time
      localStorage.setItem('mentorAI_lastEmail', email);
      setMessage("Magic link sent! Check your email and click the link to log in.");
    }

    setLoading(false);
  }

  function clearRememberedEmail() {
    localStorage.removeItem('mentorAI_lastEmail');
    setEmail("");
    setIsReturningUser(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {isReturningUser ? "Welcome Back!" : "Join the Study Group"}
          </h2>
          {isReturningUser && (
            <p className="text-sm text-gray-600 mt-2">
              We remember you! Just send yourself a new magic link.
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            {isReturningUser && (
              <button
                type="button"
                onClick={clearRememberedEmail}
                className="text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                Use a different email?
              </button>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              {message}
            </div>
          )}
          
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-md transition-colors"
            disabled={loading || !email.trim()}
          >
            {loading ? "Sending..." : isReturningUser ? "Send Login Link" : "Send Signup Link"}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>We'll send you a secure link to sign in instantly.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
