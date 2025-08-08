// src/ChatRoom.jsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProfileModal from './ProfileModal';

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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [currentRoom, setCurrentRoom] = useState(null); // Start with null, will be set after rooms load
  const [rooms, setRooms] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [roomDeleteInfo, setRoomDeleteInfo] = useState({ messageCount: 0 });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [dbSetupComplete, setDbSetupComplete] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const fileInputRef = useRef();
  const bottomRef = useRef();
  const typingTimeoutRef = useRef();

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

  // Helper functions for user display
  const getDisplayName = (email) => {
    if (email === 'mentor@ai.assistant' || email === 'mentorai@assistant' || email === 'mentor@ai') {
      return 'MentorAI';
    }
    const profile = userProfiles[email];
    return profile?.display_name || email?.split('@')[0] || 'Unknown';
  };

  const getAvatar = (email) => {
    if (email === 'mentor@ai.assistant' || email === 'mentorai@assistant' || email === 'mentor@ai') {
      return '🧠';
    }
    const profile = userProfiles[email];
    return profile?.avatar_emoji || '👤';
  };

  // Check if database is properly set up
  const checkDatabaseSetup = async () => {
    try {
      console.log('Checking database setup...');
      
      // Test basic connection
      const { data: test, error: testError } = await supabase
        .from('messages')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('Basic connection test failed:', testError);
        setSetupError('Database connection failed: ' + testError.message);
        return;
      }
      
      // Test if required tables exist by trying to fetch from them
      const [roomsTest, reactionsTest] = await Promise.all([
        supabase.from('chat_rooms').select('id').limit(1),
        supabase.from('message_reactions').select('id').limit(1)
      ]);
      
      if (roomsTest.error || reactionsTest.error) {
        console.error('Table tests failed:', { roomsTest: roomsTest.error, reactionsTest: reactionsTest.error });
        setSetupError('Database tables not set up. Please run the SQL setup script.');
        setDbSetupComplete(false);
      } else {
        console.log('Database setup check passed');
        setDbSetupComplete(true);
        setSetupError(null);
      }
    } catch (error) {
      console.error('Database setup check error:', error);
      setSetupError('Database connection error. Please check your setup.');
      setDbSetupComplete(false);
    }
  };

  useEffect(() => {
    // Check database setup first
    checkDatabaseSetup();
    
    // Fetch rooms first
    fetchUserProfile();
    fetchAllUserProfiles();
    fetchRooms();
    
    // Don't fetch messages if no current room is selected yet
    if (!currentRoom) return;
    
    // Fetch existing messages for current room
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", currentRoom)
          .order("created_at", { ascending: true });
        
        if (error) {
          console.error('Error fetching messages:', error);
          if (error.code === '42703') {
            setSetupError('Database column missing. Please run the SQL setup script.');
          }
        } else {
          setMessages(data || []);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    
    fetchMessages();
    fetchReactions();

    // Listen for new messages in current room
    const subscription = supabase
      .channel(`room-${currentRoom}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "messages",
          filter: `room_id=eq.${currentRoom}`
        },
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
      .on('broadcast', { event: 'connection_status' }, (payload) => {
        console.log('Connection status:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to room messages');
        } else if (status === 'CLOSED') {
          console.log('Room subscription closed, attempting to reconnect...');
          // Optionally trigger a message refresh here
        }
      });

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

    // Listen for room changes
    const roomSubscription = supabase
      .channel("rooms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms" },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    // Listen for typing indicators
    const typingSubscription = supabase
      .channel(`typing-${currentRoom}`)
      .on(
        "broadcast",
        { event: "typing" },
        (payload) => {
          const { user: typingUser, displayName, typing } = payload.payload;
          if (typingUser !== user.email) {
            setTypingUsers(prev => {
              if (typing) {
                return { ...prev, [typingUser]: displayName };
              } else {
                const updated = { ...prev };
                delete updated[typingUser];
                return updated;
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(reactionSubscription);
      supabase.removeChannel(roomSubscription);
      supabase.removeChannel(typingSubscription);
    };
  }, [user, currentRoom]);

  // Add periodic refresh to prevent message loss
  useEffect(() => {
    const refreshMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", currentRoom)
          .order("created_at", { ascending: true });
        
        if (!error && data) {
          // Only update if we have fewer messages than what's in the database
          if (data.length > messages.length) {
            setMessages(data);
          }
        }
      } catch (error) {
        console.error('Error refreshing messages:', error);
      }
    };

    // Refresh messages every 30 seconds to prevent data loss
    const interval = setInterval(refreshMessages, 30000);
    
    return () => clearInterval(interval);
  }, [currentRoom, messages.length]);

  // Connection monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible again, refresh messages
        const refreshMessages = async () => {
          try {
            const { data, error } = await supabase
              .from("messages")
              .select("*")
              .eq("room_id", currentRoom)
              .order("created_at", { ascending: true });
            
            if (!error && data) {
              setMessages(data);
            }
          } catch (error) {
            console.error('Error refreshing messages on visibility change:', error);
          }
        };
        refreshMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentRoom]);

  // Typing indicator functions
  const sendTypingIndicator = (typing) => {
    supabase
      .channel(`typing-${currentRoom}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
          user: user.email, 
          displayName: getDisplayName(user.email),
          typing 
        }
      });
  };

  const handleTypingChange = (value) => {
    setNewMsg(value);
    
    // Send typing indicator
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  };

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

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    const message = {
      id: uuidv4(),
      content: newMsg,
      user_email: user.email,
      room_id: currentRoom,
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
            room_id: currentRoom,
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
          room_id: currentRoom,
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

  // Clear chat history function
  const clearChatHistory = async () => {
    if (window.confirm('Are you sure you want to clear all messages in this room? This action cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('room_id', currentRoom);

        if (error) {
          console.error('Error clearing chat history:', error);
          alert('Failed to clear chat history. Please try again.');
        } else {
          setMessages([]);
          alert('Chat history cleared successfully.');
        }
      } catch (error) {
        console.error('Error clearing chat history:', error);
        alert('Failed to clear chat history. Please try again.');
      }
    }
  };

  // User profile functions
  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_email', user.email)
        .single();

      if (!error && data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchAllUserProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*');

      if (!error && data) {
        const profilesMap = {};
        data.forEach(profile => {
          profilesMap[profile.user_email] = profile;
        });
        setUserProfiles(profilesMap);
      }
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  };

  const handleProfileUpdate = (updatedProfile) => {
    setUserProfile(updatedProfile);
    setUserProfiles(prev => ({
      ...prev,
      [updatedProfile.user_email]: updatedProfile
    }));
  };

  // Room management functions
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching rooms:', error);
        if (error.code === '42P01') {
          setSetupError('chat_rooms table missing. Please run the SQL setup script.');
        }
      } else {
        setRooms(data || []);
        
        // Set current room to first room if not already set
        if (!currentRoom && data && data.length > 0) {
          setCurrentRoom(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      return;
    }

    try {
      const roomData = {
        name: newRoomName.trim(),
        created_by: user.email,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('chat_rooms')
        .insert([roomData])
        .select();

      if (error) {
        console.error('Error creating room:', error);
        alert('Error creating room: ' + error.message);
      } else {
        setNewRoomName('');
        setShowRoomModal(false);
        await fetchRooms();
        // Switch to the new room
        if (data && data[0]) {
          setCurrentRoom(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room: ' + error.message);
    }
  };

  const switchRoom = (roomId) => {
    if (roomId !== currentRoom) {
      setCurrentRoom(roomId);
      setMessages([]); // Only clear when actually switching to a different room
    }
  };

  const initiateDeleteRoom = async (room) => {
    // Prevent deleting the last room
    if (rooms.length <= 1) {
      alert('Cannot delete the last remaining room.');
      return;
    }
    
    try {
      // Get message count for this room
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);
      
      setRoomToDelete(room);
      setRoomDeleteInfo({ messageCount: count || 0 });
      setShowDeleteModal(true);
    } catch (error) {
      console.error('Error fetching room info:', error);
      setRoomToDelete(room);
      setRoomDeleteInfo({ messageCount: 0 });
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      // First, delete all messages in the room
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomToDelete.id);

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        alert('Error deleting room messages: ' + messagesError.message);
        return;
      }

      // Then delete the room itself
      const { error: roomError } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', roomToDelete.id);

      if (roomError) {
        console.error('Error deleting room:', roomError);
        alert('Error deleting room: ' + roomError.message);
        return;
      }

      // If we deleted the current room, switch to another room
      if (currentRoom === roomToDelete.id) {
        const remainingRooms = rooms.filter(room => room.id !== roomToDelete.id);
        if (remainingRooms.length > 0) {
          setCurrentRoom(remainingRooms[0].id);
        }
      }

      // Clean up modal state
      setShowDeleteModal(false);
      setRoomToDelete(null);
      setRoomDeleteInfo({ messageCount: 0 });

      // Refresh rooms list
      await fetchRooms();
      
      alert('Room deleted successfully.');

    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Error deleting room: ' + error.message);
    }
  };

  const cancelDeleteRoom = () => {
    setShowDeleteModal(false);
    setRoomToDelete(null);
    setRoomDeleteInfo({ messageCount: 0 });
  };

  // File upload functionality
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${uuidv4()}.${fileExt}`;

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('message-files')
        .getPublicUrl(fileName);

      // Send message with file info
      const message = {
        id: uuidv4(),
        content: `Shared a file: ${file.name}`,
        user_email: user.email,
        room_id: currentRoom,
        created_at: new Date().toISOString(),
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size
      };

      // Add message to UI immediately
      setMessages(prev => [...prev, message]);
      
      // Insert to database
      await supabase.from("messages").insert([message]);

      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Trigger file upload
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Search functionality
  const searchMessages = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', currentRoom)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Database Setup Notice */}
      {setupError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white p-4 text-center">
          <div className="max-w-4xl mx-auto">
            <p className="font-semibold">⚠️ Database Setup Required</p>
            <p className="text-sm mt-1">
              {setupError} Please check the DATABASE_SETUP_GUIDE.md file for instructions.
            </p>
            <button 
              onClick={checkDatabaseSetup}
              className="mt-2 bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Rooms Sidebar */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Chat Rooms</h2>
          <button
            onClick={() => setShowRoomModal(true)}
            className="mt-2 w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            + Create Room
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {rooms.map(room => {
            const canDelete = room.created_by === user.email || room.created_by === 'system';
            console.log(`Room: ${room.name}, Created by: ${room.created_by}, User: ${user.email}, Can delete: ${canDelete}`);
            
            return (
              <div
                key={room.id}
                className={`relative group rounded-lg mb-2 transition-colors ${
                  currentRoom === room.id
                    ? 'bg-blue-100 border border-blue-200'
                    : 'hover:bg-gray-100'
                }`}
              >
                <button
                  onClick={() => switchRoom(room.id)}
                  className={`w-full text-left p-3 transition-colors ${
                    currentRoom === room.id
                      ? 'text-blue-800'
                      : 'text-gray-700'
                  }`}
                >
                  <div className="font-medium"># {room.name}</div>
                  <div className="text-xs text-gray-500">
                    Created by {room.created_by?.split('@')[0]}
                  </div>
                </button>
                
                {/* Delete button - TEMPORARILY show for all rooms for debugging */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent room switching
                    if (!canDelete) {
                      alert(`You can only delete rooms you created. This room was created by: ${room.created_by}`);
                      return;
                    }
                    initiateDeleteRoom(room);
                  }}
                  className={`absolute top-2 right-2 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-all ${
                    canDelete 
                      ? 'bg-red-500 hover:bg-red-600 text-white opacity-70 hover:opacity-100' 
                      : 'bg-gray-300 text-gray-500 opacity-50 cursor-not-allowed'
                  }`}
                  title={canDelete ? `Delete room "${room.name}"` : `Can't delete - created by ${room.created_by}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              # {rooms.find(r => r.id === currentRoom)?.name || 'General'}
            </h1>
            <p className="text-sm text-gray-600">
              Welcome, {getAvatar(user.email)} {getDisplayName(user.email)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full transition-all duration-200 ${
                showSearch
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Search messages"
            >
              <span className="text-lg">🔍</span>
            </button>
            <button
              onClick={async () => {
                if (!currentRoom) return;
                const { data, error } = await supabase
                  .from("messages")
                  .select("*")
                  .eq("room_id", currentRoom)
                  .order("created_at", { ascending: true });
                if (!error) setMessages(data || []);
              }}
              className="p-2 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-all duration-200"
              title="Refresh messages"
            >
              <span className="text-lg">🔄</span>
            </button>
            <button
              onClick={clearChatHistory}
              className="p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-all duration-200"
              title="Clear chat history"
            >
              <span className="text-lg">🗑️</span>
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="p-2 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all duration-200"
              title="Edit your profile"
            >
              <span className="text-lg">👤</span>
            </button>
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
        </div>
        
        {/* Search Interface */}
        {showSearch && (
          <div className="border-b border-gray-200 bg-gray-50 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchMessages(e.target.value);
                }}
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search messages in this room..."
              />
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowSearch(false);
                }}
                className="bg-gray-200 text-gray-600 px-4 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-2">Found {searchResults.length} messages:</p>
                {searchResults.slice(0, 5).map(result => (
                  <div key={result.id} className="text-xs bg-white p-2 rounded border mb-1">
                    <span className="font-medium">{getDisplayName(result.user_email)}:</span> {result.content.substring(0, 100)}...
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
          const isMentorAI = msg.user_email === 'mentor@ai.assistant' || msg.user_email === 'mentorai@assistant' || msg.user_email === 'mentor@ai';
          const isCurrentUser = msg.user_email === user.email;
          const messageReactions = reactions[msg.id] || {};

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
                <div className="flex items-center gap-1">
                  <span className="text-sm">{getAvatar(msg.user_email)}</span>
                  <p className={`text-xs font-medium ${
                    isMentorAI ? "text-emerald-700" : "text-gray-600"
                  }`}>
                    {getDisplayName(msg.user_email)}
                  </p>
                </div>
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
                <div>
                  <p className="text-gray-800 leading-relaxed">
                    {msg.content || msg.text}
                  </p>
                  
                  {/* File display */}
                  {msg.file_url && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                      {msg.file_type?.startsWith('image/') ? (
                        <div>
                          <img 
                            src={msg.file_url} 
                            alt={msg.file_name}
                            className="max-w-sm max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                            onClick={() => window.open(msg.file_url, '_blank')}
                          />
                          <p className="text-xs text-gray-500 mt-1">{msg.file_name}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">📄</span>
                          <div>
                            <a 
                              href={msg.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {msg.file_name}
                            </a>
                            <p className="text-xs text-gray-500">
                              {(msg.file_size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reactions */}
              <div className="flex items-center gap-2 mt-2">
                {/* Show existing reactions with counts */}
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(messageReactions).map(([emoji, userEmails]) => {
                    const count = userEmails.length;
                    const userHasReacted = userEmails.includes(user.email);
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(msg.id, emoji)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all ${
                          userHasReacted 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                            : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        title={`${count} reaction${count > 1 ? 's' : ''}`}
                      >
                        <span>{emoji}</span>
                        <span className="text-xs">{count}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Add reaction button */}
                <button
                  onClick={() => toggleEmojiPicker(msg.id)}
                  className="text-gray-400 hover:text-emerald-600 transition-colors text-sm px-2 py-1 rounded hover:bg-gray-100"
                  title="Add a reaction"
                >
                  {showEmojiPicker === msg.id ? '−' : '+'} 😊
                </button>
              </div>
              
              {/* Emoji picker */}
              {showEmojiPicker === msg.id && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg border">
                  <div className="flex gap-1 flex-wrap">
                    {availableEmojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(msg.id, emoji)}
                        className="text-2xl hover:scale-110 transition-transform p-1 rounded hover:bg-white"
                        title={`React with ${emoji}`}
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

        {/* Typing indicators */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="bg-gray-50 border p-3 rounded-xl">
            <p className="text-sm text-gray-600 italic flex items-center">
              <span className="mr-2">
                {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing
              </span>
              <span className="flex space-x-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
              </span>
            </p>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={triggerFileUpload}
            disabled={uploadingFile}
            className="bg-gray-100 text-gray-600 px-3 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            title="Upload file"
          >
            {uploadingFile ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>📎</span>
            )}
          </button>
          <input
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
            placeholder="Type a message... (Enter to send, Ctrl+M for @mentor, Esc to clear)"
            value={newMsg}
            onChange={(e) => handleTypingChange(e.target.value)}
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
          💡 <strong>Features:</strong> Enter to send • Ctrl+M for @mentor • Esc to clear • 📎 Upload files • 🔍 Search messages • � Refresh • �🗑️ Clear chat • 📋 Copy AI • ✏️ Edit your messages • 🗑️ Delete messages • 🔔 Sound notifications • 👤 Edit profile • 😄 React with emojis • ⌨️ Typing indicators
        </div>
        </div>
      </div>

      {/* Profile modal */}
      {showProfileModal && (
        <ProfileModal 
          user={user}
          userProfile={userProfile}
          onClose={() => setShowProfileModal(false)}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Room modal */}
      {showRoomModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Create New Room</h2>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Enter room name..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRoomModal(false)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createRoom}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {showDeleteModal && roomToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <div className="ml-4">
                <h2 className="text-lg font-semibold text-gray-900">Delete Room</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete the room <strong>"{roomToDelete.name}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will permanently delete:
                </p>
                <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                  <li>The room itself</li>
                  <li>{roomDeleteInfo.messageCount} message{roomDeleteInfo.messageCount !== 1 ? 's' : ''} in this room</li>
                  <li>All reactions on those messages</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDeleteRoom}
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRoom}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
