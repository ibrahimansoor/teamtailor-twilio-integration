const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Your credentials - Railway will let you set these as environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_twilio_account_sid_here';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_twilio_auth_token_here';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
const recruiterPhoneNumber = process.env.RECRUITER_PHONE_NUMBER || '+1987654321';

const client = twilio(accountSid, authToken);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Teamtailor-Twilio webhook is running!', 
    timestamp: new Date().toISOString() 
  });
});

// Main webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    const webhookData = req.body;
    
    // Handle different types of events
    if (webhookData.type === 'candidate_created' || webhookData.event === 'candidate_created') {
      
      // Extract candidate information
      let candidateName = 'New candidate';
      let jobTitle = 'Unknown position';
      let candidateEmail = '';
      
      // Try to get candidate details (Teamtailor webhook structure can vary)
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
      
    } else if (webhookData.type === 'candidate_updated' || webhookData.event === 'candidate_updated') {
      
      // Handle candidate updates (optional)
      console.log('Candidate updated - no SMS sent');
      res.json({ success: true, message: 'Candidate updated event received' });
      
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
    const message = await client.messages.create({
      body: 'Test message from your Teamtailor-Twilio integration! 🎉',
      from: twilioPhoneNumber,
      to: recruiterPhoneNumber
    });
    
    res.json({ success: true, messageSid: message.sid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Webhook endpoint: /webhook`);
  console.log(`Test endpoint: /test-sms`);
});
