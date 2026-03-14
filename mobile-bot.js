// Lightweight Messenger Bot for Mobile/Termux
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const { PAGE_ACCESS_TOKEN, VERIFY_TOKEN, GROQ_API_KEY } = process.env;

// Simple in-memory conversation store
const conversations = new Map();

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: '🤖 Mobile Bot Running', 
    platform: 'Android/Termux',
    uptime: process.uptime()
  });
});

// Facebook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log('✅ Verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');
  
  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      if (event.message?.text) {
        handleMessage(event.sender.id, event.message.text);
      }
    }
  }
});

async function handleMessage(senderId, text) {
  console.log(`📩 ${senderId}: ${text}`);
  
  await sendAPI(senderId, { sender_action: "typing_on" });
  
  const history = conversations.get(senderId) || [];
  history.push({ role: 'user', content: text });
  
  const reply = await getAIReply(history);
  history.push({ role: 'assistant', content: reply });
  
  conversations.set(senderId, history.slice(-10));
  
  await sendText(senderId, reply);
  console.log(`📤 Reply sent`);
}

async function getAIReply(history) {
  try {


    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
{
  role: "system",
  content: "Always reply in the same language as the most recent user message. Ignore previous conversation language."
},
...history
]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err) {

    console.error("Groq Error:", err.response?.data || err.message);

    return "⚠️ Nang AI have Temporary problem.";
  }
}

async function sendText(recipientId, text) {
  return sendAPI(recipientId, {
    message: { text: text.substring(0, 2000) }
  });
}

async function sendAPI(recipientId, payload) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: recipientId }, ...payload }
    );
  } catch (err) {
    console.error('Send failed:', err.response?.data?.error?.message || err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  📱 Mobile Bot Running on Android!
  
  Local: http://localhost:${PORT}
  Network: http://YOUR_PHONE_IP:${PORT}
  
  To expose online:
  1. Install ngrok: npm install -g ngrok
  2. Run: ngrok http ${PORT}
  3. Copy HTTPS URL to Facebook Developer Console
    `);
});
