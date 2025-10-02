'use client';

import React, { useEffect, useRef } from 'react';
import { Box, Typography, Paper, Avatar } from '@mui/material';
import { SmartToy as BotIcon, Person as UserIcon } from '@mui/icons-material';
import TimeStamp from './TimeStamp';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  context?: Record<string, any>;
}

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatMessage = (text: string) => {
    // Format bot messages with better line breaks and bullet points
    return text.split('\n').map((line, index) => (
      <Typography 
        key={index} 
        variant="body1" 
        component="div"
        sx={{ 
          mb: index < text.split('\n').length - 1 ? 0.5 : 0,
          lineHeight: 1.5
        }}
      >
        {line}
      </Typography>
    ));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
      {messages.map((message) => (
        <Box
          key={message.id}
          sx={{
            display: 'flex',
            justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-start',
            gap: 1,
            opacity: 1,
            transform: 'translateY(0)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            animation: 'fadeInUp 0.3s ease-out'
          }}
        >
          {message.sender === 'bot' && (
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                width: 32, 
                height: 32,
                mt: 0.5
              }}
            >
              <BotIcon fontSize="small" />
            </Avatar>
          )}
          
          <Paper
            elevation={message.sender === 'user' ? 2 : 0}
            sx={{
              p: 2,
              maxWidth: '70%',
              minWidth: '100px',
              bgcolor: message.sender === 'user' ? 'primary.main' : '#f8f9fa',
              color: message.sender === 'user' ? 'white' : 'text.primary',
              borderRadius: message.sender === 'user' ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
              boxShadow: message.sender === 'user' 
                ? '0 2px 8px rgba(25, 118, 210, 0.3)' 
                : '0 1px 4px rgba(0,0,0,0.08)',
              border: message.sender === 'bot' ? '1px solid #e0e0e0' : 'none',
              position: 'relative'
            }}
          >
            {message.sender === 'bot' ? formatMessage(message.text) : (
              <Typography variant="body1" sx={{ lineHeight: 1.5 }}>
                {message.text}
              </Typography>
            )}
            <TimeStamp date={message.timestamp} />
          </Paper>

          {message.sender === 'user' && (
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                width: 32, 
                height: 32,
                mt: 0.5
              }}
            >
              <UserIcon fontSize="small" />
            </Avatar>
          )}
        </Box>
      ))}
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default MessageList;