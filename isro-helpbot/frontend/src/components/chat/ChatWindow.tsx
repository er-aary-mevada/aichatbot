'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, CircularProgress, Button } from '@mui/material';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ContextPanel from './ContextPanel';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  context?: Record<string, any>;
}

interface Session {
  id: string;
  context: Record<string, any>;
  lastActive: Date;
}

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <Paper sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" color="error">Something went wrong</Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>{error.message}</Typography>
      <Button onClick={resetErrorBoundary} variant="outlined">Try again</Button>
    </Paper>
  );
};

export default function ChatWindow() {
  const [session, setSession] = useState<Session>({
    id: '',
    context: {},
    lastActive: new Date()
  });

  const [messages, setMessages] = useState<Message[]>([]);
  
  const [contextData, setContextData] = useState({
    currentTopic: '',
    relevantDocs: [],
    relatedQuestions: []
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Generate session ID
  function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Enhanced AI response generation for offline mode
  function generateAIResponse(userMessage: string, sessionContext: Record<string, any>): Message {
    const message = userMessage.toLowerCase();
    let response = "";
    let newContext = { ...sessionContext };

    // Track conversation topics
    if (message.includes('satellite') || message.includes('data')) {
      newContext.topic = 'satellite_data';
      newContext.userInterests = [...(newContext.userInterests || []), 'satellite_data'];
    } else if (message.includes('download') || message.includes('access')) {
      newContext.topic = 'download_process';
      newContext.userInterests = [...(newContext.userInterests || []), 'data_access'];
    }

    // Generate contextual responses
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      response = "Hello! I'm the MOSDAC AI Assistant. I can help you with satellite data, downloads, documentation, and general information about MOSDAC services. What would you like to know?";
    } else if (message.includes('satellite') && message.includes('data')) {
      response = "MOSDAC provides comprehensive satellite data including:\n• Ocean Color data\n• Sea Surface Temperature\n• Chlorophyll concentration\n• Oceanographic parameters\n• Weather satellite imagery\n\nAll data is freely available for research and educational purposes. Would you like information about accessing specific datasets?";
    } else if (message.includes('download') || message.includes('access')) {
      response = "To download satellite data from MOSDAC:\n1. Visit www.mosdac.gov.in\n2. Register for a free account\n3. Browse the data catalog\n4. Select your desired dataset and time range\n5. Download directly or request bulk data\n\nSome datasets may require additional registration. Would you like help with a specific dataset?";
    } else if (message.includes('registration') || message.includes('account')) {
      response = "To register for MOSDAC services:\n1. Go to the MOSDAC portal\n2. Click on 'New User Registration'\n3. Fill in your details and purpose of use\n4. Verify your email\n5. Login with your credentials\n\nRegistration is free and gives you access to all public datasets and some restricted research data.";
    } else if (message.includes('help') || message.includes('support')) {
      response = "I can help you with:\n• Finding and downloading satellite data\n• Understanding MOSDAC services\n• Registration and account issues\n• Data formats and processing\n• API access and documentation\n\nFor technical support, you can also contact the MOSDAC team directly.";
    } else if (message.includes('api')) {
      response = "MOSDAC provides REST API access for automated data retrieval:\n• Programmatic data access\n• Bulk download capabilities\n• Integration with analysis tools\n• Documentation available on the portal\n\nAPI access requires registration and approval for certain datasets.";
    } else if (message.includes('format') || message.includes('file')) {
      response = "MOSDAC data is available in various formats:\n• NetCDF (Network Common Data Form)\n• HDF (Hierarchical Data Format)\n• GeoTIFF for imagery\n• CSV for tabular data\n• Binary formats for specific sensors\n\nMost scientific data uses NetCDF format which is widely supported by analysis tools.";
    } else if (message.includes('thank')) {
      response = "You're welcome! I'm here to help with any other questions about MOSDAC satellite data and services. Feel free to ask anything else!";
    } else {
      response = "I can help you with MOSDAC satellite data and services. Some things you can ask me about:\n• Satellite datasets and how to access them\n• Registration and download processes\n• Data formats and file types\n• API access and documentation\n• General MOSDAC services\n\nWhat specific information are you looking for?";
    }

    // Update session context
    setSession(prev => ({
      ...prev,
      context: newContext,
      lastActive: new Date()
    }));

    return {
      id: `bot_${Date.now()}`,
      text: response,
      sender: 'bot',
      timestamp: new Date(),
      context: newContext
    };
  }

  // Load session and message history from localStorage
  useEffect(() => {
    if (!isClient) return;
    
    const savedSession = localStorage.getItem('mosdac_chat_session');
    const savedMessages = localStorage.getItem('mosdac_chat_messages');
    
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      setSession({
        ...parsed,
        lastActive: new Date(parsed.lastActive)
      });
    } else {
      // Generate new session ID only on client
      setSession({
        id: generateSessionId(),
        context: {},
        lastActive: new Date()
      });
    }
    
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(parsedMessages);
    } else {
      // Set welcome message if no history
      setMessages([{
        id: 'welcome_1',
        text: 'Hello! I\'m your MOSDAC AI Assistant. I can help you with satellite data, downloads, and MOSDAC services. How can I help you today?',
        sender: 'bot',
        timestamp: new Date()
      }]);
    }
  }, [isClient]);

  // Save session to localStorage
  useEffect(() => {
    if (session.id) {
      localStorage.setItem('mosdac_chat_session', JSON.stringify(session));
    }
  }, [session]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('mosdac_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    function connect() {
      try {
        setIsConnecting(true);
        const ws = new WebSocket(`ws://localhost:8000/ws/${session.id}`);
        
        ws.onopen = () => {
          console.log('Connected to WebSocket server');
          setIsConnecting(false);
          setError(null);
          setConnectionAttempts(0);
          setOfflineMode(false);
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed');
          if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            setError('Connection lost. Attempting to reconnect...');
            setConnectionAttempts(prev => prev + 1);
            setTimeout(connect, 3000);
          } else {
            setOfflineMode(true);
            setError('Backend server is not available. Running in offline mode with basic responses.');
            setIsConnecting(false);
          }
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          // Update messages
          setMessages(prev => [...prev, {
            id: data.id || Date.now().toString(),
            text: data.message || data.text,
            sender: data.type === 'bot' ? 'bot' : data.sender || 'bot',
            timestamp: new Date(data.timestamp || Date.now()),
            context: data.context
          }]);

          // Update session context if provided
          if (data.context) {
            setSession(prev => ({
              ...prev,
              context: {
                ...prev.context,
                ...data.context
              },
              lastActive: new Date()
            }));

            // Update suggestions and relevant docs in the UI
            if (data.context.suggestedQuestions) {
              setContextData(prev => ({
                ...prev,
                currentTopic: data.context.topic || prev.currentTopic,
                relevantDocs: data.context.relevantDocs || prev.relevantDocs,
                relatedQuestions: data.context.suggestedQuestions
              }));
            }
          }
          
          setIsProcessing(false);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          setConnectionAttempts(prev => prev + 1);
          
          if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 5000);
            setError(`Connection failed. Retrying in ${delay/1000} seconds... (Attempt ${connectionAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connect, delay);
          } else {
            setOfflineMode(true);
            setError('Backend server is not available. Running in offline mode with basic responses.');
          }
        };

        wsRef.current = ws;
      } catch (err) {
        setError('Failed to connect. Running in offline mode.');
        setIsConnecting(false);
        setOfflineMode(true);
      }
    }

    if (session.id) {
      connect();
    }
    
    return () => wsRef.current?.close();
  }, [session.id, connectionAttempts]);

  const sendMessage = async (text: string) => {
    try {
      // Add user message immediately
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        text,
        sender: 'user',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsProcessing(true);
      setError(null);

      // Try WebSocket first if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !offlineMode) {
        wsRef.current.send(JSON.stringify({ 
          message: text,
          timestamp: new Date().toISOString(),
          context: session.context
        }));
      } else {
        // Fallback to offline mode with enhanced AI responses
        setTimeout(() => {
          const botResponse = generateAIResponse(text, session.context);
          setMessages(prev => [...prev, botResponse]);
          setIsProcessing(false);
        }, 1000 + Math.random() * 1000); // Simulate response delay
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      setIsProcessing(false);
    }
  };

  // Clear chat history function
  const clearHistory = () => {
    setMessages([{
      id: 'welcome_new',
      text: 'Chat history cleared. How can I help you today?',
      sender: 'bot',
      timestamp: new Date()
    }]);
    localStorage.removeItem('mosdac_chat_messages');
    setSession(prev => ({ ...prev, context: {}, lastActive: new Date() }));
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Paper elevation={3} sx={{
        height: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Status Bar */}
        <Box sx={{ 
          px: 2, 
          py: 1, 
          borderBottom: 1, 
          borderColor: 'divider',
          backgroundColor: offlineMode ? 'warning.light' : 'primary.light',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="body2">
            {offlineMode ? '🔒 Offline Mode' : '🌐 Connected'}
            {isClient && session.id ? ` • Session: ${session.id.slice(-8)}` : ''}
          </Typography>
          <Button 
            size="small" 
            variant="outlined" 
            onClick={clearHistory}
            sx={{ color: 'white', borderColor: 'white' }}
          >
            Clear History
          </Button>
        </Box>

        {/* Messages Area */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <MessageList messages={messages} />
        </Box>
        
        {/* Error Display */}
        {error && (
          <Typography color="error" sx={{ p: 1, textAlign: 'center', fontSize: '0.875rem' }}>
            {error}
          </Typography>
        )}

        {/* Connection Status */}
        {isConnecting && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={20} /> 
            <Typography sx={{ ml: 1 }}>Connecting...</Typography>
          </Box>
        )}

        {/* Message Input */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <MessageInput 
            onSend={sendMessage}
            isProcessing={isProcessing}
            error={error}
            suggestions={contextData.relatedQuestions}
          />
        </Box>
      </Paper>
    </ErrorBoundary>
  );
}