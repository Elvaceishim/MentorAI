// Test script to demonstrate AI mentor integration
// Run with: node test-integration.js

import fetch from 'node-fetch';

async function testAiMentor() {
  console.log('🤖 Testing AI Mentor Integration...\n');
  
  try {
    const response = await fetch('http://localhost:8888/.netlify/functions/ai-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hey @mentor, can you explain what useState does in React?',
        user_id: 'demo-user',
        username: 'demo'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ AI Mentor Response:');
      console.log('---');
      console.log(result.reply);
      console.log('---\n');
      console.log('🎉 Integration test successful!');
    } else {
      console.log('❌ Test failed:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAiMentor();
