import twilio from 'twilio';
import logger from '../utils/logger';
import 'dotenv/config';


const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  logger.warn('Twilio credentials not configured');
}

export const twilioClient = accountSid && authToken 
  ? twilio(accountSid, authToken)
  : null;

export const TWILIO_CONFIG = {
  PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  ACCOUNT_SID: accountSid || '',
};

if (twilioClient) {
  logger.info('Twilio client initialized');
}

// BJXYFVTZA4YEPA1G6FL5GXGU