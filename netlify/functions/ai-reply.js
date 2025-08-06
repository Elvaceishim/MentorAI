
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const { message, user_id, username } = JSON.parse(event.body || '{}');

  if (!message || !user_id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing message or user_id' }),
    };
  }

  if (!message.includes('@mentor')) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, reason: 'No @mentor tag found' }),
    };
  }

  try {
    // 1. Fetch relevant past messages
    const { data: pastMessages, error: dbError } = await supabase
      .from('messages')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(10);

    // Handle database errors or empty results
    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Ensure pastMessages is an array and extract context
    const messagesList = pastMessages || [];
    const context = messagesList.map((m) => m.content || '').join('\n');

    // 2. Send to AI using OpenRouter (direct API call)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:8888',
        'X-Title': 'MentorAI Study Group'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: 'You are MentorAI, a versatile and knowledgeable learning assistant in a study group chat. You can help with ANY topic the user is curious about - whether it\'s technology, science, cooking, history, arts, philosophy, personal development, creative projects, academic subjects, life skills, or any other area of knowledge. Your goal is to be an encouraging, patient, and insightful mentor who makes learning enjoyable and accessible. Always provide clear, accurate, and engaging explanations tailored to the user\'s level. Use examples, analogies, and practical applications when helpful. Break down complex topics into understandable parts and encourage further learning with thoughtful follow-up questions. When listing items or steps, use proper markdown formatting: numbered lists (1. 2. 3.) for ordered items, and bullet points (- ) for unordered items.'
          },
          {
            role: 'user',
            content: `Context from recent messages:\n${context}\n\nTagged Question: ${message}\n\nPlease provide a helpful educational response.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const aiResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    const reply = aiResponse.choices[0].message.content;

    // Return the reply without storing it - let the frontend handle storage
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, reply }),
    };
  } catch (err) {
    console.error('[ai-reply error]', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
