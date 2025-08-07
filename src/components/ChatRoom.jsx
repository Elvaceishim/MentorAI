// src/ChatRoom.jsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatRoom({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('mentorAI_soundEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [reactions, setReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const bottomRef = useRef();

  // Available emoji reactions
  const availableEmojis = ['👍', '❤️', '😄', '😮', '😢', '😡', '🎉', '🤔'];

  // Sound notification function
  const playNotificationSound = () => {
    if (soundEnabled) {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  };

  // Toggle sound notifications
  const toggleSound = () => {
    const newSoundState = !soundEnabled;
    setSoundEnabled(newSoundState);
    localStorage.setItem('mentorAI_soundEnabled', JSON.stringify(newSoundState));
  };

  // Add reaction to message
  const addReaction = async (messageId, emoji) => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .insert([{
          message_id: messageId,
          user_email: user.email,
          emoji: emoji,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error adding reaction:', error);
      } else {
        // Update local reactions state
        fetchReactions();
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    setShowEmojiPicker(null);
  };

  // Remove reaction from message
  const removeReaction = async (messageId, emoji) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_email', user.email)
        .eq('emoji', emoji);

      if (error) {
        console.error('Error removing reaction:', error);
      } else {
        // Update local reactions state
        fetchReactions();
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  // Fetch reactions for all messages
  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*');

      if (error) {
        console.error('Error fetching reactions:', error);
      } else {
        // Group reactions by message_id and emoji
        const groupedReactions = {};
        data.forEach(reaction => {
          if (!groupedReactions[reaction.message_id]) {
            groupedReactions[reaction.message_id] = {};
          }
          if (!groupedReactions[reaction.message_id][reaction.emoji]) {
            groupedReactions[reaction.message_id][reaction.emoji] = [];
          }
          groupedReactions[reaction.message_id][reaction.emoji].push(reaction.user_email);
        });
        setReactions(groupedReactions);
      }
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };

  // Helper function to copy AI response
  const copyAIResponse = async (messageId, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      // Reset after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Helper function to format timestamps
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      // Show time for messages from today
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // Show date and time for older messages
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  useEffect(() => {
    // Fetch existing messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error('Error fetching messages:', error);
      }
      setMessages(data || []);
    };
    
    fetchMessages();
    fetchReactions();

    // Listen for new messages
    const subscription = supabase
      .channel("room1")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          // Check if message already exists to avoid duplicates
          setMessages((prev) => {
            const exists = prev.some(msg => msg.id === payload.new.id);
            if (exists) {
              return prev; // Don't add duplicate
            }
            
            // Play notification sound for messages from other users
            if (payload.new.user_email !== user.email) {
              playNotificationSound();
            }
            
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    // Listen for reaction changes
    const reactionSubscription = supabase
      .channel("reactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(reactionSubscription);
    };
  }, [user]);

  // Enhanced keyboard shortcut handler
  const handleKeyDown = (e) => {
    // Send message: Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    
    // Quick @mentor insertion: Ctrl/Cmd + M
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      if (!newMsg.includes('@mentor')) {
        setNewMsg(prev => '@mentor, ' + prev);
      }
    }
    
    // Clear input: Escape
    if (e.key === 'Escape') {
      setNewMsg('');
    }
  };

  async function sendMessage() {
    if (!newMsg.trim()) return;

    const message = {
      id: uuidv4(),
      content: newMsg,
      user_email: user.email,
      created_at: new Date().toISOString(),
    };

    // Add message to UI immediately for better UX
    setMessages(prev => [...prev, message]);
    
    // Store the message text for AI processing
    const messageText = newMsg;
    setNewMsg("");

    // Insert to database
    await supabase.from("messages").insert([message]);

    // Check if this is an @mentor message and call AI
    if (messageText.includes('@mentor')) {
      setIsAiLoading(true);
      try {
        // Use different URLs for development vs production
        const functionUrl = import.meta.env.DEV 
          ? 'http://localhost:8888/.netlify/functions/ai-reply'
          : '/.netlify/functions/ai-reply';
          
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageText,
            user_id: user.id,
            username: user.email.split('@')[0], // Extract username from email
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to get AI response');
        }

        if (result.success) {
          // Insert AI response into database using frontend client
          const aiMessage = {
            id: uuidv4(),
            content: result.reply,
            user_email: 'mentor@ai.assistant',
            created_at: new Date().toISOString(),
          };
          
          // Add AI message to UI immediately
          setMessages(prev => [...prev, aiMessage]);
          
          await supabase.from("messages").insert([aiMessage]);
        }
      } catch (error) {
        console.error('Error calling AI mentor:', error);
        // Show error message in chat
        const errorMessage = {
          id: uuidv4(),
          content: `Sorry, I'm having trouble responding right now. Please try again in a moment. Error: ${error.message}`,
          user_email: 'mentor@ai.assistant',
          created_at: new Date().toISOString(),
        };
        
        // Add error message to UI immediately
        setMessages(prev => [...prev, errorMessage]);
        await supabase.from("messages").insert([errorMessage]);
      } finally {
        setIsAiLoading(false);
      }
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Toggle emoji picker visibility
  const toggleEmojiPicker = (messageId) => {
    setShowEmojiPicker(prev => prev === messageId ? null : messageId);
  };

  // Handle emoji reaction click
  const handleEmojiClick = async (messageId, emoji) => {
    // Check if user already reacted with this emoji
    const messageReactions = reactions[messageId] || {};
    const userHasReacted = messageReactions[emoji]?.includes(user.email);
    
    if (userHasReacted) {
      removeReaction(messageId, emoji);
    } else {
      addReaction(messageId, emoji);
    }
  };

  // Message editing and deletion
  const startEdit = (messageId, currentContent) => {
    setEditingMessage(messageId);
    setEditContent(currentContent);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditContent("");
  };

  const saveEdit = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: editContent,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        console.error('Error updating message:', error);
      } else {
        // Update local state
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: editContent, edited_at: new Date().toISOString() }
            : msg
        ));
        setEditingMessage(null);
        setEditContent("");
      }
    } catch (error) {
      console.error('Error updating message:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId);

        if (error) {
          console.error('Error deleting message:', error);
        } else {
          // Update local state
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
        }
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-screen p-4 bg-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border">
        <div>
          <h1 className="text-lg font-bold text-gray-800">MentorAI Chat</h1>
          <p className="text-sm text-gray-600">Learning together with AI assistance</p>
        </div>
        <button
          onClick={toggleSound}
          className={`p-2 rounded-full transition-all duration-200 ${
            soundEnabled 
              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          title={soundEnabled ? 'Sound notifications ON - Click to disable' : 'Sound notifications OFF - Click to enable'}
        >
          <span className="text-lg">
            {soundEnabled ? '🔔' : '🔕'}
          </span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map((msg) => {
          const isMentorAI = msg.user_email === 'mentor@ai.assistant' || msg.user_email === 'mentorai@assistant' || msg.user_email === 'mentor@ai';
          const isCurrentUser = msg.user_email === user.email;
          const userReaction = msg.reactions?.[user.email] || null;

          return (
            <div
              key={msg.id}
              className={`p-4 rounded-xl ${
                isMentorAI
                  ? "bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-left shadow-sm"
                  : isCurrentUser
                  ? "bg-blue-100 text-right ml-12 shadow-sm border"
                  : "bg-gray-100 text-left mr-12 shadow-sm border"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className={`text-xs font-medium ${
                  isMentorAI ? "text-emerald-700" : "text-gray-600"
                }`}>
                  {isMentorAI ? "🧠 MentorAI" : msg.user_email}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {formatTimestamp(msg.created_at)}
                    {msg.edited_at && (
                      <span className="text-xs text-gray-400 ml-1">(edited)</span>
                    )}
                  </p>
                  {isMentorAI && (
                    <button
                      onClick={() => copyAIResponse(msg.id, msg.content)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        copiedId === msg.id
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
                      }`}
                      title="Copy AI response"
                    >
                      {copiedId === msg.id ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  )}
                  {isCurrentUser && !isMentorAI && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(msg.id, msg.content)}
                        className="text-xs px-2 py-1 rounded transition-colors bg-blue-100 text-blue-600 hover:bg-blue-200"
                        title="Edit message"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="text-xs px-2 py-1 rounded transition-colors bg-red-100 text-red-600 hover:bg-red-200"
                        title="Delete message"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Message content or edit mode */}
              {editingMessage === msg.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows="3"
                    placeholder="Edit your message..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(msg.id)}
                      className="text-xs px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600"
                      disabled={!editContent.trim()}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : isMentorAI ? (
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Prevent nesting issues by handling code blocks at the root level
                      p: ({children}) => {
                        return <div className="mb-3 leading-relaxed">{children}</div>;
                      },
                      code: ({node, inline, className, children, ...props}) => {
                        if (inline) {
                          return (
                            <code className="bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <div className="my-4">
                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto border">
                              <code className="text-sm font-mono" {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        );
                      },
                      pre: ({children}) => {
                        // Handle pre tags directly to avoid double wrapping
                        return <div className="my-4">{children}</div>;
                      },
                      ul: ({children, ...props}) => (
                        <ul 
                          className="my-3 text-gray-800" 
                          style={{
                            listStyleType: 'disc',
                            paddingLeft: '1.5rem'
                          }}
                          {...props}
                        >
                          {children}
                        </ul>
                      ),
                      ol: ({children, ...props}) => (
                        <ol 
                          className="my-3 text-gray-800 numbered-list" 
                          style={{
                            listStyleType: 'decimal',
                            paddingLeft: '1.75rem',
                            marginLeft: '0'
                          }}
                          {...props}
                        >
                          {children}
                        </ol>
                      ),
                      li: ({children, ...props}) => {
                        // Check if this li is inside an ol (ordered list)
                        return (
                          <li 
                            className="mb-2 text-gray-800" 
                            style={{
                              display: 'list-item',
                              marginLeft: '0',
                              listStyleType: 'inherit'
                            }}
                            {...props}
                          >
                            {children}
                          </li>
                        );
                      },
                      h1: ({children}) => <h1 className="text-lg font-bold my-3 text-emerald-800">{children}</h1>,
                      h2: ({children}) => <h2 className="text-base font-bold my-3 text-emerald-800">{children}</h2>,
                      h3: ({children}) => <h3 className="text-sm font-bold my-2 text-emerald-700">{children}</h3>,
                      strong: ({children}) => <strong className="font-semibold text-emerald-800">{children}</strong>,
                      blockquote: ({children}) => (
                        <blockquote className="border-l-4 border-emerald-300 pl-4 italic text-emerald-700 my-3">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.content || msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-800 leading-relaxed">
                  {msg.content || msg.text}
                </p>
              )}

              {/* Reactions */}
              <div className="flex items-center gap-2 mt-2">
                {/* Reaction buttons */}
                <div className="flex gap-1">
                  {availableEmojis.map(emoji => {
                    const isActive = userReaction === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(msg.id, emoji)}
                        className={`text-xl transition-transform ${
                          isActive ? 'scale-110 text-emerald-600' : 'text-gray-500 hover:text-emerald-600'
                        }`}
                        title={isActive ? 'Remove reaction' : 'React with ' + emoji}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
                
                {/* Show current user's reaction */}
                {userReaction && (
                  <p className="text-xs text-gray-600">
                    You reacted with: <span className="text-emerald-600">{userReaction}</span>
                  </p>
                )}
                
                {/* Toggle emoji picker */}
                <button
                  onClick={() => toggleEmojiPicker(msg.id)}
                  className="text-gray-500 hover:text-emerald-600 transition-colors"
                  title="Add a reaction"
                >
                  {showEmojiPicker === msg.id ? '▼' : '▲'} Reactions
                </button>
              </div>
              
              {/* Emoji picker (hidden by default) */}
              {showEmojiPicker === msg.id && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {availableEmojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(msg.id, emoji)}
                        className="text-2xl"
                        title={'React with ' + emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit and delete for own messages */}
              {isCurrentUser && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => startEdit(msg.id, msg.content)}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                    title="Edit message"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                    title="Delete message"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}

              {/* Edit message input (shown only when editing) */}
              {editingMessage === msg.id && (
                <div className="mt-2">
                  <textarea
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500 resize-none"
                    rows="2"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Edit your message..."
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => saveEdit(msg.id)}
                      className="bg-blue-600 text-white px-4 py-1 rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-300 text-gray-700 px-4 py-1 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {isAiLoading && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-left p-4 rounded-xl shadow-sm">
            <p className="text-xs text-emerald-700 font-medium mb-2">🧠 MentorAI</p>
            <p className="text-emerald-600 italic flex items-center">
              <span className="mr-2">MentorAI is thinking</span>
              <span className="flex space-x-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
              </span>
            </p>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
            placeholder="Type a message... (Enter to send, Ctrl+M for @mentor, Esc to clear)"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAiLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isAiLoading || !newMsg.trim()}
            className="bg-blue-600 text-white px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        
        {newMsg.includes('@mentor') && (
          <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <span className="font-medium">🧠 MentorAI Ready!</span> Ask me anything - tech questions, cooking tips, life advice, or general knowledge!
          </div>
        )}
        
        <div className="text-xs text-gray-500 text-center">
          💡 <strong>Features:</strong> Enter to send • Ctrl+M for @mentor • Esc to clear • 📋 Copy AI • ✏️ Edit your messages • 🗑️ Delete messages • 🔔 Sound notifications
        </div>
      </div>
    </div>
  );
}
