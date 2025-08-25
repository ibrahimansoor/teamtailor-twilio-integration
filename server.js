const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Your credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const recruiterPhoneNumber = process.env.RECRUITER_PHONE_NUMBER;

// Initialize Twilio client only if credentials exist
let client;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log('Twilio client initialized successfully');
  } catch (error) {
    console.error('Twilio initialization error:', error.message);
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  try {
    res.json({ 
      message: 'Teamtailor-Twilio webhook is running!', 
      timestamp: new Date().toISOString(),
      status: 'active',
      hasCredentials: !!(accountSid && authToken)
    });
  } catch (error) {
    console.error('Root endpoint error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Main webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    // Check if Twilio is configured
    if (!client) {
      console.log('Twilio not configured - webhook received but no SMS sent');
      return res.json({ success: true, message: 'Webhook received but Twilio not configured' });
    }
    
    const webhookData = req.body;
    
    // Handle different types of events
    if (webhookData.type === 'candidate_created' || webhookData.event === 'candidate_created') {
      
      // Extract candidate information
      let candidateName = 'New candidate';
      let jobTitle = 'Unknown position';
      let candidateEmail = '';
      
      // Try to get candidate details
      if (webhookData.data && webhookData.data.attributes) {
        candidateName = webhookData.data.attributes.name || webhookData.data.attributes.first_name || candidateName;
        candidateEmail = webhookData.data.attributes.email || '';
      }
      
      // Try to get job information
      if (webhookData.data && webhookData.data.relationships && webhookData.data.relationships.job) {
        jobTitle = webhookData.data.relationships.job.data.attributes?.title || jobTitle;
      }
      
      // Create message
      let messageText = `🔔 New candidate applied!\n\nName: ${candidateName}\nPosition: ${jobTitle}`;
      if (candidateEmail) {
        messageText += `\nEmail: ${candidateEmail}`;
      }
      messageText += `\n\nTime: ${new Date().toLocaleString()}`;
      
      // Send SMS notification
      const message = await client.messages.create({
        body: messageText,
        from: twilioPhoneNumber,
        to: recruiterPhoneNumber
      });
      
      console.log('SMS sent successfully:', message.sid);
      
      res.json({ 
        success: true, 
        messageSid: message.sid,
        candidate: candidateName,
        job: jobTitle
      });
      
    } else {
      // Handle other events
      console.log('Event received but no action taken:', webhookData.type || webhookData.event);
      res.json({ success: true, message: 'Webhook received but no action configured for this event type' });
    }
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Test endpoint to verify Twilio connection
app.get('/test-sms', async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({ error: 'Twilio not configured. Check your environment variables.' });
    }
    
    const message = await client.messages.create({
      body: 'Test message from your Teamtailor-Twilio integration! 🎉',
      from: twilioPhoneNumber,
      to: recruiterPhoneNumber
    });
    
    res.json({ success: true, messageSid: message.sid });
  } catch (error) {
    console.error('Test SMS error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch all other routes
app.get('*', (req, res) => {
  res.json({ 
    message: 'Teamtailor-Twilio webhook server', 
    endpoints: {
      health: '/',
      webhook: '/webhook',
      test: '/test-sms'
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Webhook endpoint: /webhook`);
  console.log(`Test endpoint: /test-sms`);
  console.log(`Environment check - Has Twilio credentials: ${!!(accountSid && authToken)}`);
});
